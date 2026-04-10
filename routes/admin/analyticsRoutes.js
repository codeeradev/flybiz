const express = require("express");
const verifyAdminToken = require("../../middleware/isAdmin");
const {
  getAdminAnalytics,
} = require("../../controllers/admin/analyticsController");

const router = express.Router();

router.get("/", verifyAdminToken, getAdminAnalytics);

module.exports = router;
