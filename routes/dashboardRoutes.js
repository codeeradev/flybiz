const express = require("express");
const verifyToken = require("../middleware/authToken");
const {
  getweeklyAnalytics,
  getPlans,
  getRecentPosts,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/analytics", verifyToken, getweeklyAnalytics);
router.get("/getRecentPosts", verifyToken, getRecentPosts);
router.get("/plans", getPlans);

module.exports = router;
