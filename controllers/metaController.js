const User = require("../models/user");
const axios = require("axios");

const {
  BASE_URL,
  resolveDateRange,
  graphBatch,
  seriesFromInsight,
  mergeSeries,
  safeNum,
  engagementRate,
  fetchIgReachTimeSeries,
  fetchAllIgMediaInRange,
  igInsightMetricsFor,
} = require("../utils/metaGraphapi.js");

const cache = require("../utils/metaCache.js");

/* ================================================================== */
/*  OAUTH: CONNECT / CALLBACK                                          */
/* ================================================================== */

exports.connectFacebook = async (req, res) => {
  const APP_ID = process.env.META_APP_ID;
  const REDIRECT_URI = process.env.META_REDIRECT_URI;
  const state = req.user._id.toString();

  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    "pages_messaging", // required for the Page Messages / Unread Messages KPI cards
    "instagram_basic",
    "read_insights",
    "business_management",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
  ].join(",");

  const url = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code&state=${state}`;

  res.json({ success: true, url });
};

exports.facebookCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const APP_ID = process.env.META_APP_ID;
    const APP_SECRET = process.env.META_APP_SECRET;
    const REDIRECT_URI = process.env.META_REDIRECT_URI;

    // Step 1: exchange the auth code for a short-lived user token (~1-2 hrs).
    const shortLived = await axios.get(`${BASE_URL}/oauth/access_token`, {
      params: { client_id: APP_ID, client_secret: APP_SECRET, redirect_uri: REDIRECT_URI, code },
    });

    // Step 2: exchange it for a long-lived user token (~60 days). The Page
    // token we derive from this in savePage() effectively never expires as
    // long as it's derived from a long-lived user token — skipping this step
    // is the #1 reason Meta integrations silently break after a day or two.
    const longLived = await axios.get(`${BASE_URL}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        fb_exchange_token: shortLived.data.access_token,
      },
    });

    await User.findByIdAndUpdate(state, { facebookUserToken: longLived.data.access_token });

    // Access token intentionally NOT returned to the client — it never needs
    // to leave the server once stored against the user.
    return res.redirect("flybiz://meta-connected");
  } catch (error) {
    console.log("Error in facebook callback:", error.response?.data || error);
    res.status(500).json({ success: false, message: "Error in facebook callback" });
  }
};

/* ================================================================== */
/*  PAGES: LIST / SAVE                                                 */
/* ================================================================== */

exports.getPages = async (req, res) => {
  try {
    const user = await User.findById(req.user).select("facebookUserToken");
    if (!user?.facebookUserToken) {
      return res.status(400).json({ success: false, message: "Facebook not connected" });
    }

    const { data } = await axios.get(`${BASE_URL}/me/accounts`, {
      params: {
        fields:
          "id,name,category,picture{url},access_token,followers_count,fan_count,instagram_business_account{id,username,profile_picture_url}",
        access_token: user.facebookUserToken,
      },
    });

    return res.json({ success: true, pages: data.data });
  } catch (err) {
    console.log(err.response?.data || err);
    return res.status(500).json({ success: false, message: err.response?.data?.error?.message || "Server Error" });
  }
};

exports.savePage = async (req, res) => {
  try {
    const { pageId } = req.body;
    const user = await User.findById(req.user).select("facebookUserToken");
    if (!user?.facebookUserToken) {
      return res.status(400).json({ success: false, message: "Facebook not connected" });
    }

    const { data: page } = await axios.get(`${BASE_URL}/${pageId}`, {
      params: {
        fields: ["id", "name", "category", "picture{url}", "access_token", "instagram_business_account{id,username}"].join(","),
        access_token: user.facebookUserToken,
      },
    });

    let instagram = null;
    if (page.instagram_business_account?.id) {
      const { data } = await axios.get(`${BASE_URL}/${page.instagram_business_account.id}`, {
        params: {
          fields: "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website",
          access_token: page.access_token,
        },
      });
      instagram = data;
    }

    await User.findByIdAndUpdate(req.user, {
      facebookPageId: page.id,
      facebookPageName: page.name,
      facebookPageCategory: page.category,
      facebookPagePicture: page.picture?.data?.url,
      facebookPageToken: page.access_token,
      facebookConnectedAt: new Date(),

      instagramId: instagram?.id || null,
      instagramUsername: instagram?.username || null,
      instagramName: instagram?.name || null,
      instagramProfilePicture: instagram?.profile_picture_url || null,
    });

    return res.json({
      success: true,
      message: "Page Connected",
      facebook: { id: page.id, name: page.name, picture: page.picture?.data?.url, category: page.category },
      instagram,
    });
  } catch (err) {
    console.log(err.response?.data || err);
    return res.status(500).json({ success: false, message: err.response?.data?.error?.message || "Server Error" });
  }
};

