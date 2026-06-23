const express = require("express");
const Borrow = require("../models/Borrow");
const User = require("../models/User");
const Book = require("../models/Book");

const router = express.Router();

// Borrow a book
router.post("/", async (req, res) => {
  try {
    const { firebaseUid, bookId } = req.body;

    if (!firebaseUid || !bookId) {
      return res.status(400).json({
        message: "firebaseUid and bookId are required",
      });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        message: "User not found. Sync user first.",
      });
    }

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    if (book.availableCopies <= 0) {
      return res.status(400).json({
        message: "This book is currently unavailable",
      });
    }

    // Same student cannot borrow same book twice without returning it
    const alreadyBorrowed = await Borrow.findOne({
      user: user._id,
      book: book._id,
      status: "borrowed",
    });

    if (alreadyBorrowed) {
      return res.status(400).json({
        message: "You already borrowed this book",
      });
    }

    const borrow = await Borrow.create({
      user: user._id,
      book: book._id,
    });

    // Reduce available book copy
    book.availableCopies -= 1;
    await book.save();

    res.status(201).json({
      message: "Book borrowed successfully",
      borrow,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to borrow book",
      error: error.message,
    });
  }
});

// Return a book
router.put("/:borrowId/return", async (req, res) => {
  try {
    const borrow = await Borrow.findById(req.params.borrowId);

    if (!borrow) {
      return res.status(404).json({
        message: "Borrow record not found",
      });
    }

    if (borrow.status === "returned") {
      return res.status(400).json({
        message: "This book was already returned",
      });
    }

    borrow.status = "returned";
    borrow.returnDate = new Date();
    await borrow.save();

    // Increase available book copy
    const book = await Book.findById(borrow.book);

    if (book) {
      book.availableCopies += 1;
      await book.save();
    }

    res.status(200).json({
      message: "Book returned successfully",
      borrow,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to return book",
      error: error.message,
    });
  }
});

// Get borrowing history for one student
router.get("/user/:firebaseUid", async (req, res) => {
  try {
    const user = await User.findOne({
      firebaseUid: req.params.firebaseUid,
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const borrowHistory = await Borrow.find({
      user: user._id,
    })
      .populate("book")
      .sort({ createdAt: -1 });

    res.status(200).json(borrowHistory);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get borrowing history",
      error: error.message,
    });
  }
});

// Admin: get every borrowing record
router.get("/", async (req, res) => {
  try {
    const records = await Borrow.find()
      .populate("user", "name email role")
      .populate("book", "title author")
      .sort({ createdAt: -1 });

    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get borrow records",
      error: error.message,
    });
  }
});

module.exports = router;
