const jwt = require("jsonwebtoken");

const User = require("../models/user");
const Business = require("../models/business");
const OtpModel = require("../models/otp");
const { sendWhatsappOtp } = require("../utils/whatsappOtp");
const {
  getUploadedFilePath,
  isValidEmail,
  isValidMobileNumber,
  normalizeEmail,
  normalizeMobileNumber,
  normalizeString,
} = require("../utils/authUtils");

const getAuthErrorMessage = (fallbackMessage, error) => {
  const errorMessage = normalizeString(error?.message);

  if (errorMessage && errorMessage.toLowerCase().includes("whatsapp")) {
    return errorMessage;
  }

  return fallbackMessage;
};

exports.register = async (req, res) => {
  try {
    const step = Number(req.body.step);

    if (step === 1) {
      const mobileNumber = normalizeMobileNumber(req.body.mobileNumber);
      const email = normalizeEmail(req.body.email);

      if (!mobileNumber || !email) {
        return res.status(400).json({
          message: "Mobile number and email are required",
        });
      }

      if (!isValidMobileNumber(mobileNumber)) {
        return res.status(400).json({
          message: "Enter a valid mobile number with country code",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          message: "Enter a valid email address",
        });
      }

      const existingUser = await User.findOne({
        $or: [{ mobileNumber }, { email }],
      });

      if (existingUser) {
        if (Number(existingUser.registrationStep) === 1) {
          return res.status(200).json({
            status: 1,
            userExist: true,
            message: "User already exists. Please add business details.",
            step: 1,
            nextStep: 2,
          });
        }

        return res.status(409).json({
          status: 0,
          userExist: true,
          message: "User already exists. Please login.",
          step: 2,
          nextStep: "login",
        });
      }

      const user = await User.create({
        mobileNumber,
        email,
        name: normalizeString(req.body.name),
        image: getUploadedFilePath(req.files?.image?.[0]),
        registrationStep: 1,
      });

      return res.status(201).json({
        status: 1,
        message: "Personal details saved successfully",
        step: 1,
        nextStep: 2,
      });
    }

    if (step === 2) {
      const lookupMobileNumber = normalizeMobileNumber(req.body.mobileNumber);
      const lookupEmail = normalizeEmail(req.body.email);
      const businessName = normalizeString(req.body.businessName);
      const gstNumber = normalizeString(req.body.gstNumber);
      const email = normalizeEmail(req.body.businessEmail || req.body.email);
      const mobileNumber = normalizeMobileNumber(
        req.body.businessMobileNumber || req.body.mobileNumber,
      );
      const address = normalizeString(req.body.address);

      if (!lookupMobileNumber && !lookupEmail) {
        return res.status(400).json({
          message: "Mobile number or email is required",
        });
      }

      if (!businessName || !gstNumber || !email || !mobileNumber || !address) {
        return res.status(400).json({
          message:
            "businessName, gstNumber, business email, business mobile number and address are required",
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          message: "Enter a valid business email address",
        });
      }

      if (!isValidMobileNumber(mobileNumber)) {
        return res.status(400).json({
          message: "Enter a valid business mobile number with country code",
        });
      }

      const userQuery = [];

      if (lookupMobileNumber) {
        userQuery.push({ mobileNumber: lookupMobileNumber });
      }

      if (lookupEmail) {
        userQuery.push({ email: lookupEmail });
      }

      const user = await User.findOne({
        $or: userQuery,
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found. Please complete step 1 first.",
        });
      }

      if (Number(user.registrationStep) === 2) {
        return res.status(409).json({
          status: 0,
          message: "Business details already added. Please login.",
          step: 2,
          nextStep: "login",
        });
      }

      const business = await Business.create({
        userId: user._id,
        businessName,
        gstNumber,
        email,
        mobileNumber,
        address,
        website: normalizeString(req.body.website) || null,
        companyLogo: getUploadedFilePath(
          req.files?.companyLogo?.[0] || req.files?.image?.[0],
        ),
      });

      user.businessId = business._id;
      user.registrationStep = 2;
      await user.save();

      await sendWhatsappOtp(user.mobileNumber);

      return res.status(201).json({
        status: 1,
        message: "Business details saved successfully. OTP sent on WhatsApp",
        mobileNumber: user.mobileNumber,
        otpChannel: "whatsapp",
        step: 2,
        nextStep: "verify-otp",
      });
    }

    return res.status(400).json({
      message: "step must be 1 or 2",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 2,
      message: getAuthErrorMessage("Error in registration", error),
    });
  }
};

exports.Login = async (req, res) => {
  try {
    const mobileNumber = normalizeMobileNumber(req.body.mobileNumber);

    if (!mobileNumber) {
      return res.status(400).json({
        message: "Mobile number is required",
      });
    }

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({
        message: "Enter a valid mobile number with country code",
      });
    }

    const user = await User.findOne({ mobileNumber });

    if (!user) {
      return res.status(404).json({
        status: 0,
        userExist: false,
        message: "User not found. Please complete registration.",
      });
    }

    await sendWhatsappOtp(user.mobileNumber);

    return res.status(200).json({
      status: 1,
      userExist: true,
      message: "OTP sent successfully on WhatsApp",
      mobileNumber: user.mobileNumber,
      otpChannel: "whatsapp",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 2,
      message: getAuthErrorMessage("Error in login", error),
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const mobileNumber = normalizeMobileNumber(req.body.mobileNumber);
    const otp = normalizeString(req.body.otp);

    if (!mobileNumber) {
      return res.status(400).json({
        message: "Mobile number is required",
      });
    }

    if (!isValidMobileNumber(mobileNumber)) {
      return res.status(400).json({
        message: "Enter a valid mobile number with country code",
      });
    }

    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }

    const user = await User.findOne({ mobileNumber });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const otpRecord = await OtpModel.findOne({
      mobileNumber,
      otp: String(otp),
    });

    if (!otpRecord) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    if (new Date(otpRecord.expiresAt) < new Date()) {
      await OtpModel.deleteOne({ _id: otpRecord._id });

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    await OtpModel.deleteOne({ _id: otpRecord._id });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    return res.status(200).json({
      message: "Login successful",
      token,
      userId: user._id,
      businessId: user.businessId || null,
      mobileNumber: user.mobileNumber,
      registrationStep: user.registrationStep || 1,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "An error occurred",
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

    const { name, email, businessName, gstNumber, address, website } =
      req.body;

    const updateData = {};

    if (name) updateData.name = normalizeString(name);

    if (email) updateData.email = normalizeEmail(email);

    if (gstNumber) updateData.gstNumber = normalizeString(gstNumber);

    if (businessName) updateData.businessName = normalizeString(businessName);

    if (address) updateData.address = normalizeString(address);

    if (website) updateData.website = normalizeString(website);

    if (image) {
      updateData.image = getUploadedFilePath(req.files?.image?.[0]);
    }

    if (companyLogo) {
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