exports.disconnectMeta = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user, {
      $unset: {
        facebookUserToken: "",
        facebookPageId: "",
        facebookPageName: "",
        facebookPageCategory: "",
        facebookPagePicture: "",
        facebookPageToken: "",
        facebookConnectedAt: "",
        instagramId: "",
        instagramUsername: "",
        instagramName: "",
        instagramProfilePicture: "",
      },
    });
    return res.json({ success: true, message: "Meta account disconnected" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

/* ================================================================== */
/*  PROFILE — powers the header card (name, badges, connected date)    */
/* ================================================================== */

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user).select(
      "facebookPageId facebookPageToken facebookPageName facebookPageCategory facebookPagePicture facebookConnectedAt instagramId instagramUsername"
    );

    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({ success: false, message: "Facebook Page not connected" });
    }

    const pagePromise = axios.get(`${BASE_URL}/${user.facebookPageId}`, {
      params: {
        fields: [
          "id",
          "name",
          "picture{url}",
          "category",
          "about",
          "description",
          "website",
          "link",
          "phone",
          "emails",
          "location",
          "fan_count",
          "followers_count",
          "verification_status",
          "instagram_business_account",
        ].join(","),
        access_token: user.facebookPageToken,
      },
    });

    let igPromise = Promise.resolve({ data: null });
    if (user.instagramId) {
      igPromise = axios.get(`${BASE_URL}/${user.instagramId}`, {
        params: {
          fields: "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website",
          access_token: user.facebookPageToken,
        },
      });
    }

    const [pageRes, igRes] = await Promise.all([pagePromise, igPromise]);

    return res.json({
      success: true,
      facebook: pageRes.data,
      instagram: igRes.data,
      isActive: true,
      connectedAt: user.facebookConnectedAt || null,
    });
  } catch (err) {
    console.log(err.response?.data || err);
    return res.status(500).json({ success: false, message: err.response?.data?.error?.message || "Internal Server Error" });
  }
};

