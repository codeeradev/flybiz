const fs = require("fs/promises");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_VIDEO_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_VIDEO_POLL_INTERVAL_MS = 10000;
const GEMINI_FLASH_IMAGE_MODEL_ID = "gemini-2.5-flash-image";
const GEMINI_VIDEO_MODEL_ID = "veo-3.1-generate-preview";

const normalizeFiles = (files) => (Array.isArray(files) ? files : []);

const resolveUploadedFilePath = (file) => {
  if (file?.path) {
    return path.isAbsolute(file.path)
      ? file.path
      : path.join(__dirname, "..", file.path);
  }

  if (file?.destination && file?.filename) {
    const relativePath = path.join(file.destination, file.filename);

    return path.isAbsolute(relativePath)
      ? relativePath
      : path.join(__dirname, "..", relativePath);
  }

  return null;
};

const readImageInlineData = async (file) => {
  if (!file?.mimetype || !file.mimetype.startsWith("image/")) {
    return null;
  }

  const filePath = resolveUploadedFilePath(file);
  if (!filePath) {
    return null;
  }

  const fileBuffer = await fs.readFile(filePath);

  return {
    mimeType: file.mimetype,
    data: fileBuffer.toString("base64"),
  };
};

const buildImageRequestBody = async (prompt, files = []) => {
  const parts = [{ text: prompt }];

  for (const file of normalizeFiles(files)) {
    const inlineData = await readImageInlineData(file);

    if (!inlineData) {
      continue;
    }

    parts.push({
      inline_data: {
        mime_type: inlineData.mimeType,
        data: inlineData.data,
      },
    });
  }

  return {
    contents: [
      {
        parts,
      },
    ],
  };
};

const inferImageMimeTypeFromBase64 = (base64Data) => {
  if (typeof base64Data !== "string" || !base64Data) {
    return null;
  }

  try {
    const fileBuffer = Buffer.from(base64Data, "base64");

    if (
      fileBuffer.length >= 3 &&
      fileBuffer[0] === 0xff &&
      fileBuffer[1] === 0xd8 &&
      fileBuffer[2] === 0xff
    ) {
      return "image/jpeg";
    }

    if (
      fileBuffer.length >= 8 &&
      fileBuffer[0] === 0x89 &&
      fileBuffer[1] === 0x50 &&
      fileBuffer[2] === 0x4e &&
      fileBuffer[3] === 0x47 &&
      fileBuffer[4] === 0x0d &&
      fileBuffer[5] === 0x0a &&
      fileBuffer[6] === 0x1a &&
      fileBuffer[7] === 0x0a
    ) {
      return "image/png";
    }

    if (
      fileBuffer.length >= 6 &&
      fileBuffer.toString("ascii", 0, 6).startsWith("GIF8")
    ) {
      return "image/gif";
    }

    if (
      fileBuffer.length >= 12 &&
      fileBuffer.toString("ascii", 0, 4) === "RIFF" &&
      fileBuffer.toString("ascii", 8, 12) === "WEBP"
    ) {
      return "image/webp";
    }
  } catch (error) {
    return null;
  }

  return null;
};

const extractImageInlineData = (payload) => {
  const parts = payload?.candidates?.flatMap(
    (candidate) => candidate?.content?.parts || [],
  );

  for (const part of parts || []) {
    const inlineData = part?.inlineData || part?.inline_data;
    const imageBytes = inlineData?.data;

    if (typeof imageBytes === "string") {
      return {
        imageBase64: imageBytes,
        mimeType:
          inlineData?.mimeType ||
          inlineData?.mime_type ||
          inferImageMimeTypeFromBase64(imageBytes),
      };
    }
  }

  return null;
};

const extractVideoUrl = (payload) =>
  payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
  payload?.response?.generateVideoResponse?.generatedVideos?.[0]?.video?.uri ||
  payload?.response?.generatedVideos?.[0]?.video?.uri ||
  null;

