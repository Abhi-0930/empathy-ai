import express from "express";
import {
  signup,
  login,
  profile,
} from "../controllers/user.controller.js";
import { authenticateUser } from "../middleware/auth.middleware.js";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const router = express.Router();
const client = new OAuth2Client("YOUR_GOOGLE_CLIENT_ID"); // Replace with your client ID

// Regular auth routes
router.post("/signup", signup);
router.post("/login", login);
router.get("/profile", authenticateUser, profile);

// Auth-protected personalization summary for current user
router.get("/personalization-summary/:id", authenticateUser, async (req, res) => {
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

// Google Sign-In route
router.post("/google", async (req, res) => {
  const { token } = req.body;

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: "YOUR_GOOGLE_CLIENT_ID", // Replace with your client ID
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    // Find or create the user in your database
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        username: name,
        email,
        password: "", // No password needed for Google sign-in
      });
      await user.save();
    }

    // Generate a JWT for your app
    const appToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({ token: appToken });
  } catch (error) {
    console.error("Error verifying Google token:", error);
    res.status(400).json({ message: "Invalid token" });
  }
});

export default router;