/* ================================================================== */
/*  DASHBOARD OVERVIEW — KPI cards + the 4 trend charts, one call      */
/* ================================================================== */
/*
  GET /meta/dashboard?period=30d&platform=combined
  period:   7d | 30d | 90d   (default 30d)
  platform: combined | facebook | instagram   (default combined)

  Cost: 1 batched HTTP round trip covering Page info + Page insights +
  Page posts (for like/comment counts) + IG account info + IG media list.
  IG account-level `reach` is a 2nd (chunked) call because metric_type=
  time_series only accepts ~30-day since/until windows, unlike the 90-day
  window Page Insights allows — batching it in would force the whole
  request down to 30 days even when the caller asked for 90d.

  --- v25.0 METRIC CHANGES (see utils/metaGraphapi.js header comment) ---
  page_impressions*        -> page_media_view
  page_impressions_unique* -> page_total_media_view_unique
  page_fans                -> page_follows
*/
exports.getDashboardOverview = async (req, res) => {
  try {
    const { period = "30d", platform = "combined" } = req.query;
    const user = await User.findById(req.user).select(
      "facebookPageId facebookPageToken instagramId instagramUsername"
    );

    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({ success: false, message: "Page not connected" });
    }

    const cacheKey = cache.memoKey("overview", user.facebookPageId, period, platform);
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const { since, until, sinceUnix, untilUnix } = resolveDateRange(period);
    const token = user.facebookPageToken;

    const includeFacebook = platform === "combined" || platform === "facebook";
    const includeInstagram = (platform === "combined" || platform === "instagram") && !!user.instagramId;

    const batchRequests = [];
    const refs = {};
    const addRef = (name, relativeUrl) => {
      refs[name] = batchRequests.push({ relativeUrl }) - 1;
    };

    if (includeFacebook) {
      addRef("pageInfo", `${user.facebookPageId}?fields=id,name,fan_count,followers_count`);
      addRef(
        "pageInsights",
        `${user.facebookPageId}/insights?metric=${[
          "page_media_view",
          "page_total_media_view_unique",
          "page_post_engagements",
          "page_follows",
        ].join(",")}&period=day&since=${sinceUnix}&until=${untilUnix}`
      );
      addRef(
        "pagePosts",
        `${user.facebookPageId}/posts?fields=${[
          "id",
          "likes.summary(true).limit(0)",
          "comments.summary(true).limit(0)",
        ].join(",")}&since=${sinceUnix}&until=${untilUnix}&limit=100`
      );
    }

    if (includeInstagram) {
      addRef("igInfo", `${user.instagramId}?fields=followers_count,follows_count,media_count`);
      addRef(
        "igMedia",
        `${user.instagramId}/media?fields=${["id", "media_product_type", "timestamp", "like_count", "comments_count"].join(
          ","
        )}&limit=50`
      );
    }

    const batchResults = await graphBatch(batchRequests, token);
    const warnings = [];
    const readBatch = (name) => {
      const idx = refs[name];
      if (idx === undefined) return null;
      const r = batchResults[idx];
      if (!r?.ok) {
        warnings.push(`${name}: ${r?.body?.error?.message || "request failed"}`);
        return null;
      }
      return r.body;
    };

    // ---------------- Facebook ----------------
    const fb = {
      followers: 0,
      totalFollowers: 0,
      reach: 0,
      impressions: 0,
      engagement: 0,
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      followersSeries: [],
      reachSeries: [],
      engagementSeries: [],
      impressionsSeries: [],
    };

    if (includeFacebook) {
      const pageInfo = readBatch("pageInfo");
      const pageInsights = readBatch("pageInsights");
      const pagePosts = readBatch("pagePosts");

      fb.totalFollowers = safeNum(pageInfo?.followers_count ?? pageInfo?.fan_count);

      if (pageInsights?.data) {
        const byName = {};
        pageInsights.data.forEach((m) => (byName[m.name] = m.values || []));

        const impressions = seriesFromInsight(byName.page_media_view, "sum");
        const reach = seriesFromInsight(byName.page_total_media_view_unique, "sum");
        const engagement = seriesFromInsight(byName.page_post_engagements, "sum");
        const follows = seriesFromInsight(byName.page_follows, "last");
        const followsFirst = byName.page_follows?.[0]?.value ?? follows.total;

        fb.impressions = impressions.total;
        fb.reach = reach.total;
        fb.engagement = engagement.total;
        fb.followers = safeNum(follows.total - followsFirst); // net change across the period
        fb.followersSeries = (byName.page_follows || []).map((v) => ({
          date: (v.end_time || "").slice(0, 10),
          value: safeNum(v.value),
        }));
        fb.reachSeries = reach.series;
        fb.engagementSeries = engagement.series;
        fb.impressionsSeries = impressions.series;
      }

      if (pagePosts?.data) {
        fb.totalPosts = pagePosts.data.length;
        fb.totalLikes = pagePosts.data.reduce((s, p) => s + safeNum(p.likes?.summary?.total_count), 0);
        fb.totalComments = pagePosts.data.reduce((s, p) => s + safeNum(p.comments?.summary?.total_count), 0);
      }
    }

    // ---------------- Instagram ----------------
    const ig = {
      followers: 0,
      totalFollowers: 0,
      reach: 0,
      impressions: 0,
      engagement: 0,
      totalPosts: 0,
      totalReels: 0,
      totalLikes: 0,
      totalComments: 0,
      reachSeries: [],
    };

    if (includeInstagram) {
      const igInfo = readBatch("igInfo");
      const igMedia = readBatch("igMedia");
      ig.totalFollowers = safeNum(igInfo?.followers_count);

      if (igMedia?.data) {
        const inRange = igMedia.data.filter((m) => new Date(m.timestamp) >= since);
        ig.totalPosts = inRange.length;
        ig.totalReels = inRange.filter((m) => m.media_product_type === "REELS").length;
        ig.totalLikes = inRange.reduce((s, m) => s + safeNum(m.like_count), 0);
        ig.totalComments = inRange.reduce((s, m) => s + safeNum(m.comments_count), 0);
        ig.engagement = ig.totalLikes + ig.totalComments;
      }

      // IG account-level `reach` (metric_type=time_series) is fetched
      // outside the batch and chunked into <=30-day windows internally —
      // this is what used to throw "cannot be more than 30 days between
      // since and until" whenever period=90d was requested.
      try {
        const reachSeries = await fetchIgReachTimeSeries(user.instagramId, token, sinceUnix, untilUnix);
        ig.reach = reachSeries.reduce((s, p) => s + safeNum(p.value), 0);
        ig.reachSeries = reachSeries;
      } catch (e) {
        warnings.push(`igInsights: ${e.response?.data?.error?.message || "unavailable for this account"}`);
      }
    }

    const combined = {
      followers: fb.followers + ig.followers,
      totalFollowers: fb.totalFollowers + ig.totalFollowers,
      reach: fb.reach + ig.reach,
      impressions: fb.impressions + ig.impressions,
      engagement: fb.engagement + ig.engagement,
      totalPosts: fb.totalPosts + ig.totalPosts,
      totalLikes: fb.totalLikes + ig.totalLikes,
      totalReels: ig.totalReels,
      totalComments: fb.totalComments + ig.totalComments,
    };

    const trends = {
      followersGrowth: mergeSeries(fb.followersSeries, []),
      reach: mergeSeries(fb.reachSeries, ig.reachSeries),
      engagement: mergeSeries(fb.engagementSeries, []),
      impressions: mergeSeries(fb.impressionsSeries, []),
    };

    const payload = {
      success: true,
      period: { key: period, since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) },
      platform,
      kpis: combined,
      facebook: fb,
      instagram: ig,
      trends,
      warnings,
    };

    cache.set(cacheKey, payload, 5 * 60_000);
    return res.json(payload);
  } catch (err) {
    console.log(err.response?.data || err);
    return res.status(500).json({ success: false, message: err.response?.data?.error?.message || "Server Error" });
  }
};

