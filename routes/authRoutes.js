const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authToken");
const upload = require("../middleware/multer");

const { Login, register, verifyOtp, getProfile, updateProfile } = require("../controllers/authController");

router.post("/login", Login);
router.post("/register", upload, register);
router.post("/verify-otp", verifyOtp);

router.post("/update-profile", verifyToken, upload, updateProfile);
router.get("/get-profile", verifyToken, getProfile)

module.exports = router;
