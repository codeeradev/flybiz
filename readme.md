var request = require('request');
var options = {
  'method': 'POST',
  'url': 'https://msggo.in/api/create-message',
  'headers': {
  },
  formData: {
    'appKey': '85c6089c-432b-48c5-8d6e-9c503d83c1a2',
    'authkey': 'YrmCnPjzHrjytYkePVujJzvAIKYk9QM3lxJKRerJ9XTOq0uQnx',
    'to': 'RECEIVER_NUMBER',
    'message': 'Example message'
  }
};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});


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
