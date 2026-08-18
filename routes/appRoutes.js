const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authToken");

const { getInsights } = require("../controllers/appController");

router.get("/get-insights", verifyToken, getInsights);

module.exports = router;