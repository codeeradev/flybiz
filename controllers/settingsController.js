const { getSettings } = require("../utils/settingsUtils");

const buildSettingsResponse = (setting) => {
  const whatsapp = setting.auth?.whatsapp || {};
  const sms = setting.auth?.sms || {};

  return {
    auth: {
      whatsapp: {
        appKey: whatsapp.appKey || "",
        authKey: whatsapp.authKey || "",
      },
      sms: {
        appKey: sms.appKey || "",
        authKey: sms.authKey || "",
      },
    },
  };
};

exports.getSettings = async (req, res) => {
  try {
    const setting = await getSettings();

    return res.status(200).json(buildSettingsResponse(setting));
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error fetching settings",
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { auth = {} } = req.body;
    const { whatsapp = {}, sms = {} } = auth;
    const {
      appKey: whatsappappKey = "",
      authKey: whatsappAuthKey = "",
    } = whatsapp;
    const {
      appKey: smsappKey = "",
      authKey: smsAuthKey = "",
    } = sms;

    const setting = await getSettings();

    setting.auth = {
      whatsapp: {
        appKey: whatsappappKey || "",
        authKey: whatsappAuthKey || "",
      },
      sms: {
        appKey: smsappKey || "",
        authKey: smsAuthKey || "",
      },
    };

    await setting.save();

    return res.status(200).json(buildSettingsResponse(setting));
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating settings",
    });
  }
};
