const User = require("../models/user");
const jwt = require("jsonwebtoken");

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const admin = await User.findOne({ email, role: "admin" });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (password !== admin.password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { _id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
    );

    return res
      .status(200)
      .json({ message: "Admin logged in successfully", token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const id = req.admin;

    if (!id || id === null || id === undefined) {
      return res.status(400).json({ message: "Admin ID is required" });
    }

    const users = await User.find({
      role: { $ne: "admin" },
      _id: { $ne: id._id }
    });

    return res
      .status(200)
      .json({ message: "Users retrieved successfully", users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};
