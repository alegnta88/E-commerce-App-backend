const jwt = require("jsonwebtoken");
const User = require("../models/user");

const JWT_SECRET = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify the JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user from DB and populate the role
    const user = await User.findById(decoded.id).populate("role"); // <--- changed here

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Attach full user (with role) to request
    req.user = user;

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Token expired or invalid" });
  }
};

module.exports = authMiddleware;