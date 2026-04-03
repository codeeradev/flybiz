const Business = require("../models/business");
const { createOAuth2Client } = require("./googleAuth");

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const syncStoredTokens = async (business, authClient, accessTokenResponse) => {
  const latestAccessToken =
    authClient.credentials?.access_token ||
    accessTokenResponse?.token ||
    accessTokenResponse;
  const latestRefreshToken = authClient.credentials?.refresh_token;

  let shouldSave = false;

  if (latestAccessToken && latestAccessToken !== business.accessToken) {
    business.accessToken = latestAccessToken;
    shouldSave = true;
  }

  if (latestRefreshToken && latestRefreshToken !== business.refreshToken) {
    business.refreshToken = latestRefreshToken;
    shouldSave = true;
  }

  if (shouldSave) {
    await business.save();
  }
};

const getValidAuthClient = async (userId) => {
  const business = await Business.findOne({ userId });

  if (!business) {
    throw createError(404, "Business not found");
  }

  if (!business.accessToken && !business.refreshToken) {
    throw createError(400, "Google account is not connected");
  }

  const authClient = createOAuth2Client();

  authClient.setCredentials({
    access_token: business.accessToken || undefined,
    refresh_token: business.refreshToken || undefined,
  });

  try {
    const accessTokenResponse = await authClient.getAccessToken();
    await syncStoredTokens(business, authClient, accessTokenResponse);
  } catch (error) {
    console.error("Failed to refresh Google access token:", error.message);
    throw createError(
      401,
      "Google authentication expired. Please reconnect your Google account",
    );
  }

  return authClient;
};

module.exports = { getValidAuthClient };
