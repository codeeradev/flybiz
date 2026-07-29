const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobileNumber: { type: String, default: null },
  email: { type: String, default: null },
  otp: String,
  expiresAt: Date,
});

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("otp", otpSchema);
