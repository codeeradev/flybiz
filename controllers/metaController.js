const User = require("../models/user");

const axios = require("axios");

const BASE_URL = "https://graph.facebook.com/v19.0";

const USER_TOKEN = process.env.USER_ACCESS_TOKEN;

/*
GET FACEBOOK CONNECT
*/

exports.connectFacebook = async (req, res) => {
  const APP_ID = process.env.META_APP_ID;
  const REDIRECT_URI = process.env.META_REDIRECT_URI;
console.log("req.user", req.user)
  const state = req.user.toString();
  console.log("state", state)
  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
  ].join(",");

  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code&state=${state}`;

  res.json({ url });
};

/*
GET FACEBOOK CONNECT
*/

exports.facebookCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

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
console.log("state", state)
    const userId = state;
console.log("userId", userId)
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

exports.getPages = async (req, res) => {
  try {
    const user = await User.findById(req.user).select("facebookUserToken");

    if (!user?.facebookUserToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook not connected",
      });
    }

    const { data } = await axios.get(
      "https://graph.facebook.com/v23.0/me/accounts",
      {
        params: {
          fields:
            "id,name,category,picture{url},access_token,followers_count,fan_count,instagram_business_account{id,username}",
          access_token: user.facebookUserToken,
        },
      },
    );

    return res.json({
      success: true,
      pages: data.data,
    });
  } catch (err) {
    console.log(err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err.response?.data?.error?.message || "Server Error",
    });
  }
};

exports.savePage = async (req, res) => {
  try {
    const { pageId } = req.body;

    const user = await User.findById(req.user).select("facebookUserToken");

    if (!user?.facebookUserToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook not connected",
      });
    }

    const { data: page } = await axios.get(
      `https://graph.facebook.com/v23.0/${pageId}`,
      {
        params: {
          fields: [
            "id",
            "name",
            "category",
            "picture{url}",
            "access_token",
            "instagram_business_account{id,username}",
          ].join(","),

          access_token: user.facebookUserToken,
        },
      },
    );

    let instagram = null;

    if (page.instagram_business_account?.id) {
      const { data } = await axios.get(
        `https://graph.facebook.com/v23.0/${page.instagram_business_account.id}`,
        {
          params: {
            fields:
              "id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website",

            access_token: page.access_token,
          },
        },
      );

      instagram = data;
    }

    await User.findByIdAndUpdate(req.user, {
      facebookPageId: page.id,
      facebookPageName: page.name,
      facebookPageCategory: page.category,
      facebookPagePicture: page.picture?.data?.url,
      facebookPageToken: page.access_token,

      instagramId: instagram?.id || null,
      instagramUsername: instagram?.username || null,
      instagramName: instagram?.name || null,
      instagramProfilePicture: instagram?.profile_picture_url || null,
    });

    return res.json({
      success: true,
      message: "Page Connected",

      facebook: {
        id: page.id,
        name: page.name,
        picture: page.picture?.data?.url,
        category: page.category,
      },

      instagram,
    });
  } catch (err) {
    console.log(err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err.response?.data?.error?.message || "Server Error",
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user).select(
      "facebookPageId facebookPageToken instagramId",
    );

    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook page not connected",
      });
    }

    const pagePromise = axios.get(`${BASE_URL}/${user.facebookPageId}`, {
      params: {
        fields: [
          "id",
          "name",
          "username",
          "picture{url}",
          "fan_count",
          "followers_count",
          "verification_status",
          "category",
          "category_list",
          "about",
          "link",
          "website",
        ].join(","),
        access_token: user.facebookPageToken,
      },
    });

    let instagramPromise = null;

    if (user.instagramId) {
      instagramPromise = axios.get(`${BASE_URL}/${user.instagramId}`, {
        params: {
          fields: [
            "id",
            "username",
            "name",
            "profile_picture_url",
            "followers_count",
            "follows_count",
            "media_count",
            "biography",
            "website",
          ].join(","),
          access_token: user.facebookPageToken,
        },
      });
    }

    const [pageRes, igRes] = await Promise.all([pagePromise, instagramPromise]);

    return res.json({
      success: true,

      facebook: pageRes?.data || null,

      instagram: igRes?.data || null,
    });
  } catch (err) {
    console.log(err.response?.data || err);

    return res.status(500).json({
      success: false,
      message: err.response?.data?.error?.message || "Server Error",
    });
  }
};