const requestJson = ({ urlString, method = "POST", body, appKey, timeoutMs }) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const requestBody = body ? JSON.stringify(body) : null;
    const headers = {
      "x-goog-api-key": appKey,
    };

    if (requestBody) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(requestBody);
    }

    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          let parsed;
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (error) {
            const parseError = new Error(
              "Gemini API returned invalid JSON response",
            );
            parseError.statusCode = res.statusCode || 502;
            parseError.rawResponse = data;
            reject(parseError);
            return;
          }

          if (
            res.statusCode &&
            (res.statusCode < 200 || res.statusCode >= 300)
          ) {
            const requestError = new Error(
              parsed?.error?.message ||
                parsed?.message ||
                "Gemini API request failed",
            );
            requestError.statusCode = res.statusCode;
            requestError.providerResponse = parsed;
            reject(requestError);
            return;
          }

          resolve(parsed);
        });
      },
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("Gemini API request timed out"));
    });

    if (requestBody) {
      req.write(requestBody);
    }

    req.end();
  });
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const validatePrompt = (prompt) => {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    const error = new Error("Prompt is required");
    error.statusCode = 400;
    throw error;
  }
};

const getGeminiApiKey = () => {
  const appKey = process.env.GEMINI_API_KEY;
  if (!appKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.statusCode = 500;
    throw error;
  }

  return appKey;
};

const buildVideoRequestBody = async (prompt, files = []) => {
  const instances = [{ prompt }];
  const imageInputs = [];

  for (const file of normalizeFiles(files)) {
    const inlineData = await readImageInlineData(file);

    if (inlineData) {
      imageInputs.push(inlineData);
    }
  }

  if (imageInputs[0]) {
    instances[0].image = {
      inlineData: imageInputs[0],
    };
  }

  if (imageInputs.length > 1) {
    instances[0].referenceImages = imageInputs.slice(1, 4).map((inlineData) => ({
      image: {
        inlineData,
      },
      referenceType: "asset",
    }));
  }

  return { instances };
};

const generateGeminiImage = async ({ prompt, files = [] }) => {
  validatePrompt(prompt);

  const appKey = getGeminiApiKey();
  const timeoutMs =
    Number(process.env.IMAGEN_TIMEOUT_MS) || DEFAULT_REQUEST_TIMEOUT_MS;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FLASH_IMAGE_MODEL_ID}:generateContent`;
  const response = await requestJson(
    {
      urlString: apiUrl,
      body: await buildImageRequestBody(prompt.trim(), files),
      appKey,
      timeoutMs,
    },
  );
  const imageData = extractImageInlineData(response);

  if (!imageData?.imageBase64) {
    const error = new Error("Gemini response did not include image data");
    error.statusCode = 502;
    error.providerResponse = response;
    throw error;
  }

  return imageData;
};

const generateGeminiVideo = async ({ prompt, files = [] }) => {
  validatePrompt(prompt);

  const appKey = getGeminiApiKey();
  const requestTimeoutMs =
    Number(process.env.VEO_REQUEST_TIMEOUT_MS) || DEFAULT_REQUEST_TIMEOUT_MS;
  const generationTimeoutMs =
    Number(process.env.VEO_TIMEOUT_MS) || DEFAULT_VIDEO_TIMEOUT_MS;
  const pollIntervalMs =
    Number(process.env.VEO_POLL_INTERVAL_MS) ||
    DEFAULT_VIDEO_POLL_INTERVAL_MS;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VIDEO_MODEL_ID}:predictLongRunning`;

  let operation = await requestJson({
    urlString: apiUrl,
    body: await buildVideoRequestBody(prompt.trim(), files),
    appKey,
    timeoutMs: requestTimeoutMs,
  });

  if (!operation?.name) {
    const error = new Error("Gemini video generation did not return an operation");
    error.statusCode = 502;
    error.providerResponse = operation;
    throw error;
  }

  const statusUrl = `https://generativelanguage.googleapis.com/v1beta/${operation.name}`;
  const deadline = Date.now() + generationTimeoutMs;

  while (!operation.done) {
    if (Date.now() >= deadline) {
      const error = new Error("Gemini video generation timed out");
      error.statusCode = 504;
      error.providerResponse = operation;
      throw error;
    }

    await sleep(pollIntervalMs);

    operation = await requestJson({
      urlString: statusUrl,
      method: "GET",
      appKey,
      timeoutMs: requestTimeoutMs,
    });
  }

  if (operation?.error) {
    const error = new Error(
      operation.error.message || "Gemini video generation failed",
    );
    error.statusCode = 502;
    error.providerResponse = operation;
    throw error;
  }

  const videoUrl = extractVideoUrl(operation);

  if (!videoUrl) {
    const error = new Error("Gemini video response did not include a video URL");
    error.statusCode = 502;
    error.providerResponse = operation;
    throw error;
  }

  return videoUrl;
};

module.exports = {
  generateGeminiImage,
  generateGeminiVideo,
};
