const jwt = require("jsonwebtoken");
const { google } = require("googleapis");

const GOOGLE_BUSINESS_SCOPE =
  "https://www.googleapis.com/auth/business.manage";
const GOOGLE_STATE_PURPOSE = "google-oauth-connect";

const createError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const getStateSecret = () =>
  process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.JWT_SECRET;

const createOAuth2Client = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw createError(500, "Google OAuth is not configured correctly");
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
};

const signAuthState = (userId) => {
  const stateSecret = getStateSecret();

  if (!stateSecret) {
    throw createError(500, "Google OAuth state secret is not configured");
  }

  return jwt.sign(
    {
      purpose: GOOGLE_STATE_PURPOSE,
      userId: userId.toString(),
    },
    stateSecret,
    {
      expiresIn: process.env.GOOGLE_OAUTH_STATE_TTL || "1h",
    },
  );
};

const verifyAuthState = (state) => {
  if (!state) {
    throw createError(400, "Missing Google OAuth state");
  }

  const stateSecret = getStateSecret();

  if (!stateSecret) {
    throw createError(500, "Google OAuth state secret is not configured");
  }

  let payload;

  try {
    payload = jwt.verify(state, stateSecret);
  } catch (error) {
    throw createError(400, "Invalid or expired Google OAuth state");
  }

  if (payload.purpose !== GOOGLE_STATE_PURPOSE || !payload.userId) {
    throw createError(400, "Invalid Google OAuth state");
  }

  return {
    userId: payload.userId.toString(),
  };
};

const getAuthUrl = (userId) => {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_BUSINESS_SCOPE],
    state: signAuthState(userId),
  });
};

const getTokens = async (code) => {
  if (!code) {
    throw createError(400, "Missing Google authorization code");
  }

  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  return tokens;
};

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  getTokens,
  verifyAuthState,
};
