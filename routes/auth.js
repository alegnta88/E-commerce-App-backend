const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Role = require("../models/role");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// REGISTER
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, roleName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const role = await Role.findOne({ name: roleName || "user" });
    if (!role) return res.status(400).json({ message: "Role does not exist" });

    const user = await User.create({
      name,
      email,
      password,
      role: role._id
    });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: role.name },
      token
    });
  } catch (err) {
    next(err);
  }
});

// LOGIN
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log("📝 Login attempt received:", { email, password });

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({ message: "Email and password are required" });
    }

    console.log("🔍 Searching for user with email:", email);
    const user = await User.findOne({ email }).populate("role");
    console.log("👤 User found:", user);
    
    if (!user) {
      console.log("❌ No user found with email:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("🔐 Comparing passwords...");
    console.log("Incoming password:", password);
    console.log("Stored hash:", user.password);
    
    const isMatch = await user.matchPassword(password);
    console.log("✅ Password match:", isMatch);
    
    if (!isMatch) {
      console.log("❌ Password does not match");
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("✅ Login successful!");
    const token = jwt.sign({ id: user._id, role: user.role.name }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role.name },
      token
    });
  } catch (err) {
    console.log("💥 Error in login:", err);
    next(err);
  }
});

module.exports = router;