const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    businessName: { type: String },
    googleBusinessName: { type: String },
    googleConnected: { type: Boolean, default: false },
    tokenExpiry: { type: Date },
    lastGoogleSync: { type: Date },
    gstNumber: { type: String },
    companyLogo: { type: String },
    email: { type: String },
    mobileNumber: { type: String },
    address: { type: String },
    website: { type: String },

    googleUserId: String,
    googleUserName: String,
    googleEmail: String,
    googleProfileImage: String,
    googlePlaceId: String,
    googleAccountId: String,
    googleLocationId: String,
    googleLocations: [
      {
        googleLocationId: String,
        googleBusinessName: String,
        googlePlaceId: String,
      },
    ],
    accessToken: String,
    refreshToken: String,

    averageRating: Number,
    totalReviews: Number,
  },
  { timestamps: true },
);

module.exports = mongoose.model("business", businessSchema);
