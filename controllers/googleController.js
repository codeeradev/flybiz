const Business = require("../models/business");
const User = require("../models/user");

const {
  getAuthUrl,
  getGoogleProfile,
  getTokens,
  verifyAuthState,
} = require("../utils/googleAuth");
const { getValidAuthClient } = require("../utils/googleClient");
const {
  fetchGoogleInsights,
  getLocations,
  getAccounts,
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

  // const business = await Business.findOne({
  //   _id: "69bd23ae5ddb4bc3728de422",
  // });

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

exports.checkGoogleStatus = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const business = await getBusinessForUser(userId);

    const user = await User.findById(userId);

    return res.json({
      metaConnected: Boolean(user?.facebookUserToken?.trim()),

      googleConnected: business.googleConnected || false,
      googleBusinessName: business.googleBusinessName || "",
      googleUserId: business.googleUserId || "",
      googleUserName: business.googleUserName || "",
      googleEmail: business.googleEmail || "",
      googleProfileImage: business.googleProfileImage || "",
    });
  } catch (error) {
    return handleGoogleError(res, error);
  }
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
    const { type } = req.query;
    const userId = getUserIdFromRequest(req);
    const business = await getBusinessForUser(userId);

    const auth = await getValidAuthClient(userId);

    // First time only
    if (!business.googleAccountId) {
      const accounts = await getAccounts(auth);

      if (!accounts.length) {
        throw createError(404, "No Google Business Account Found");
      }

      business.googleAccountId = accounts[0].name.split("/")[1];
      await business.save();
    }

    // Use DB only when refresh is NOT requested
    // and DB already has locations.
    if (type !== "refresh" && business.googleLocations.length > 0) {
      return res.json(
        business.googleLocations.map((location) => ({
          name: `locations/${location.googleLocationId}`,
          title: location.googleBusinessName,
          metadata: {
            placeId: location.googlePlaceId,
          },
          locationId: location.googleLocationId,
        })),
      );
    }

    // Either:
    // 1. type === "refresh"
    // OR
    // 2. DB is empty
    // => Fetch from Google
    const locations = await getLocations(auth, business.googleAccountId);

    // Save latest locations
    if (locations.length) {
      business.googleLocations = locations.map((location) => ({
        googleLocationId: normalizeLocationId(location.name),
        googleBusinessName: location.title,
        googlePlaceId: location.metadata?.placeId || "",
      }));

      await business.save();
    }

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
    const profile = await getGoogleProfile(tokens);

    console.log(profile);
    const business = await getBusinessForUser(userId);

    if (!tokens.access_token && !tokens.refresh_token) {
      throw createError(400, "Google did not return any usable tokens");
    }

    console.log("Tokens received:", tokens);
    if (tokens.refresh_token) {
      business.refreshToken = tokens.refresh_token;
    }

    if (tokens.access_token) {
      business.accessToken = tokens.access_token;
    }

    business.googleUserId = profile.id;
    business.googleUserName = profile.name;
    business.googleEmail = profile.email;
    business.googleProfileImage = profile.picture;
    business.googleConnected = true;

    await business.save();

    return res.redirect("flybiz://google-connected");
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

    const selectedLocation = business.googleLocations.find(
      (location) => location.googleLocationId === locationId,
    );

    if (!selectedLocation) {
      throw createError(404, "Location not found");
    }

    business.googleLocationId = selectedLocation.googleLocationId;
    business.googleBusinessName = selectedLocation.googleBusinessName;
    business.googlePlaceId = selectedLocation.googlePlaceId;
    business.googleConnected = true;
    business.lastGoogleSync = new Date();

    await business.save();

    return res.json({
      message: "Location connected successfully",
      locationId: business.googleLocationId,
      businessName: business.googleBusinessName,
      placeId: business.googlePlaceId,
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

exports.getActiveBusinesses = async (req, res) => {
  try {
    const activeBusinesses = await Business.find({
      // accessToken: { $exists: true, $ne: null },
      googleAccountId: { $exists: true, $ne: null },
      googleLocationId: { $exists: true, $ne: null },
    });

    return res.status(200).json({ activeBusinesses: activeBusinesses });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};

exports.googleSignOut = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const business = await getBusinessForUser(userId);

    business.googleConnected = false;

    business.googleBusinessName = null;

    business.googleUserId = null;
    business.googleUserName = null;
    business.googleEmail = null;
    business.googleProfileImage = null;

    business.googlePlaceId = null;
    business.googleAccountId = null;
    business.googleLocationId = null;

    business.googleLocations = [];

    business.accessToken = null;
    business.refreshToken = null;

    business.tokenExpiry = null;
    business.lastGoogleSync = null;

    business.averageRating = null;
    business.totalReviews = null;

    await business.save();

    return res.json({
      message: "Google account disconnected successfully",
    });
  } catch (error) {
    return handleGoogleError(res, error);
  }
};
