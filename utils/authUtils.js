const validator = require("validator");

const OtpModel = require("../models/otp");

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : value;

const normalizeEmail = (email) => {
  const value = normalizeString(email);
  return value ? value.toLowerCase() : null;
};

const normalizeMobileNumber = (mobileNumber) => {
  const value = normalizeString(mobileNumber);
  return value || null;
};

const isValidEmail = (email) => validator.isEmail(email);

const isValidMobileNumber = (mobileNumber) =>
  validator.isMobilePhone(mobileNumber, "any", {
    strictMode: true,
  });

const getUploadedFilePath = (file) =>
  file?.filename ? `/assets/uploads/${file.filename}` : null;

const createOtpForMobile = async (mobileNumber) => {
  const otp = Math.floor(100000 + Math.random() * 900000);

  await OtpModel.deleteMany({ mobileNumber });
  await OtpModel.create({
    mobileNumber,
    otp: String(otp),
    expiresAt: Date.now() + 2 * 60 * 1000,
  });

  return String(otp);
};

module.exports = {
  createOtpForMobile,
  getUploadedFilePath,
  isValidEmail,
  isValidMobileNumber,
  normalizeEmail,
  normalizeMobileNumber,
  normalizeString,
};
