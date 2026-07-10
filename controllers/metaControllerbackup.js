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
  const state = req.user._id.toString();
  const scope = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    "instagram_basic",
    "read_insights",
    "business_management",
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
    const userId = state;
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

    console.log("user", user);

    if (!user?.facebookUserToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook not connected",
      });
    }
    console.log("user.facebookUserToken", user.facebookUserToken);
    const { data } = await axios.get(
      "https://graph.facebook.com/v25.0/me/accounts",
      {
        params: {
          fields:
            "id,name,category,picture{url},access_token,followers_count,fan_count,instagram_business_account{id,username}",
          access_token: user.facebookUserToken,
        },
      },
    );
    console.log("data", data);
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
      `https://graph.facebook.com/v25.0/${pageId}`,
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
        `https://graph.facebook.com/v25.0/${page.instagram_business_account.id}`,
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
      "facebookPageId facebookPageToken instagramId"
    );

    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({
        success: false,
        message: "Facebook Page not connected",
      });
    }

    // Facebook Page
    const pagePromise = axios.get(
      `${BASE_URL}/${user.facebookPageId}`,
      {
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
            "instagram_business_account"
          ].join(","),
          access_token: user.facebookPageToken,
        },
      }
    );

    // Instagram Business
    let instagramPromise = Promise.resolve({ data: null });

    if (user.instagramId) {
      instagramPromise = axios.get(
        `${BASE_URL}/${user.instagramId}`,
        {
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
              "website"
            ].join(","),
            access_token: user.facebookPageToken,
          },
        }
      );
    }

    const [pageRes, igRes] = await Promise.all([
      pagePromise,
      instagramPromise,
    ]);

    return res.json({
      success: true,
      facebook: pageRes.data,
      instagram: igRes.data,
    });
  } catch (err) {
    console.log(err.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err.response?.data?.error?.message || "Internal Server Error",
    });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const { period = "days_28" } = req.query;

    const user = await User.findById(req.user).select(
      "facebookPageId facebookPageToken instagramId"
    );

    if (!user?.facebookPageId || !user?.facebookPageToken) {
      return res.status(400).json({
        success: false,
        message: "Page not connected",
      });
    }

    // ================= FACEBOOK =================

    const pageInfoPromise = axios.get(
      `${BASE_URL}/${user.facebookPageId}`,
      {
        params: {
          fields: "id,name,fan_count,followers_count",
          access_token: user.facebookPageToken,
        },
      }
    );

    const pageInsightsPromise = axios.get(
      `${BASE_URL}/${user.facebookPageId}/insights`,
      {
        params: {
          metric: [
            "page_impressions",
            "page_impressions_unique",
            "page_post_engagements",
          ].join(","),
          period,
          access_token: user.facebookPageToken,
        },
      }
    );

    const postsPromise = axios.get(
      `${BASE_URL}/${user.facebookPageId}/posts`,
      {
        params: {
          summary: true,
          limit: 1,
          access_token: user.facebookPageToken,
        },
      }
    );

    // ================= INSTAGRAM =================

    let igProfilePromise = Promise.resolve({ data: null });
    let igInsightsPromise = Promise.resolve({ data: null });

    if (user.instagramId) {
      igProfilePromise = axios.get(
        `${BASE_URL}/${user.instagramId}`,
        {
          params: {
            fields:
              "followers_count,follows_count,media_count",
            access_token: user.facebookPageToken,
          },
        }
      );

      igInsightsPromise = axios.get(
        `${BASE_URL}/${user.instagramId}/insights`,
        {
          params: {
            metric: "reach,impressions",
            period,
            access_token: user.facebookPageToken,
          },
        }
      );
    }

    const [
      pageInfo,
      pageInsights,
      posts,
      igProfile,
      igInsights,
    ] = await Promise.all([
      pageInfoPromise,
      pageInsightsPromise,
      postsPromise,
      igProfilePromise,
      igInsightsPromise,
    ]);

    const fbInsights = {};

    pageInsights.data.data.forEach((item) => {
      fbInsights[item.name] =
        item.values?.[0]?.value || 0;
    });

    const igInsightMap = {};

    if (igInsights.data?.data) {
      igInsights.data.data.forEach((item) => {
        igInsightMap[item.name] =
          item.values?.[0]?.value || 0;
      });
    }

    return res.json({
      success: true,

      facebook: {
        followers: pageInfo.data.followers_count || 0,
        likes: pageInfo.data.fan_count || 0,
        reach:
          fbInsights.page_impressions_unique || 0,
        impressions:
          fbInsights.page_impressions || 0,
        engagement:
          fbInsights.page_post_engagements || 0,
        posts:
          posts.data.summary?.total_count ||
          posts.data.data.length,
      },

      instagram: {
        followers:
          igProfile.data?.followers_count || 0,
        following:
          igProfile.data?.follows_count || 0,
        media:
          igProfile.data?.media_count || 0,
        reach:
          igInsightMap.reach || 0,
        impressions:
          igInsightMap.impressions || 0,
      },

      combined: {
        followers:
          (pageInfo.data.followers_count || 0) +
          (igProfile.data?.followers_count || 0),

        reach:
          (fbInsights.page_impressions_unique || 0) +
          (igInsightMap.reach || 0),

        impressions:
          (fbInsights.page_impressions || 0) +
          (igInsightMap.impressions || 0),
      },
    });
  } catch (err) {
    console.log(err.response?.data || err);

    return res.status(500).json({
      success: false,
      message:
        err.response?.data?.error?.message ||
        "Server Error",
    });
  }
};