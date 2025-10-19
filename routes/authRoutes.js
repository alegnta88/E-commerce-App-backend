const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const Role = require("../models/role");
const User = require("../models/user");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "1h";

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const userRole = await Role.findOne({ name: role || "user" });
    if (!userRole) return res.status(400).json({ message: "Role does not exist" });

    const user = await User.create({
      name,
      email,
      password, 
      role: userRole._id
    });

    const token = jwt.sign(
      { id: user._id, role: userRole.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: userRole.name
      },
      token,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 2,
  message: "Too many login attempts. Try again later."
});

router.post("/login", loginLimiter, async (req, res, next) => {

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email }).populate("role");
    
    if (!user) {
      console.log("No user found with email:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const isMatchpass = await user.matchPassword(password);
    console.log("Password match result (method 1):", isMatchpass);
    
    if (!isMatchpass) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role.name
      },
      token
    });
  } catch (err) {
    console.log("Error:", err);
    next(err);
  }
});

module.exports = router;