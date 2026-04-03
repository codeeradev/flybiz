const { google } = require("googleapis");

const ANALYTICS_METRICS = ["WEBSITE_CLICKS", "CALL_CLICKS"];

const normalizeLocationId = (locationId) => {
  if (!locationId) {
    return null;
  }

  const value = locationId.toString().trim();

  if (value.includes("/locations/")) {
    return value.split("/locations/").pop().split("/")[0];
  }

  if (value.startsWith("locations/")) {
    return value.replace("locations/", "").split("/")[0];
  }

  return value;
};

const normalizeReviewName = (reviewId, locationId) => {
  const rawReviewId = reviewId.toString().trim();

  if (rawReviewId.includes("/reviews/")) {
    return rawReviewId;
  }

  const normalizedLocationId = normalizeLocationId(locationId);
  const normalizedReviewId = rawReviewId.replace(/^reviews\//, "");

  return `accounts/-/locations/${normalizedLocationId}/reviews/${normalizedReviewId}`;
};

const serializeDate = (date) => {
  if (!date?.year || !date?.month || !date?.day) {
    return null;
  }

  return [
    date.year.toString().padStart(4, "0"),
    date.month.toString().padStart(2, "0"),
    date.day.toString().padStart(2, "0"),
  ].join("-");
};

const serializeJsDate = (date) =>
  serializeDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });

const buildDateRange = (days) => {
  const endDate = new Date();
  const startDate = new Date(endDate);

  startDate.setUTCDate(endDate.getUTCDate() - (days - 1));

  return {
    startDate,
    endDate,
    params: {
      "dailyRange.startDate.year": startDate.getUTCFullYear(),
      "dailyRange.startDate.month": startDate.getUTCMonth() + 1,
      "dailyRange.startDate.day": startDate.getUTCDate(),
      "dailyRange.endDate.year": endDate.getUTCFullYear(),
      "dailyRange.endDate.month": endDate.getUTCMonth() + 1,
      "dailyRange.endDate.day": endDate.getUTCDate(),
    },
  };
};

const formatMetricSeries = (metricTimeSeries) => {
  const series = (metricTimeSeries?.timeSeries?.datedValues || []).map(
    (entry) => ({
      date: serializeDate(entry.date),
      value: Number(entry.value || 0),
    }),
  );

  return {
    total: series.reduce((sum, entry) => sum + entry.value, 0),
    series,
  };
};

const getLocations = async (auth) => {
  const businessInfo = google.mybusinessbusinessinformation({
    version: "v1",
    auth,
  });

  const response = await businessInfo.accounts.locations.list({
    parent: "accounts/-",
  });

  return response.data.locations || [];
};

const getReviews = async (auth, locationId) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const mybusiness = google.mybusiness({
    version: "v4", // still used for reviews (no new API yet)
    auth,
  });

  const response = await mybusiness.accounts.locations.reviews.list({
    parent: `accounts/-/locations/${normalizedLocationId}`,
  });

  return response.data.reviews || [];
};

const updateReviewReply = async (auth, locationId, reviewId, reply) => {
  const mybusiness = google.mybusiness({
    version: "v4",
    auth,
  });

  await mybusiness.accounts.locations.reviews.updateReply({
    name: normalizeReviewName(reviewId, locationId),
    requestBody: {
      comment: reply,
    },
  });
};

const fetchGoogleInsights = async (auth, locationId, days = 30) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const { startDate, endDate, params } = buildDateRange(days);
  const businessPerformance = google.businessprofileperformance({
    version: "v1",
    auth,
  });

  const response =
    await businessPerformance.locations.fetchMultiDailyMetricsTimeSeries({
      location: `locations/${normalizedLocationId}`,
      dailyMetrics: ANALYTICS_METRICS,
      ...params,
    });

  const metrics = {};

  for (const metricGroup of response.data.multiDailyMetricTimeSeries || []) {
    for (const metricTimeSeries of metricGroup.dailyMetricTimeSeries || []) {
      if (!metricTimeSeries.dailyMetric) {
        continue;
      }

      metrics[metricTimeSeries.dailyMetric] = formatMetricSeries(
        metricTimeSeries,
      );
    }
  }

  return {
    locationId: normalizedLocationId,
    dateRange: {
      start: serializeJsDate(startDate),
      end: serializeJsDate(endDate),
      days,
    },
    metrics,
    summary: {
      websiteClicks: metrics.WEBSITE_CLICKS?.total || 0,
      callClicks: metrics.CALL_CLICKS?.total || 0,
    },
  };
};

module.exports = {
  fetchGoogleInsights,
  getLocations,
  getReviews,
  normalizeLocationId,
  updateReviewReply,
};