// Backward-compatible alias for the old route name.
exports.getDashboard = exports.getDashboardOverview;

/* ================================================================== */
/*  POSTS TABLE + TOP PERFORMING POSTS + REELS                         */
/* ================================================================== */
/*
  GET /meta/dashboard/posts?period=30d&platform=combined&page=1&limit=20

  Facebook post insights are pulled inline via field expansion
  (`insights.metric(...)`) — one call gets every post AND its stats
  together, instead of one call per post. Instagram doesn't support that
  trick, so IG media insights are fetched in a single batch call covering
  all media at once.

  --- v25.0 METRIC CHANGES ---
  post_impressions*        -> post_media_view
  post_impressions_unique* -> post_total_media_view_unique
  post_engaged_users dropped in favor of summing likes + comments + shares
  directly from Graph object fields (not an Insights metric, so it's not
  at risk of a future deprecation silently breaking the whole batch).

  IG media: `impressions`/`plays` are gone; `views` + `total_interactions`
  are the v25 replacements (see igInsightMetricsFor in metaGraphapi.js).
*/
exports.getDashboardPosts = async (req, res) => {
  try {
    const { period = "30d", platform = "combined", page = 1, limit = 20 } = req.query;
    const user = await User.findById(req.user).select("facebookPageId facebookPageToken instagramId");

    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({ success: false, message: "Page not connected" });
    }

    const { since, sinceUnix, untilUnix } = resolveDateRange(period);
    const token = user.facebookPageToken;
    const cacheKey = cache.memoKey("posts", user.facebookPageId, period, platform);

    let unified = cache.get(cacheKey);

    if (!unified) {
      unified = [];

      // ---- Facebook posts (1 call, insights inline) ----
      if (platform === "combined" || platform === "facebook") {
        const { data } = await axios.get(`${BASE_URL}/${user.facebookPageId}/posts`, {
          params: {
            fields: [
              "id",
              "message",
              "created_time",
              "full_picture",
              "permalink_url",
              "likes.summary(true).limit(0)",
              "comments.summary(true).limit(0)",
              "shares",
              "insights.metric(post_media_view,post_total_media_view_unique)",
            ].join(","),
            since: sinceUnix,
            until: untilUnix,
            limit: 100,
            access_token: token,
          },
        });

        (data.data || []).forEach((p) => {
          const byName = {};
          (p.insights?.data || []).forEach((m) => (byName[m.name] = safeNum(m.values?.[0]?.value)));

          const likes = safeNum(p.likes?.summary?.total_count);
          const comments = safeNum(p.comments?.summary?.total_count);
          const shares = safeNum(p.shares?.count);
          const reach = byName.post_total_media_view_unique || 0;
          const impressions = byName.post_media_view || 0;
          const engaged = likes + comments + shares;

          unified.push({
            id: p.id,
            platform: "facebook",
            thumbnail: p.full_picture || null,
            caption: p.message || null,
            link: p.permalink_url || null,
            postedAt: p.created_time,
            isReel: false,
            likes,
            comments,
            shares,
            reach,
            impressions,
            engagement: engaged,
            engagementRate: engagementRate(engaged, reach || impressions),
          });
        });
      }

      // ---- Instagram media (paginated fetch, then 1 batch call for insights) ----
      if ((platform === "combined" || platform === "instagram") && user.instagramId) {
        const igPosts = await fetchAllIgMediaInRange(user.instagramId, token, since);

        if (igPosts.length) {
          const insightRequests = igPosts.map((m) => ({
            relativeUrl: `${m.id}/insights?metric=${igInsightMetricsFor(m.media_product_type)}`,
          }));
          const insightResults = await graphBatch(insightRequests, token);

          igPosts.forEach((m, i) => {
            const body = insightResults[i]?.ok ? insightResults[i].body : null;
            const byName = {};
            (body?.data || []).forEach((row) => (byName[row.name] = safeNum(row.values?.[0]?.value)));

            const likes = safeNum(m.like_count);
            const comments = safeNum(m.comments_count);
            const reach = byName.reach || 0;
            const views = byName.views || 0;
            const engaged =
              byName.total_interactions || likes + comments + (byName.shares || 0) + (byName.saved || 0);

            unified.push({
              id: m.id,
              platform: "instagram",
              thumbnail: m.thumbnail_url || m.media_url || null,
              caption: m.caption || null,
              link: m.permalink || null,
              postedAt: m.timestamp,
              isReel: m.media_product_type === "REELS",
              plays: m.media_product_type === "REELS" ? views : undefined,
              likes,
              comments,
              reach,
              impressions: views || reach, // IG `impressions` is deprecated; `views` (or reach) is the closest available proxy
              engagement: engaged,
              engagementRate: engagementRate(engaged, reach),
            });
          });
        }
      }

      unified.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
      cache.set(cacheKey, unified, 5 * 60_000);
    }

    const topPosts = [...unified].sort((a, b) => b.engagement - a.engagement).slice(0, 5);
    const reels = unified.filter((u) => u.isReel);

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, parseInt(limit, 10) || 20);
    const start = (p - 1) * l;

    return res.json({
      success: true,
      period,
      platform,
      total: unified.length,
      page: p,
      limit: l,
      posts: unified.slice(start, start + l),
      topPosts,
      reels,
    });
  } catch (err) {
    console.log(err.response?.data || err);
    return res.status(500).json({ success: false, message: err.response?.data?.error?.message || "Server Error" });
  }
};

