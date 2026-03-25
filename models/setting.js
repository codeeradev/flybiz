const mongoose = require("mongoose");

const providerAuthSchema = new mongoose.Schema(
  {
    appKey: {
      type: String,
      default: "",
    },
    authKey: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "default",
      unique: true,
    },
    auth: {
      whatsapp: {
        type: providerAuthSchema,
        default: () => ({
          appKey: "",
          authKey: "",
        }),
      },
      sms: {
        type: providerAuthSchema,
        default: () => ({
          appKey: "",
          authKey: "",
        }),
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("setting", settingSchema);
