import express from "express";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = express.Router();

// Auth-protected personalization summary endpoint aligned with implementation plan
router.get("/:id/personalization-summary", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id.toString() !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const pythonBase = process.env.PYTHON_API_URL || "http://127.0.0.1:5001";
    const response = await fetch(
      `${pythonBase}/users/${encodeURIComponent(id)}/personalization-summary`
    );

    if (!response.ok) {
      const details = await response.text();
      return res
        .status(502)
        .json({ message: "Failed to fetch personalization summary", details });
    }

    const payload = await response.json();
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
