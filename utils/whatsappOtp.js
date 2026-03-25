const OtpModel = require("../models/otp");
const { createOtpForMobile } = require("./authUtils");
const { getSettings } = require("./settingsUtils");

const OTP_PLACEHOLDER_TEST_REGEX = /{{\s*otp\s*}}/i;
const OTP_PLACEHOLDER_REPLACE_REGEX = /{{\s*otp\s*}}/gi;
const DEFAULT_OTP_TEMPLATE =
  "Your FlyBiz OTP is {{otp}}. It is valid for 2 minutes.";
const WHATSAPP_API_URL = "https://msggo.in/api/create-message";

const buildOtpMessage = (template, otp) => {
  const baseTemplate = template || DEFAULT_OTP_TEMPLATE;

  if (!OTP_PLACEHOLDER_TEST_REGEX.test(baseTemplate)) {
    return `${baseTemplate} ${otp}`;
  }

  return baseTemplate.replace(OTP_PLACEHOLDER_REPLACE_REGEX, otp);
};

const sendWhatsappOtp = async (mobileNumber) => {
  const settings = await getSettings();
  const appKey = settings.auth?.whatsapp?.appKey;
  const authKey = settings.auth?.whatsapp?.authKey;

  if (!appKey || !authKey) {
    throw new Error("WhatsApp auth keys are missing in settings");
  }

  const otp = await createOtpForMobile(mobileNumber);
  const formData = new FormData();

  formData.append("appkey", appKey);
  formData.append("authkey", authKey);
  formData.append("to", mobileNumber);
  formData.append(
    "message",
    buildOtpMessage(DEFAULT_OTP_TEMPLATE, otp),
  );

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      body: formData,
    });
    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `WhatsApp API request failed with status ${response.status}: ${
          responseBody || "Unknown error"
        }`,
      );
    }

    console.log(responseBody);
    return {
      channel: "whatsapp",
      providerResponse: responseBody,
    };
  } catch (error) {
    await OtpModel.deleteMany({ mobileNumber });
    throw new Error(`Failed to send WhatsApp OTP: ${error.message}`);
  }
};

module.exports = {
  sendWhatsappOtp,
};
