const jwt = require('jsonwebtoken');
const User = require('../models/user');

const verifyToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(404).json({ message: "A token is required for authorization" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded._id; // ✅ Correct key
    const admin = await User.findById(userId);

    if (!admin) {
      // console.log("Admin not found:", userId);
      return res.status(401).json({ message: "Admin not found" });
    }

    req.admin = admin;
    // console.log("Token verified successfully for admin:", userId);

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: "Invalid Token" });
  }
};

module.exports = verifyToken;