/* ================================================================== */
/*  MESSAGES — Page Messages / Unread Messages KPI cards                */
/* ================================================================== */
/*
  Separate endpoint because it needs the `pages_messaging` permission,
  which is a distinct App Review item from analytics/insights. Degrades
  to zeros with `messagingEnabled:false` instead of breaking the rest of
  the dashboard if that permission hasn't been granted/approved yet.

  Not affected by the Insights metric deprecations — this uses the
  `conversations` edge, not `/insights`.
*/
exports.getDashboardMessages = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const user = await User.findById(req.user).select("facebookPageId facebookPageToken");
    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({ success: false, message: "Page not connected" });
    }

    const { since } = resolveDateRange(period);

    const { data } = await axios.get(`${BASE_URL}/${user.facebookPageId}/conversations`, {
      params: { fields: "id,updated_time,unread_count,message_count", limit: 100, access_token: user.facebookPageToken },
    });

    const conversations = data.data || [];
    const inRange = conversations.filter((c) => new Date(c.updated_time) >= since);
    const unreadMessages = conversations.reduce((s, c) => s + safeNum(c.unread_count), 0);

    return res.json({ success: true, period, pageMessages: inRange.length, unreadMessages, messagingEnabled: true });
  } catch (err) {
    console.log(err.response?.data || err);
    // Missing `pages_messaging` permission (not yet granted/approved) — degrade gracefully.
    return res.json({
      success: true,
      pageMessages: 0,
      unreadMessages: 0,
      messagingEnabled: false,
      message: err.response?.data?.error?.message || "Messaging insights unavailable",
    });
  }
};