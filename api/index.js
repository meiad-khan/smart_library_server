require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("../config/db");

const bookRoutes = require("../routes/bookRoutes");
const userRoutes = require("../routes/userRoutes");
const borrowRoutes = require("../routes/borrowRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect MongoDB
connectDB();

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Smart Library API is running",
  });
});

// API routes
app.use("/api/books", bookRoutes);
app.use("/api/users", userRoutes);
app.use("/api/borrows", borrowRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: "Something went wrong",
  });
});

// Important: export app for Vercel
module.exports = app;
