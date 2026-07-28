const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = "assets/uploads";

// auto-create folder
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ---------------- Existing Disk Upload ----------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage }).fields([
  { name: "image", maxCount: 1 },
  { name: "companyLogo", maxCount: 1 },
  { name: "bannerImage", maxCount: 2 },
  { name: "csv", maxCount: 1 },
]);

// ---------------- Facebook Upload (Memory) ----------------

upload.facebook = multer({
  storage: multer.memoryStorage(),
}).fields([
  { name: "file", maxCount: 1 },
]);

module.exports = upload;