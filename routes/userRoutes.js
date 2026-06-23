const express = require("express");
const User = require("../models/User");

const router = express.Router();

// Register user in MongoDB after Firebase registration/login
router.post("/sync", async (req, res) => {
  try {
    const { firebaseUid, name, email } = req.body;

    if (!firebaseUid || !name || !email) {
      return res.status(400).json({
        message: "firebaseUid, name and email are required",
      });
    }

    let user = await User.findOne({ firebaseUid });

    // If user already exists, return that user
    if (user) {
      return res.status(200).json({
        message: "User already exists",
        user,
      });
    }

    user = await User.create({
      firebaseUid,
      name,
      email,
      role: "student",
    });

    res.status(201).json({
      message: "User saved successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to sync user",
      error: error.message,
    });
  }
});

// Get one user by Firebase UID
router.get("/:firebaseUid", async (req, res) => {
  try {
    const user = await User.findOne({
      firebaseUid: req.params.firebaseUid,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get user",
      error: error.message,
    });
  }
});

module.exports = router;
