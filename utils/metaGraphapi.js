// utils/metaGraphApi.util.js
//
// Shared helpers for talking to the Meta Graph API efficiently.
// Centralizing this here means: one place to bump the Graph API version,
// one place to fix a metric name when Meta deprecates something, and one
// batching implementation reused by every dashboard endpoint.
//
// ====================================================================
// UPDATED FOR GRAPH API v25.0 (July 2026)
// ====================================================================
// Meta deprecated several Page + Instagram Insights metrics that this
// file used to rely on:
//
//   Facebook Page Insights (deprecated Nov 15, 2025):
//     - page_impressions*         -> replaced by page_media_view
//     - page_impressions_unique*  -> replaced by page_total_media_view_unique
//     - page_fans                 -> replaced by page_follows
//     - post_impressions*         -> replaced by post_media_view
//     - post_impressions_unique*  -> replaced by post_total_media_view_unique
//
//   Instagram Insights (deprecated April 21, 2025 for v22.0+):
//     - impressions (account + media level) -> replaced by `views`
//     - `plays` metric on media (Reels)      -> replaced by `views`
//
//   Instagram account-level `reach` with metric_type=time_series only
//   accepts a since/until window of ~30 days per call (this is what was
//   causing the "(#100) There cannot be more than 30 days..." error).
//   fetchIgReachTimeSeries() below chunks the requested range into
//   <=30-day windows and stitches the results back together.
//
//   PUBLISHING (added below): binary-only, no hosted-URL inputs anywhere
//   users touch. Media comes from the device gallery, so every publish
//   helper takes a Buffer straight from multer, not a URL:
//     - FB photos/videos -> multipart `source` field (standard Graph API
//       upload, same as any file upload elsewhere on the web)
//     - FB Reels          -> resumable protocol: start -> raw binary POST
//       to rupload.facebook.com -> finish
//     - IG video/Reels    -> same shape as FB Reels: create a container
//       with upload_type=resumable, POST raw binary to
//       rupload.facebook.com/ig-api-upload/..., poll, then publish
//     - IG images          -> the one exception. Meta's container API only
//       accepts `image_url` for photos; there is no binary upload path
//       for IG images. See uploadBufferToPublicUrl()'s doc comment below.
// ====================================================================

const axios = require("axios");
const FormData = require("form-data");

// Pin ONE version across the whole app. Bump it here only.
const GRAPH_VERSION = "v25.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/* ------------------------------------------------------------------ */
/*  Date range helpers                                                 */
/* ------------------------------------------------------------------ */

