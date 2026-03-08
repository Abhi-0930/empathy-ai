import express from "express";
import crypto from "crypto";
import { authenticateUser } from "../middleware/auth.middleware.js";
import UsersChat from "../models/user.chat.model.js";

const router = express.Router();

// Get all chat sessions for the authenticated user
router.get("/", authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await UsersChat.find({ userId }).sort({ updatedAt: -1 });
    res.status(200).json(chats);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create a new chat session
router.post("/", authenticateUser, async (req, res) => {
  try {
    const { title, lastMessage } = req.body;
    const userId = req.user.id;

    const newChat = new UsersChat({
      userId,
      title: title || "New Session",
      lastMessage: lastMessage || "",
    });

    const saved = await newChat.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Rename / update basic metadata for a chat session
router.patch("/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, lastMessage } = req.body;
    const userId = req.user.id;

    const chat = await UsersChat.findOneAndUpdate(
      { _id: id, userId },
      {
        ...(title && { title }),
        ...(lastMessage && { lastMessage }),
      },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete a chat session
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const deleted = await UsersChat.findOneAndDelete({ _id: id, userId });
    if (!deleted) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create or refresh a shareable link for a chat session
router.post("/:id/share", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const shareId = crypto.randomBytes(16).toString("hex");

    const chat = await UsersChat.findOneAndUpdate(
      { _id: id, userId },
      {
        shareId,
        shareExpiresAt: null, // could set expiry in future
      },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const url = `${process.env.CLIENT_URL || "http://localhost:5173"}/shared/${shareId}`;
    res.status(200).json({ shareId, url });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Revoke a shareable link
router.delete("/:id/share", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const chat = await UsersChat.findOneAndUpdate(
      { _id: id, userId },
      {
        shareId: null,
        shareExpiresAt: null,
      },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    res.status(200).json({ message: "Share link revoked" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Public endpoint to resolve a shareId to basic chat info
router.get("/shared/:shareId", async (req, res) => {
  try {
    const { shareId } = req.params;

    const chat = await UsersChat.findOne({ shareId });
    if (!chat) {
      return res.status(404).json({ message: "Shared chat not found" });
    }

    res.status(200).json({
      sessionId: chat._id.toString(),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;

