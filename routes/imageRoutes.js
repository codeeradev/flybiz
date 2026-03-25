const express = require("express");
const router = express.Router();

const { generateImage } = require("../controllers/imageController");

router.post("/image", generateImage);

module.exports = router;
