const User = require("../models/user");

const axios = require("axios");

const BASE_URL = "https://graph.facebook.com/v19.0";

const USER_TOKEN = process.env.USER_ACCESS_TOKEN;

/*
GET FACEBOOK PAGES
*/
exports.getPages = async (req, res) => {
  try {
    const user = await User.findById(req.user);

    const response = await axios.get(`${BASE_URL}/me/accounts`, {
      params: {
        access_token: user.facebookUserToken,
      },
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || error.message);
  }
};

exports.connectFacebook = async (req, res) => {
  const APP_ID = process.env.META_APP_ID;
  const REDIRECT_URI = process.env.META_REDIRECT_URI;

  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
  ].join(",");

  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code`;

  res.json({ url });
};

exports.facebookCallback = async (req, res) => {
  try {
    const { code } = req.query;

    const APP_ID = process.env.META_APP_ID;
    const APP_SECRET = process.env.META_APP_SECRET;
    const REDIRECT_URI = process.env.META_REDIRECT_URI;

    const response = await axios.get(
      `https://graph.facebook.com/v19.0/oauth/access_token`,
      {
        params: {
          client_id: APP_ID,
          client_secret: APP_SECRET,
          redirect_uri: REDIRECT_URI,
          code: code,
        },
      },
    );

    const userAccessToken = response.data.access_token;

    const userId = req.user;

    await User.findByIdAndUpdate(userId, {
      facebookUserToken: userAccessToken,
    });

    res.json({
      message: "Facebook connected successfully",
      user_access_token: userAccessToken,
    });
  } catch (error) {
    console.log("Error in facebook callback:", error);
    res.status(500).json({ message: "Error in facebook callback" });
  }
};

exports.getUserPages = async (req, res) => {
  const { access_token } = req.body;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/me/accounts`,
      {
        params: {
          access_token: access_token,
        },
      },
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || error.message);
  }
};

exports.savePage = async (req, res) => {
  try {
    const userId = req.user;
    const { pageId, pageToken } = req.body;

    await User.findByIdAndUpdate(userId, {
      facebookPageId: pageId,
      facebookPageToken: pageToken,
    });

    res.json({
      message: "Page connected successfully",
    });
  } catch (error) {
    res.status(500).json(error.message);
  }
};

exports.getInstagramFromPage = async (req, res) => {
  const { pageId, pageToken } = req.body;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${pageId}`,
      {
        params: {
          fields: "instagram_business_account{id,username}",
          access_token: pageToken,
        },
      },
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response?.data || error.message);
  }
};

exports.saveInstagram = async (req, res) => {
  try {
    const userId = req.user;
    const { instagramId } = req.body;

    await User.findByIdAndUpdate(userId, {
      instagramId: instagramId,
    });

    res.json({
      message: "Instagram connected",
    });
  } catch (error) {
    res.status(500).json(error.message);
  }
};
