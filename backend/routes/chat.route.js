import express from "express";
import crypto from "crypto";
import { authenticateUser } from "../middleware/auth.middleware.js";
import UsersChat from "../models/user.chat.model.js";
import PDFDocument from "pdfkit";

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

// Export a chat session as PDF (authenticated)
router.get("/:id/export/pdf", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const chat = await UsersChat.findOne({ _id: id, userId });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const pythonBase =
      process.env.PYTHON_API_URL || "http://127.0.0.1:5001";
    const histRes = await fetch(
      `${pythonBase}/sessions/${id}/history?user_id=${userId}`
    );
    if (!histRes.ok) {
      const t = await histRes.text();
      return res
        .status(502)
        .json({ message: "Failed to fetch chat history", details: t });
    }
    const hist = await histRes.json();
    const messages = hist.messages || [];

    const safeTitle = (chat.title || "session")
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .slice(0, 60);
    const fileName = `${safeTitle || "session"}-${id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: chat.title || "Chat Export",
        Author: "Empathy AI",
      },
    });

    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .fillColor("#111827")
      .text(chat.title || "Chat Session", { align: "left" });
    doc
      .moveDown(0.25)
      .fontSize(10)
      .fillColor("#6B7280")
      .text(`Session ID: ${id}`)
      .text(`Exported: ${new Date().toLocaleString()}`)
      .moveDown(1);

    const bubble = (label, text, ts) => {
      doc
        .fontSize(11)
        .fillColor("#111827")
        .text(label, { continued: true })
        .fillColor("#6B7280")
        .text(ts ? `  •  ${ts}` : "");
      doc.moveDown(0.2);
      doc
        .fontSize(11)
        .fillColor("#111827")
        .text(text || "", {
          width: 495,
          align: "left",
        });
      doc.moveDown(0.8);
    };

    // Body
    for (const entry of messages) {
      const ts = entry.timestamp
        ? new Date(entry.timestamp).toLocaleString()
        : "";
      if (entry.user_message) {
        bubble("User", entry.user_message, ts);
      } else {
        // If empty user message, still include a marker for media actions
        bubble("User", "(media input)", ts);
      }
      if (entry.ai_response) {
        bubble("Empathy AI", entry.ai_response, ts);
      }
    }

    // Footer
    doc
      .moveDown(0.5)
      .fontSize(9)
      .fillColor("#6B7280")
      .text(
        "Note: This export is for reflection and sharing with trusted professionals. It is not a medical diagnosis.",
        { align: "left" }
      );

    doc.end();
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;

