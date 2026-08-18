const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authToken");

const { getInsights } = require("../controllers/appController");

router.post("/send-otp", sendOtp);
router.post("/login", verifyOtp);

router.post("/update-profile", verifyToken, getInsights);

module.exports = router;