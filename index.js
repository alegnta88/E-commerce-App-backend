require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const itemRoutes = require("./routes/itemRoutes");
const userRoutes = require("./routes/userRoute");
const authRoutes = require("./routes/authRoutes");
const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));
app.use("/", authRoutes);

connectDB();

app.get("/", (req, res) => {
  res.send("Welcome!");
});
app.use("/users", userRoutes);
app.use("/items", itemRoutes);

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found" });
});


app.use((err, req, res, next) => {
  console.error("Global Error:", err); 

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({ success: false, message });
});

app.listen(PORT, () => console.log(`Tunning on port ${PORT}`));