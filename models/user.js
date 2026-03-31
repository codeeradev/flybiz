const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    mobileNumber: { type: String },
    email: { type: String },
    name: { type: String },
    image: { type: String },
    password: { type: String },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "business",
      default: null,
    },
    registrationStep: {
      type: Number,
      default: 1,
    },
    facebookUserToken: {
      type: String,
      default: null,
    },

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    
    facebookPageId: {
      type: String,
      default: null,
    },

    facebookPageToken: {
      type: String,
      default: null,
    },

    instagramId: {
      type: String,
      default: null,
    },

    instagramUsername: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("user", userSchema);
