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

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).populate("role"); 

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.user = user;

    next();
  } catch (err) {
    console.log("Token verification error:", err);
    return res.status(401).json({ success: false, message: "Token expired or invalid" });
  }
};

module.exports = authMiddleware;