function daysAgoUTC(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function unixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Turns a `period` query param ("7d" | "30d" | "90d") into a concrete
 * { since, until } window used both for Graph API `since`/`until` params
 * and for client-side filtering of edges (like IG media) that don't
 * support server-side date filtering.
 *
 * NOTE: Page Insights caps since/until windows at 90 days per call, so
 * "90d" is the max supported here without adding chunking on the FB side
 * too (FB page-level chunking isn't implemented since 90d == the limit).
 */
function resolveDateRange(period = "30d") {
  const map = { "7d": 7, "30d": 30, "90d": 90, days_7: 7, days_28: 28, days_90: 90 };
  const days = map[period] || parseInt(period, 10) || 30;
  const until = new Date();
  const since = daysAgoUTC(days);
  return { days, since, until, sinceUnix: unixSeconds(since), untilUnix: unixSeconds(until) };
}

/**
 * Splits a [sinceUnix, untilUnix] range into <= chunkDays windows.
 * Used for IG account-level `reach` (metric_type=time_series), which
 * Meta restricts to short since/until spans per call.
 */
function chunkDateRange(sinceUnix, untilUnix, chunkDays = 30) {
  const chunkSeconds = chunkDays * 24 * 60 * 60;
  const windows = [];
  let cursor = sinceUnix;
  while (cursor < untilUnix) {
    const end = Math.min(cursor + chunkSeconds, untilUnix);
    windows.push([cursor, end]);
    cursor = end;
  }
  return windows;
}

/* ------------------------------------------------------------------ */
/*  Batch requests — collapse N calls into 1 HTTP round trip           */
/* ------------------------------------------------------------------ */

/**
 * Executes multiple Graph API GET requests in a SINGLE HTTP call using
 * Facebook's /?batch=[...] endpoint (max 50 sub-requests per call, so
 * this chunks automatically if you pass more).
 *
 * A failure in one sub-request never throws for the whole batch — each
 * result comes back tagged with `ok` so the caller can degrade gracefully
 * (e.g. render the dashboard minus the one widget that failed).
 *
 * @param {{relativeUrl: string, method?: string}[]} requests
 * @param {string} accessToken
 * @returns {Promise<{ok:boolean, code:number, body:any}[]>} same order as input
 */
async function graphBatch(requests, accessToken) {
  if (!requests.length) return [];

  const chunks = [];
  for (let i = 0; i < requests.length; i += 50) chunks.push(requests.slice(i, i + 50));

  const results = [];
  for (const chunk of chunks) {
    const batchPayload = chunk.map((r) => ({ method: r.method || "GET", relative_url: r.relativeUrl }));

    const { data } = await axios.post(`${BASE_URL}/`, null, {
      params: { access_token: accessToken, batch: JSON.stringify(batchPayload) },
    });

    data.forEach((res) => {
      let body = null;
      try {
        body = res?.body ? JSON.parse(res.body) : null;
      } catch (_) {
        body = null;
      }
      results.push({ ok: res?.code >= 200 && res?.code < 300, code: res?.code, body });
    });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Insight response shaping                                           */
/* ------------------------------------------------------------------ */

/**
 * Converts a Graph API insight's `values` array (period=day, since/until)
 * into a chart-ready series plus a period total.
 *
 * mode "sum"  -> for flow metrics (page_media_view, page_post_engagements)
 * mode "last" -> for stock/cumulative metrics (e.g. page_follows), where
 *                the period total should be the latest value, not a sum.
 */
function seriesFromInsight(values = [], mode = "sum") {
  const series = values.map((v) => ({
    date: (v.end_time || "").slice(0, 10),
    value: typeof v.value === "object" ? Object.values(v.value)[0] || 0 : safeNum(v.value),
  }));
  const total =
    mode === "last" ? (series.length ? series[series.length - 1].value : 0) : series.reduce((s, p) => s + p.value, 0);
  return { series, total };
}

/** Merges two date-keyed series (e.g. Facebook + Instagram) into one combined series, summed by date, sorted and de-duped. */
function mergeSeries(seriesA = [], seriesB = []) {
  const map = new Map();
  [...seriesA, ...seriesB].forEach(({ date, value }) => {
    if (!date) return;
    map.set(date, (map.get(date) || 0) + safeNum(value));
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
}

function safeNum(n) {
  return typeof n === "number" && !Number.isNaN(n) ? n : Number(n) || 0;
}

function engagementRate(engagements, base) {
  if (!base) return 0;
  return Number(((engagements / base) * 100).toFixed(2));
}

/* ------------------------------------------------------------------ */
/*  Instagram: account-level reach (chunked, v25-safe)                 */
/* ------------------------------------------------------------------ */

/**
 * Fetches IG account-level `reach` as a daily time series across an
 * arbitrary date range, transparently chunking into <=30-day windows
 * since metric_type=time_series only accepts short since/until spans.
 *
 * Only throws if EVERY window fails — a partial result (e.g. 60 of 90
 * days) is still returned so the caller can render something instead of
 * nothing.
 */
async function fetchIgReachTimeSeries(igId, accessToken, sinceUnix, untilUnix, chunkDays = 30) {
  const windows = chunkDateRange(sinceUnix, untilUnix, chunkDays);

  let series = [];
  let lastError = null;

  for (const [since, until] of windows) {
    try {
      const { data } = await axios.get(`${BASE_URL}/${igId}/insights`, {
        params: {
          metric: "reach",
          period: "day",
          metric_type: "time_series",
          since,
          until,
          access_token: accessToken,
        },
      });
      const chunkSeries = seriesFromInsight(data?.data?.[0]?.values, "sum").series;
      series = series.concat(chunkSeries);
    } catch (e) {
      lastError = e;
    }
  }

  if (!series.length && lastError) throw lastError;
  return mergeSeries(series, []); // sort + de-dupe across chunk boundaries
}

/* ------------------------------------------------------------------ */
/*  Instagram media pagination                                         */
/* ------------------------------------------------------------------ */

/**
 * IG's /media edge doesn't support server-side since/until filtering, and
 * media is returned newest-first, so we page through it and stop as soon
 * as we hit an item older than `since` — capped at maxPages as a safety
 * valve for very high-volume accounts.
 */
async function fetchAllIgMediaInRange(igId, accessToken, since, maxPages = 5) {
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_product_type",
    "timestamp",
    "like_count",
    "comments_count",
    "thumbnail_url",
    "media_url",
    "permalink",
  ].join(",");

  let url = `${BASE_URL}/${igId}/media`;
  let params = { fields, limit: 50, access_token: accessToken };
  const collected = [];

  for (let i = 0; i < maxPages; i++) {
    const { data } = await axios.get(url, { params });
    const items = data.data || [];
    for (const item of items) {
      if (new Date(item.timestamp) < since) return collected; // newest-first: safe to stop here
      collected.push(item);
    }
    if (!data.paging?.next) break;
    url = data.paging.next; // next URL already carries all needed query params
    params = undefined;
  }
  return collected;
}

/**
 * IG media-insight metrics to request per post, on top of what's already
 * available as direct fields on the media object (like_count, comments_count).
 *
 * v25.0 update: `impressions` and `plays` are deprecated/removed for media
 * created after July 2, 2024 — `views` is the replacement and is valid for
 * both FEED and REELS media_product_type. `total_interactions` gives a
 * ready-made engagement total (likes + saves + comments + shares) as a
 * fallback if we ever want to stop summing manually.
 *
 * Graph API rejects the WHOLE insights call if any one metric name is
 * invalid, so keep this list to metrics confirmed valid for both FEED and
 * REELS in the current docs.
 */
function igInsightMetricsFor(_mediaProductType) {
  return "reach,saved,shares,views,total_interactions";
}

/* ================================================================== */
/*  PUBLISHING — binary only, no hosted-URL inputs                     */
/* ================================================================== */
/*
  Every function below takes a Buffer (straight from multer's
  memoryStorage on the route) instead of a URL. Two different transport
  mechanisms are involved depending on media type:

    - Small/standard uploads (FB photos, FB standard videos) go as
      multipart/form-data via the `form-data` package, same as any file
      upload to a web API.
    - Reels (FB and IG) and IG videos go through Meta's resumable upload
      protocol: a `start`/container call on graph.facebook.com returns an
      id, then the raw file bytes are POSTed directly to
      rupload.facebook.com with Authorization/offset/file_size headers
      (no multipart wrapper), then a `finish`/publish call closes it out.
      This is also the correct path for large files since it's designed
      to be resumable, unlike the plain multipart upload below.
*/

/* ---------------- Facebook Page posts ---------------- */

/**
 * Text (or link) post to a Page's feed. No media involved.
 * POST /{page-id}/feed
 */
async function publishFacebookText(pageId, accessToken, { message, link } = {}) {
  const { data } = await axios.post(`${BASE_URL}/${pageId}/feed`, null, {
    params: { message, link, access_token: accessToken },
  });
  return data; // { id: "<post_id>" }
}

/**
 * Single photo post from a binary buffer.
 * POST /{page-id}/photos, multipart `source` field.
 */
async function publishFacebookPhoto(pageId, accessToken, { buffer, filename, mimetype, caption, published = true } = {}) {
  const form = new FormData();
  form.append("source", buffer, { filename: filename || "photo.jpg", contentType: mimetype || "image/jpeg" });
  if (caption) form.append("caption", caption);
  form.append("published", String(published));
  form.append("access_token", accessToken);

  const { data } = await axios.post(`${BASE_URL}/${pageId}/photos`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data; // { id: "<photo_id>", post_id: "<page-id>_<post_id>" }
}

/**
 * Standard (non-Reel) Page video post from a binary buffer.
 * POST /{page-id}/videos, multipart `source` field — a single request,
 * fine for typical phone-recorded clips. Graph API's single-request cap
 * is roughly 1GB / 20 minutes; anything larger needs Meta's general
 * Resumable Upload API (start/transfer/finish over multiple chunks),
 * which isn't implemented here since Reels already needed the resumable
 * path below and standard video posts rarely hit that ceiling.
 */
async function publishFacebookVideo(pageId, accessToken, { buffer, filename, mimetype, title, description } = {}) {
  const form = new FormData();
  form.append("source", buffer, { filename: filename || "video.mp4", contentType: mimetype || "video/mp4" });
  if (title) form.append("title", title);
  if (description) form.append("description", description);
  form.append("access_token", accessToken);

  const { data } = await axios.post(`${BASE_URL}/${pageId}/videos`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data; // { id: "<video_id>" }
}

/**
 * Page Reel from a binary buffer. Reels can't use the plain /videos
 * multipart upload above — Meta requires the resumable protocol via the
 * dedicated `video_reels` edge:
 *   1. start  -> POST /{page-id}/video_reels?upload_phase=start
 *                returns { video_id, upload_url }
 *   2. upload -> POST the raw file bytes straight to
 *                https://rupload.facebook.com/video-upload/<version>/<video_id>
 *                with Authorization/offset/file_size headers (no
 *                multipart wrapper — the body IS the file)
 *   3. finish -> POST /{page-id}/video_reels?upload_phase=finish&video_state=PUBLISHED
 */
async function publishFacebookReel(pageId, accessToken, { buffer, description } = {}) {
  const { data: start } = await axios.post(`${BASE_URL}/${pageId}/video_reels`, null, {
    params: { upload_phase: "start", access_token: accessToken },
  });

  const videoId = start.video_id;
  const uploadUrl = start.upload_url || `https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`;

  await axios.post(uploadUrl, buffer, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: "0",
      file_size: String(buffer.length),
      "Content-Type": "application/octet-stream",
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const { data: finish } = await axios.post(`${BASE_URL}/${pageId}/video_reels`, null, {
    params: {
      upload_phase: "finish",
      video_id: videoId,
      video_state: "PUBLISHED",
      description,
      access_token: accessToken,
    },
  });

  return { video_id: videoId, ...finish }; // finish.success === true once processed
}

/* ---------------- Instagram content publishing ---------------- */
/*
  IG's publishing flow is always two calls, regardless of media type:
    1. Create a container    -> POST /{ig-id}/media        => { id: containerId }
    2. Publish the container -> POST /{ig-id}/media_publish?creation_id=...

  Video/Reels containers are processed asynchronously, so
  pollIgContainerStatus() waits for status_code to leave IN_PROGRESS
  before publishing.

  Rate limit: the Content Publishing API caps most accounts around 25-100
  published posts per rolling 24h window depending on the account — this
  surfaces as a normal Graph API error, so no special handling is needed
  here beyond letting the error bubble up.
*/

/**
 * Creates a media container from a hosted URL. Still needed for:
 *   - IG image posts (Meta requires `image_url` — see
 *     uploadBufferToPublicUrl below for why)
 *   - the CAROUSEL parent container, which only takes `children` ids and
 *     never touches media directly
 */
async function createIgMediaContainer(igId, accessToken, params = {}) {
  const { data } = await axios.post(`${BASE_URL}/${igId}/media`, null, {
    params: { ...params, access_token: accessToken },
  });
  return data; // { id: "<container_id>" }
}

/**
 * Creates a container for a binary (resumable) video/Reel upload — no
 * URL involved. `mediaType` is "VIDEO" (feed video / carousel video item)
 * or "REELS". Follow with uploadIgResumableBinary() to send the bytes.
 * POST /{ig-id}/media?upload_type=resumable&media_type=...
 */
async function createIgResumableContainer(igId, accessToken, { mediaType, caption, isCarouselItem } = {}) {
  const { data } = await axios.post(`${BASE_URL}/${igId}/media`, null, {
    params: {
      upload_type: "resumable",
      media_type: mediaType,
      caption,
      is_carousel_item: isCarouselItem || undefined,
      access_token: accessToken,
    },
  });
  return data; // { id: "<container_id>" }
}

/**
 * Sends the raw video bytes for a resumable IG container.
 * POST https://rupload.facebook.com/ig-api-upload/<version>/<container-id>
 * with Authorization/offset/file_size headers — same shape as the FB
 * Reels binary upload above, just a different host.
 */
async function uploadIgResumableBinary(containerId, accessToken, buffer) {
  const url = `https://rupload.facebook.com/ig-api-upload/${GRAPH_VERSION}/${containerId}`;
  const { data } = await axios.post(url, buffer, {
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: "0",
      file_size: String(buffer.length),
      "Content-Type": "application/octet-stream",
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data; // { success: true, message: "Upload successful." }
}

/**
 * Polls a container's processing status until it's FINISHED (ready to
 * publish) or ERROR. Video/Reels containers can take anywhere from a few
 * seconds to a couple of minutes depending on length/size.
 */
async function pollIgContainerStatus(containerId, accessToken, { timeoutMs = 120_000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data } = await axios.get(`${BASE_URL}/${containerId}`, {
      params: { fields: "status_code,status", access_token: accessToken },
    });

    if (data.status_code === "FINISHED") return data;
    if (data.status_code === "ERROR") {
      const err = new Error(data.status || "Instagram media container failed to process");
      err.igContainerStatus = data;
      throw err;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Timed out waiting for Instagram media container to finish processing");
}

/**
 * Publishes a ready container to the account's feed.
 * POST /{ig-id}/media_publish
 */
async function publishIgContainer(igId, accessToken, creationId) {
  const { data } = await axios.post(`${BASE_URL}/${igId}/media_publish`, null, {
    params: { creation_id: creationId, access_token: accessToken },
  });
  return data; // { id: "<ig_media_id>" }
}

/**
 * THE ONE REMAINING URL SEAM — Instagram's container API only accepts
 * `image_url` for photo posts; unlike video/Reels, there is no binary
 * upload path for IG images (confirmed against Meta's current Content
 * Publishing docs). This app's public API still only ever accepts binary
 * from the client — this function is the internal bridge that takes a
 * device-uploaded image buffer and makes it briefly reachable at a URL
 * so Meta can fetch it.
 *
 * Intentionally left unimplemented: wire this to whichever object
 * storage this app uses (S3, Cloudinary, GCS, Firebase Storage, etc).
 * Upload `buffer`, return a URL Meta's servers can reach, and optionally
 * expire/delete the object once the post is published.
 */
async function uploadBufferToPublicUrl(_buffer, _filename, _mimetype) {
  throw new Error(
    "uploadBufferToPublicUrl() is not implemented — Instagram image posts require a public image_url on Meta's side. " +
      "Wire this function up to your object storage (S3/Cloudinary/GCS/etc) to unblock IG image posts."
  );
}

module.exports = {
  GRAPH_VERSION,
  BASE_URL,
  resolveDateRange,
  chunkDateRange,
  graphBatch,
  seriesFromInsight,
  mergeSeries,
  safeNum,
  engagementRate,
  fetchIgReachTimeSeries,
  fetchAllIgMediaInRange,
  igInsightMetricsFor,
  // publishing
  publishFacebookText,
  publishFacebookPhoto,
  publishFacebookVideo,
  publishFacebookReel,
  createIgMediaContainer,
  createIgResumableContainer,
  uploadIgResumableBinary,
  pollIgContainerStatus,
  publishIgContainer,
  uploadBufferToPublicUrl,
};