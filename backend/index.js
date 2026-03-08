import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import cors from "cors";

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: "GET, POST, PUT, DELETE, PATCH",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);

app.get("/", (req, res) => {
  res.send("Hello, Visionava!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});