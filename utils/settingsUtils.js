const Setting = require("../models/setting");

const SETTINGS_FILTER = { key: "default" };

const getSettings = async () => {
  let setting = await Setting.findOne(SETTINGS_FILTER);

  if (!setting) {
    setting = await Setting.create(SETTINGS_FILTER);
  }

  return setting;
};

module.exports = {
  getSettings,
};
