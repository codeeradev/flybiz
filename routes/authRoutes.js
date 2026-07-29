const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authToken");
const upload = require("../middleware/multer");

const { sendOtp, verifyOtp, getProfile, updateProfile, businessCategory } = require("../controllers/authController");

router.post("/send-otp", sendOtp);
router.post("/login", verifyOtp);

router.post("/update-profile", verifyToken, upload, updateProfile);
router.get("/get-profile", verifyToken, getProfile)
router.get("/get-business-category", businessCategory)

module.exports = router;
