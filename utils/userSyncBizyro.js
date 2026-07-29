const axios = require("axios");

const syncUserWithBizyro = async (user) => {
  try {
    const response = await axios.post(
      `${process.env.BIZYRO_API_URL}/admin/integrations/flybiz/users`,
      {
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
      },
      {
        headers: {
          "x-api-key": process.env.BIZYRO_API_KEY,
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Bizyro user sync failed:",
      error.response?.data || error.message
    );

    throw error;
  }
};

module.exports = syncUserWithBizyro;