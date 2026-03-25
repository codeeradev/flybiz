const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    mobileNumber: { type: String },
    email: { type: String },
    name: { type: String },
    image: { type: String },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "business",
      default: null,
    },
    registrationStep: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("user", userSchema);
