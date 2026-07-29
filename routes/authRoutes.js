const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authToken");
const upload = require("../middleware/multer");

const { sendOtp, verifyOtp, getProfile, updateProfile } = require("../controllers/authController");

router.post("/send-otp", sendOtp);
router.post("/login", verifyOtp);

router.post("/update-profile", verifyToken, upload, updateProfile);
router.get("/get-profile", verifyToken, getProfile)

module.exports = router;
