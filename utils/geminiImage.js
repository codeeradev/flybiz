const https = require("https");
const { URL } = require("url");

const DEFAULT_TIMEOUT_MS = 30000;
const GEMINI_FLASH_IMAGE_MODEL_ID = "gemini-2.5-flash-image";

const buildRequestBody = (prompt) => ({
  contents: [
    {
      parts: [{ text: prompt }],
    },
  ],
});

const extractImageBase64 = (payload) => {
  const parts = payload?.candidates?.flatMap(
    (candidate) => candidate?.content?.parts || [],
  );

  for (const part of parts || []) {
    const imageBytes = part?.inlineData?.data || part?.inline_data?.data;
    if (typeof imageBytes === "string") {
      return imageBytes;
    }
  }

  return null;
};

const requestJson = (urlString, body, appKey, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const requestBody = JSON.stringify(body);

    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          "x-goog-api-key": appKey,
        },
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

          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
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

    req.write(requestBody);
    req.end();
  });
};

const generateGeminiImage = async ({ prompt }) => {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    const error = new Error("Prompt is required");
    error.statusCode = 400;
    throw error;
  }

  const appKey = process.env.GEMINI_API_KEY;
  if (!appKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.statusCode = 500;
    throw error;
  }

  const timeoutMs = Number(process.env.IMAGEN_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_FLASH_IMAGE_MODEL_ID}:generateContent`;
  const response = await requestJson(
    apiUrl,
    buildRequestBody(prompt.trim()),
    appKey,
    timeoutMs,
  );
  const imageBase64 = extractImageBase64(response);

  if (!imageBase64) {
    const error = new Error("Gemini response did not include image data");
    error.statusCode = 502;
    error.providerResponse = response;
    throw error;
  }

  return imageBase64;
};

module.exports = {
  generateGeminiImage,
};
