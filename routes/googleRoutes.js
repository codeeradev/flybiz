const express = require("express");
const router = express.Router();

const {
  connectGoogle,
  getAnalytics,
  getLocations,
  getReviews,
  googleCallback,
  replyToReview,
  selectLocation,
} = require("../controllers/googleController");
const verifyToken = require("../middleware/authToken");

router.get("/connect", verifyToken, connectGoogle);
router.get("/callback", googleCallback);
router.get("/locations", verifyToken, getLocations);
router.post("/location", verifyToken, selectLocation);
router.get("/reviews", verifyToken, getReviews);
router.post("/reviews/reply", verifyToken, replyToReview);
router.get("/analytics", verifyToken, getAnalytics);

module.exports = router;
