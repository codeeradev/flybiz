const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobileNumber: String,
  otp: String,
  expiresAt: Date,
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("otp", otpSchema);
