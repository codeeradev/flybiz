const express = require("express");
const router = express.Router();

const upload = require("../middleware/multer");

const { Login, register, verifyOtp } = require("../controllers/authController");

router.post("/login", Login);
router.post("/register", upload, register);
router.post("/verify-otp", verifyOtp);


module.exports = router;
