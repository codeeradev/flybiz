const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    businessName: { type: String },
    gstNumber: { type: String },
    companyLogo: { type: String },
    email: { type: String },
    mobileNumber: { type: String },
    address: { type: String },
    website: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("business", businessSchema);
