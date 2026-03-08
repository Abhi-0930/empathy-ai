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
