require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const itemRoutes = require("./routes/itemRoutes");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use("/auth", authRoutes);

// Connect to MongoDB
connectDB();

// Base route
app.get("/", (req, res) => {
  res.send("Welcome to Simple CRUD API!");
});

// Mount routes
app.use("/items", itemRoutes);

// --------------------
// 404 Handler
// --------------------
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// --------------------
// Global Error Handler
// --------------------
app.use((err, req, res, next) => {
  console.error("💥 Global Error:", err); // Log the full error

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({ success: false, message });
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));