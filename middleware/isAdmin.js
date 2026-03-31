const jwt = require('jsonwebtoken');
const User = require('../models/user');

const verifyAdminToken = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(404).json({ message: "A token is required for admin authorization" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded._id; // ✅ Correct key
    const user = await User.findById(userId);

    if (!user) {
      // console.log("User not found:", userId);
      return res.status(401).json({ message: "User not found" });
    }

    if (user.role !== "admin") {
      // console.log("User is not an admin:", userId);
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    req.user = user;
    // console.log("Token verified successfully for user:", userId);

    next();
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: "Invalid Token" });
  }
};

module.exports = verifyAdminToken;
