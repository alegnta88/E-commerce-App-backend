const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Role = require("../models/role");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_EXPIRES_IN = "1d";

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

    // Remove this line: const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password, // Pass plain password - schema will hash it
      role: role._id
    });

    const token = jwt.sign(
      { id: user._id, role: role.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: role.name
      },
      token
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email, password });

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email }).populate("role");
    console.log("User found in DB:", user);
    
    if (!user) {
      console.log("No user found with email:", email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("Comparing passwords...");
    console.log("User methods available:", typeof user.matchPassword);
    console.log("Incoming password:", password);
    console.log("Stored hash:", user.password);
    
    // Try both methods to debug
    const isMatch1 = await user.matchPassword(password);
    console.log("matchPassword result:", isMatch1);
    
    const isMatch2 = await bcrypt.compare(password, user.password);
    console.log("bcrypt.compare result:", isMatch2);
    
    const isMatch = isMatch1 || isMatch2;
    
    if (!isMatch) {
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