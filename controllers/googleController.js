const Business = require("../models/business");
const {
  getAuthUrl,
  getTokens,
  verifyAuthState,
} = require("../utils/googleAuth");
const { getValidAuthClient } = require("../utils/googleClient");
const {
  fetchGoogleInsights,
  getLocations,
  getReviews,
  normalizeLocationId,
  updateReviewReply,
} = require("../services/googleBusinessService");
const { analyzeReviews } = require("../utils/analyticsService");

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const handleGoogleError = (res, error) => {
  console.error(error);

  return res.status(error.status || 500).json({
    message: error.message || "An error occurred",
  });
};

const getUserIdFromRequest = (req) => {
  const userId = req.user?._id?.toString() || req.user?.id;

  if (!userId) {
    throw createError(401, "Unauthorized");
  }

  return userId;
};

const getBusinessForUser = async (userId) => {
  const business = await Business.findOne({
    userId,
  });

  if (!business) {
    throw createError(404, "Business not found");
  }

  return business;
};

const requireSelectedLocation = (business) => {
  if (!business.googleLocationId) {
    throw createError(
      400,
      "Please select a Google business location before using this action",
    );
  }

  return business.googleLocationId;
};

const parseAnalyticsDays = (value) => {
  if (value === undefined) {
    return 30;
  }

  const days = Number(value);

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw createError(400, "days must be an integer between 1 and 365");
  }

  return days;
};

exports.connectGoogle = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    await getBusinessForUser(userId);

    console.log("Initiating Google connection for user:", userId);

    const url = getAuthUrl(userId);

    return res.json({ url });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.getLocations = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    await getBusinessForUser(userId);

    const auth = await getValidAuthClient(userId);
    const locations = await getLocations(auth);

    return res.json(
      locations.map((location) => ({
        ...location,
        locationId: normalizeLocationId(location.name),
      })),
    );
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const { userId } = verifyAuthState(state);
    const tokens = await getTokens(code);
    const business = await getBusinessForUser(userId);

    console.log("Google callback received for user:", userId);

    if (!tokens.access_token && !tokens.refresh_token) {
      throw createError(400, "Google did not return any usable tokens");
    }

    if (tokens.refresh_token) {
      business.refreshToken = tokens.refresh_token;
    }

    if (tokens.access_token) {
      business.accessToken = tokens.access_token;
    }

    await business.save();

    return res.json({ message: "Google connected" });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.selectLocation = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { locationId } = req.body;

    if (!locationId) {
      throw createError(400, "locationId is required");
    }

    const business = await getBusinessForUser(userId);
    const auth = await getValidAuthClient(userId);
    const locations = await getLocations(auth);
    const selectedLocationId = normalizeLocationId(locationId);
    const matchedLocation = locations.find(
      (location) => normalizeLocationId(location.name) === selectedLocationId,
    );

    if (!matchedLocation) {
      throw createError(
        404,
        "Selected Google location was not found for this account",
      );
    }

    business.googleLocationId = selectedLocationId;
    await business.save();

    return res.json({
      message: "Location connected",
      locationId: selectedLocationId,
      location: matchedLocation,
    });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.getReviews = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const business = await getBusinessForUser(userId);
    const locationId = requireSelectedLocation(business);
    const auth = await getValidAuthClient(userId);

    const reviews = await getReviews(auth, locationId);
    const analytics = analyzeReviews(reviews);

    return res.json({
      reviews,
      analytics,
    });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.replyToReview = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { reviewId, reply } = req.body;

    if (!reviewId) {
      throw createError(400, "reviewId is required");
    }

    if (!reply || !reply.trim()) {
      throw createError(400, "reply is required");
    }

    const business = await getBusinessForUser(userId);
    const locationId = requireSelectedLocation(business);
    const auth = await getValidAuthClient(userId);

    await updateReviewReply(auth, locationId, reviewId, reply.trim());

    return res.json({ message: "Reply posted" });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const business = await getBusinessForUser(userId);
    const locationId = requireSelectedLocation(business);
    const auth = await getValidAuthClient(userId);
    const days = parseAnalyticsDays(req.query.days);
    const analytics = await fetchGoogleInsights(auth, locationId, days);

    return res.json(analytics);
  } catch (error) {
    return handleGoogleError(res, error);
  }
};
