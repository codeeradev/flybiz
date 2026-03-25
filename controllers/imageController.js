const { generateGeminiImage } = require("../utils/geminiImage");

exports.generateImage = async (req, res) => {
  try {
    const { prompt } = req.body || {};

    const imageBase64 = await generateGeminiImage({
      prompt,
    });

    return res.status(200).json({ imageBase64 });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    const responsePayload = {
      message: error.message || "Image generation failed",
    };

    if (error.providerResponse) {
      responsePayload.providerResponse = error.providerResponse;
    }

    return res.status(statusCode).json(responsePayload);
  }
};
