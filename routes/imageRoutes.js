const express = require("express");
const router = express.Router();

const upload = require("../middleware/aiUpload");
const { generateImage } = require("../controllers/imageController");

router.post("/image", upload, generateImage);

module.exports = router;
