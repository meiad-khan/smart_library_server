const express = require("express");
const router = express.Router();

const Book = require("../models/Book");
const User = require("../models/User");

// ----------------------------------------------------
// Helper function: find user using Firebase UID
// ----------------------------------------------------
const findUserByFirebaseUid = async (firebaseUid) => {
  if (!firebaseUid) {
    return null;
  }

  const user = await User.findOne({ firebaseUid });
  return user;
};

// ----------------------------------------------------
// GET ALL BOOKS
// GET /api/books
// Optional search: /api/books?search=flutter
// Everyone can see all books
// ----------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const search = req.query.search || "";

    const books = await Book.find({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get books",
      error: error.message,
    });
  }
});

// ----------------------------------------------------
// GET LIBRARIAN'S OWN BOOKS
// GET /api/books/librarian/:firebaseUid
// Only returns books added by that librarian
//
// IMPORTANT: This route must stay BEFORE /:id route.
// ----------------------------------------------------
router.get("/librarian/:firebaseUid", async (req, res) => {
  try {
    const user = await findUserByFirebaseUid(req.params.firebaseUid);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role !== "librarian" && user.role !== "admin") {
      return res.status(403).json({
        message: "Only librarian or admin can view librarian books",
      });
    }

    const books = await Book.find({
      addedBy: user._id,
    })
      .populate("addedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get librarian books",
      error: error.message,
    });
  }
});

// ----------------------------------------------------
// GET ONE BOOK
// GET /api/books/:id
// ----------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate(
      "addedBy",
      "name email role",
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    res.status(200).json(book);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get book",
      error: error.message,
    });
  }
});

// ----------------------------------------------------
// ADD BOOK
// POST /api/books
//
// Body must include firebaseUid.
// Only librarian and admin can add books.
// ----------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const {
      firebaseUid,
      title,
      author,
      category,
      description,
      imageUrl,
      totalCopies,
    } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({
        message: "firebaseUid is required",
      });
    }

    if (!title || !author || !category || !totalCopies) {
      return res.status(400).json({
        message: "Title, author, category and totalCopies are required",
      });
    }

    const copies = Number(totalCopies);

    if (isNaN(copies) || copies < 1) {
      return res.status(400).json({
        message: "totalCopies must be a positive number",
      });
    }

    const user = await findUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role !== "librarian" && user.role !== "admin") {
      return res.status(403).json({
        message: "Only librarian or admin can add books",
      });
    }

    const book = await Book.create({
      title,
      author,
      category,
      description: description || "",
      imageUrl: imageUrl || "",
      totalCopies: copies,
      availableCopies: copies,
      addedBy: user._id,
    });

    res.status(201).json({
      message: "Book added successfully",
      book,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add book",
      error: error.message,
    });
  }
});

// ----------------------------------------------------
// UPDATE BOOK
// PUT /api/books/:id
//
// Body must include firebaseUid.
// Admin can update any book.
// Librarian can update only their own book.
// ----------------------------------------------------
router.put("/:id", async (req, res) => {
  try {
    const {
      firebaseUid,
      title,
      author,
      category,
      description,
      imageUrl,
      totalCopies,
    } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({
        message: "firebaseUid is required",
      });
    }

    const user = await findUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role !== "librarian" && user.role !== "admin") {
      return res.status(403).json({
        message: "Only librarian or admin can update books",
      });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    // Admin can edit all books.
    // Librarian can edit only books that they added.
    if (
      user.role === "librarian" &&
      (!book.addedBy || book.addedBy.toString() !== user._id.toString())
    ) {
      return res.status(403).json({
        message: "You can only edit books added by you",
      });
    }

    // Update only provided fields
    if (title !== undefined) book.title = title;
    if (author !== undefined) book.author = author;
    if (category !== undefined) book.category = category;
    if (description !== undefined) book.description = description;
    if (imageUrl !== undefined) book.imageUrl = imageUrl;

    if (totalCopies !== undefined) {
      const newTotalCopies = Number(totalCopies);

      if (isNaN(newTotalCopies) || newTotalCopies < 1) {
        return res.status(400).json({
          message: "totalCopies must be a positive number",
        });
      }

      // Number currently borrowed
      const borrowedCopies = book.totalCopies - book.availableCopies;

      // Cannot reduce total copies below already borrowed copies
      if (newTotalCopies < borrowedCopies) {
        return res.status(400).json({
          message: `Cannot set totalCopies below ${borrowedCopies} because copies are currently borrowed`,
        });
      }

      book.totalCopies = newTotalCopies;
      book.availableCopies = newTotalCopies - borrowedCopies;
    }

    await book.save();

    res.status(200).json({
      message: "Book updated successfully",
      book,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update book",
      error: error.message,
    });
  }
});

// ----------------------------------------------------
// DELETE BOOK
// DELETE /api/books/:id
//
// Send firebaseUid in request body.
// Admin can delete any book.
// Librarian can delete only their own book.
// ----------------------------------------------------
router.delete("/:id", async (req, res) => {
  try {
    const { firebaseUid } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({
        message: "firebaseUid is required",
      });
    }

    const user = await findUserByFirebaseUid(firebaseUid);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role !== "librarian" && user.role !== "admin") {
      return res.status(403).json({
        message: "Only librarian or admin can delete books",
      });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    if (
      user.role === "librarian" &&
      (!book.addedBy || book.addedBy.toString() !== user._id.toString())
    ) {
      return res.status(403).json({
        message: "You can only delete books added by you",
      });
    }

    await Book.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Book deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete book",
      error: error.message,
    });
  }
});

module.exports = router;
