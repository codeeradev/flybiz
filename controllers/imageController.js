const fs = require("fs/promises");
const path = require("path");

const {
  generateGeminiImage,
  generateGeminiVideo,
} = require("../utils/geminiImage");

const DUMMY_IMAGE_PATH = path.join(__dirname, "..", "assets", "dummy1.jpeg");
const DUMMY_VIDEO_PATH = path.join(__dirname, "..", "assets", "dummy.webm");
let dummyImageBase64Promise;
let dummyVideoBase64Promise;

const MIME_TYPE_BY_EXTENSION = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

const getMimeTypeFromPath = (filePath) =>
  MIME_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ||
  "application/octet-stream";

const getDummyImageBase64 = async () => {
  if (!dummyImageBase64Promise) {
    dummyImageBase64Promise = fs
      .readFile(DUMMY_IMAGE_PATH)
      .then((fileBuffer) => fileBuffer.toString("base64"));
  }

  return dummyImageBase64Promise;
};

const getDummyVideoBase64 = async () => {
  if (!dummyVideoBase64Promise) {
    dummyVideoBase64Promise = fs
      .readFile(DUMMY_VIDEO_PATH)
      .then((fileBuffer) => fileBuffer.toString("base64"));
  }

  return dummyVideoBase64Promise;
};

const getGenerationType = (query = {}, body = {}) => {
  const rawType =
    query.generationType ||
    query.mediaType ||
    query.type ||
    "image";

  return typeof rawType === "string" && rawType.trim().toLowerCase() === "video"
    ? "video"
    : "image";
};

const buildDataUrl = (mimeType, base64Data) =>
  `data:${mimeType || "application/octet-stream"};base64,${base64Data}`;

exports.generateImage = async (req, res) => {
  try {
    const { prompt } = req.body || {};
    const files = Array.isArray(req.files) ? req.files : [];
    const generationType = getGenerationType(req.query);

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        message: "Prompt is required",
      });
    }

    if (generationType === "video") {
      // const videoUrl = await generateGeminiVideo({
      //   prompt,
      //   files,
      // });

      const videoBase64 = await getDummyVideoBase64();
      const videoUrl = buildDataUrl(
        getMimeTypeFromPath(DUMMY_VIDEO_PATH),
        videoBase64,
      );

      return res.status(200).json({ videoUrl });
    }

    // const { imageBase64, mimeType } = await generateGeminiImage({
    //   prompt,
    //   files,
    // });

    const imageBase64 = await getDummyImageBase64();
    const mimeType = getMimeTypeFromPath(DUMMY_IMAGE_PATH);

    return res.status(200).json({
      imageBase64: buildDataUrl(mimeType, imageBase64),
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const responsePayload = {
      message: error.message || "Media generation failed",
    };

    if (error.providerResponse) {
      responsePayload.providerResponse = error.providerResponse;
    }

    return res.status(statusCode).json(responsePayload);
  }
};
