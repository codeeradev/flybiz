const User = require("../models/user");
const OtpModel = require("../models/otp");
const jwt = require("jsonwebtoken");

const validator = require("validator");

const buildLookupQuery = ({ mobileNumber, email }) => {
  const filters = [];

  if (mobileNumber) {
    filters.push({ mobileNumber });
  }

  if (email) {
    filters.push({ email });
  }

  return { $or: filters };
};

exports.Login = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        message: "Email or mobile number is required",
      });
    }

    const value = username.trim();

    const isEmail = validator.isEmail(value);
    const isMobile = validator.isMobilePhone(value, "any", {
      strictMode: true,
    });

    if (!isEmail && !isMobile) {
      return res.status(400).json({
        message: "Enter a valid email or mobile number with country code",
      });
    }

    let mobileNumber = null;
    let email = null;

    if (isEmail) {
      email = value.toLowerCase();
    }

    if (isMobile) {
      mobileNumber = value;
    }

    const userQuery = buildLookupQuery({ mobileNumber, email });
    const user = await User.findOne(userQuery);

    if (!user) {
      return res.status(404).json({
        status: 0,
        userExist: false,
        message: "User not found. Please complete registration.",
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    const otpQuery = buildLookupQuery({
      mobileNumber: user.mobileNumber,
      email: user.email,
    });

    await OtpModel.deleteMany(otpQuery);
    await OtpModel.create({
      mobileNumber: user.mobileNumber,
      email: user.email,
      otp: String(otp),
      expiresAt: Date.now() + 2 * 60 * 1000,
    });

    return res.status(200).json({
      status: 1,
      userExist: true,
      message: "OTP sent successfully",
      otp,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 2,
      message: "Error in login",
    });
  }
};

exports.register = async (req, res) => {
  try {
    const { mobileNumber, email, name } = req.body;

    if (!mobileNumber || !email) {
      return res.status(400).json({
        message: "Mobile number and email are required",
      });
    }

    const userQuery = buildLookupQuery({ mobileNumber, email });
    const existingUser = await User.findOne(userQuery);

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists. Please login.",
      });
    }

    const image = req.files?.image?.[0]?.filename
      ? `/assets/uploads/${req.files.image[0].filename}`
      : null;

    const userData = {
      mobileNumber,
      email,
    };

    if (name) {
      userData.name = name;
    }

    if (image) {
      userData.image = image;
    }

    const user = await User.create(userData);

    const otp = Math.floor(1000 + Math.random() * 9000);
    const otpQuery = buildLookupQuery({
      mobileNumber: user.mobileNumber,
      email: user.email,
    });

    await OtpModel.deleteMany(otpQuery);
    await OtpModel.create({
      mobileNumber: user.mobileNumber,
      email: user.email,
      otp: String(otp),
      expiresAt: Date.now() + 2 * 60 * 1000,
    });

    return res.status(201).json({
      status: 1,
      userExist: true,
      message: "OTP sent successfully",
      otp,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 2,
      message: "Error in registration",
    });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { username, otp } = req.body;

    if (!username) {
      return res.status(400).json({
        message: "Email or mobile number is required",
      });
    }

    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }

    const value = username.trim();

    if (!value) {
      return res.status(400).json({
        message: "Email or mobile number is required",
      });
    }

    const isEmail = validator.isEmail(value);
    const isMobile = validator.isMobilePhone(value, "any", {
      strictMode: true,
    });

    if (!isEmail && !isMobile) {
      return res.status(400).json({
        message: "Enter a valid email or mobile number with country code",
      });
    }

    let mobileNumber = null;
    let email = null;

    if (isEmail) {
      email = value.toLowerCase();
    }

    if (isMobile) {
      mobileNumber = value;
    }

    const otpQuery = {
      otp: String(otp),
    };

    if (mobileNumber) {
      otpQuery.mobileNumber = mobileNumber;
    }

    if (email) {
      otpQuery.email = email;
    }

    const otpRecord = await OtpModel.findOne(otpQuery);

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (new Date(otpRecord.expiresAt) < new Date()) {
      await OtpModel.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ message: "OTP expired" });
    }

    const user = await User.findOne(
      buildLookupQuery({
        mobileNumber: otpRecord.mobileNumber,
        email: otpRecord.email,
      }),
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await OtpModel.deleteOne({ _id: otpRecord._id });

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

    return res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "An error occurred" });
  }
};
