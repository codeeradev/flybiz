const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Business = require("../models/business");
const OtpModel = require("../models/otp");
const sendEmailOtp = require("../config/nodemailer");
const { createOtpForMobile } = require("../utils/authUtils");

const syncUserWithBizyro = require("../utils/userSyncBizyro");

const {
  getUploadedFilePath,
  isValidEmail,
  normalizeEmail,
  normalizeString,
  createOtpForEmail,
} = require("../utils/authUtils");

exports.sendOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const query = normalizeString(req.body.query)?.toLowerCase();

    if (!email) {
      return res.status(400).json({
        status: 0,
        message: "Email is required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        status: 0,
        message: "Enter a valid email address",
      });
    }

    if (!["login", "register"].includes(query)) {
      return res.status(400).json({
        status: 0,
        message: "query must be login or register",
      });
    }

    const existingUser = await User.findOne({ email });

    // LOGIN: user must already exist
    if (query === "login" && !existingUser) {
      return res.status(200).json({
        status: 0,
        userExist: false,
        message: "User not found. Please register.",
        nextStep: "register",
      });
    }

    // REGISTER: user must NOT already exist
    if (query === "register" && existingUser) {
      return res.status(200).json({
        status: 0,
        userExist: true,
        message: "User already exists. Please login.",
        nextStep: "login",
      });
    }

    // Create OTP for EMAIL
    const otp = await createOtpForEmail(email);

    // Send OTP through email
    await sendEmailOtp(email, otp);

    return res.status(200).json({
      status: 1,
      userExist: Boolean(existingUser),
      message: "OTP sent successfully to your email",
      email,
      otpChannel: "email",
      nextStep: "verify-otp",

      // REMOVE in production
      // otp,
    });
  } catch (error) {
    console.error("Send OTP error:", error);

    return res.status(500).json({
      status: 2,
      message: "Error sending OTP",
      error,
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = normalizeString(req.body.otp);
    const type = normalizeString(req.body.type)?.toLowerCase();

    // Google login ke case me frontend se accessToken aayega
    const googleAccessToken = normalizeString(req.body.accessToken);

    if (!email) {
      return res.status(400).json({
        status: 0,
        message: "Email is required",
      });
    }

    /*
     * ==========================================
     * AUTH VERIFICATION
     * ==========================================
     */

    if (type === "google") {
      // Google flow -> OTP required nahi hai

      if (!googleAccessToken) {
        return res.status(400).json({
          status: 0,
          message: "Google access token is required",
        });
      }

      // IMPORTANT:
      // Yahan googleAccessToken ko Google se verify karna hai
      // aur verify karna hai ki token isi email ka hai.
    } else {
      // Normal Email OTP flow

      if (!isValidEmail(email)) {
        return res.status(400).json({
          status: 0,
          message: "Enter a valid email address",
        });
      }

      if (!otp) {
        return res.status(400).json({
          status: 0,
          message: "OTP is required",
        });
      }

      const otpRecord = await OtpModel.findOne({
        email,
        otp: String(otp),
      }).sort({ createdAt: -1 });

      if (!otpRecord) {
        return res.status(400).json({
          status: 0,
          message: "Invalid OTP",
        });
      }

      await OtpModel.deleteOne({
        _id: otpRecord._id,
      });
    }

    /*
     * ==========================================
     * CHECK USER
     * ==========================================
     */

    let user = await User.findOne({ email });

    /*
     * ==========================================
     * EXISTING USER -> LOGIN
     * ==========================================
     */

    if (user) {
      /*
       * Continue with Google se login hua hai
       * to latest Google access token Business me save/update karo.
       */
      if (type === "google") {
        await Business.findOneAndUpdate(
          { userId: user._id },
          {
            $set: {
              accessToken: googleAccessToken,
            },
          },
        );
      }

      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

      return res.status(200).json({
        status: 1,
        userExist: true,
        message: "Login successful",
        token,
        userId: user._id,
        businessId: user.businessId || null,
        email: user.email,
      });
    }

    /*
     * ==========================================
     * USER DOESN'T EXIST -> REGISTER
     * ==========================================
     */

    const name = normalizeString(req.body.name);
    const businessCategory = normalizeString(req.body.businessCategory);
    const teamSize = normalizeString(req.body.teamSize);

    if (type !== "google") {
      if (!name || !businessCategory || !teamSize) {
        return res.status(400).json({
          status: 0,
          message:
            "name, businessCategory and teamSize are required for registration",
        });
      }
    }
    /*
     * ==========================================
     * CREATE USER
     * ==========================================
     */

    user = await User.create({
      name,
      email,
      image: getUploadedFilePath(req.files?.image?.[0]),
    });

    /*
     * ==========================================
     * CREATE BUSINESS
     * ==========================================
     */

    const businessData = {
      userId: user._id,
      businessName: name,
      email,
      businessCategory,
      teamSize,
    };

    // Google access token ONLY Business me save hoga
    if (type === "google") {
      businessData.accessToken = googleAccessToken;
    }

    const business = await Business.create(businessData);

    /*
     * Link business with user
     */

    user.businessId = business._id;
    await user.save();

    /*
     * Bizyro Sync
     */

    try {
      await syncUserWithBizyro(user);
    } catch (error) {
      console.error("Bizyro sync pending:", error.message);
    }

    /*
     * Generate FlyBiz JWT
     */

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    return res.status(201).json({
      status: 1,
      userExist: false,
      message: "Registration successful",
      token,
      userId: user._id,
      businessId: business._id,
      email: user.email,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);

    return res.status(500).json({
      status: 2,
      message: "Error verifying OTP",
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user;

    const profile = await User.findById(userId).select("-__v").populate({
      path: "businessId",
      select: "-__v",
    });

    if (!profile) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      profile,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred",
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user;

    const { name, email, businessName, gstNumber, address, website } = req.body;

    const updateData = {};

    if (name) updateData.name = normalizeString(name);

    if (email) updateData.email = normalizeEmail(email);

    if (gstNumber) updateData.gstNumber = normalizeString(gstNumber);

    if (businessName) updateData.businessName = normalizeString(businessName);

    if (address) updateData.address = normalizeString(address);

    if (website) updateData.website = normalizeString(website);

    if (req.files?.image?.[0]) {
      updateData.image = getUploadedFilePath(req.files?.image?.[0]);
    }

    if (req.files?.companyLogo?.[0]) {
      updateData.companyLogo = getUploadedFilePath(req.files?.companyLogo?.[0]);
    }

    const update = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-__v");

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: update,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred",
    });
  }
};
exports.businessCategory = async (req, res) => {
  try {
    const data = [
      { id: 1, name: "Retail & E-commerce" },
      { id: 2, name: "Healthcare" },
      { id: 3, name: "Real Estate" },
      { id: 4, name: "IT & Software" },
      { id: 5, name: "Other" },
    ];

    return res.status(200).json({
      status: 1,
      message: "Business categories fetched successfully",
      data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};

exports.businessCategory = async (req, res) => {
  try {
    const data = [
      { id: "688b1a2c3d4e5f6789012341", name: "Retail & E-commerce" },
      { id: "688b1a2c3d4e5f6789012342", name: "Healthcare" },
      { id: "688b1a2c3d4e5f6789012343", name: "Real Estate" },
      { id: "688b1a2c3d4e5f6789012345", name: "IT & Software" },
      { id: "688b1a2c3d4e5f6789012346", name: "Other" },
    ];

    return res.status(200).json({
      status: 1,
      message: "Business categories fetched successfully",
      data,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};
