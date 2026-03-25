const fs = require("fs/promises");
const path = require("path");

const FALLBACK_CONFIG = {
  image: {
    filePath: path.join(__dirname, "..", "assets", "dummy1.jpeg"),
    mimeType: "image/jpeg",
    responseKey: "imageBase64",
  },
  video: {
    filePath: path.join(__dirname, "..", "assets", "dummy.webm"),
    mimeType: "video/webm",
    responseKey: "videoBase64",
  },
};

const REQUEST_TYPE_FIELDS = [
  "type",
  "mediaType",
  "generationType",
  "requestType",
  "outputType",
  "contentType",
];

const VIDEO_KEYWORDS =
  /\b(video|reel|animate|animated|animation|clip|movie|footage|film|trailer|teaser|shorts|short-form|motion)\b/i;

const IMAGE_KEYWORDS =
  /\b(image|photo|photograph|picture|poster|flyer|banner|thumbnail|logo|illustration|artwork|portrait|wallpaper)\b/i;

const fallbackCache = new Map();

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const parseStructuredValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(parseStructuredValue);
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return value;
  }

  if (
    (trimmedValue.startsWith("{") && trimmedValue.endsWith("}")) ||
    (trimmedValue.startsWith("[") && trimmedValue.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmedValue);
    } catch (error) {
      return value;
    }
  }

  if (trimmedValue === "true") {
    return true;
  }

  if (trimmedValue === "false") {
    return false;
  }

  return value;
};

const getRequestedTypeHint = (body = {}, routePath = "") => {
  if (routePath.toLowerCase().includes("/video")) {
    return "video";
  }

  for (const fieldName of REQUEST_TYPE_FIELDS) {
    const fieldValue = normalizeString(body?.[fieldName]).toLowerCase();

    if (fieldValue.includes("video")) {
      return "video";
    }

    if (fieldValue.includes("image")) {
      return "image";
    }
  }

  const mimeType = normalizeString(body?.mimeType).toLowerCase();
  if (mimeType.startsWith("video/")) {
    return "video";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return null;
};

const detectRequestedMediaType = ({ prompt, body, routePath }) => {
  const explicitType = getRequestedTypeHint(body, routePath);
  if (explicitType) {
    return explicitType;
  }

  if (VIDEO_KEYWORDS.test(prompt)) {
    return "video";
  }

  if (IMAGE_KEYWORDS.test(prompt)) {
    return "image";
  }

  return "image";
};

const normalizeUploadedFile = (file) => ({
  fieldName: file.fieldname,
  originalName: file.originalname,
  mimeType: file.mimetype,
  size: file.size,
  storedPath: file.filename
    ? `/assets/uploads/${file.filename}`
    : null,
});

const buildRequestContext = (req) => {
  const body = req.body || {};
  const prompt = normalizeString(body.prompt);

  if (!prompt) {
    const error = new Error("Prompt is required");
    error.statusCode = 400;
    throw error;
  }

  const parameters = Object.entries(body).reduce((accumulator, [key, value]) => {
    if (key === "prompt") {
      return accumulator;
    }

    accumulator[key] = parseStructuredValue(value);
    return accumulator;
  }, {});

  const files = Array.isArray(req.files)
    ? req.files.map(normalizeUploadedFile)
    : [];

  const mediaType = detectRequestedMediaType({
    prompt,
    body,
    routePath: req.path || "",
  });

  return {
    prompt,
    mediaType,
    // Extra request data is accepted for now but not processed until real AI generation is added.
    parameters,
    files,
  };
};

const getFallbackMedia = async (mediaType) => {
  const config = FALLBACK_CONFIG[mediaType] || FALLBACK_CONFIG.image;

  if (!fallbackCache.has(mediaType)) {
    const fileBuffer = await fs.readFile(config.filePath);

    fallbackCache.set(mediaType, {
      mimeType: config.mimeType,
      fileName: path.basename(config.filePath),
      responseKey: config.responseKey,
      base64: fileBuffer.toString("base64"),
    });
  }

  return fallbackCache.get(mediaType);
};

const buildFallbackResponse = async ({ mediaType }) => {
  const fallbackMedia = await getFallbackMedia(mediaType);

  return {
    mediaType,
    message: `Returning dummy ${mediaType} output until AI generation is configured`,
    mimeType: fallbackMedia.mimeType,
    [fallbackMedia.responseKey]: fallbackMedia.base64,
  };
};

module.exports = {
  buildFallbackResponse,
  buildRequestContext,
  detectRequestedMediaType,
};
