import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";
import exerciseRoutes from "./routes/exercise.route.js";
import usersRoutes from "./routes/users.route.js";
import cors from "cors";

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const metrics = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  byRoute: {},
  byStatus: {},
  totalLatencyMs: 0,
};

const createRateLimiter = ({ windowMs, maxRequests }) => {
  const requestStore = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = requestStore.get(key) || [];
    const active = timestamps.filter((ts) => ts > windowStart);

    if (active.length >= maxRequests) {
      return res.status(429).json({
        message: "Too many requests. Please try again shortly.",
      });
    }

    active.push(now);
    requestStore.set(key, active);
    return next();
  };
};

const authRateLimiter = createRateLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  maxRequests: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: "GET, POST, PUT, DELETE, PATCH",
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    metrics.totalRequests += 1;
    metrics.totalLatencyMs += duration;

    const routeKey = `${req.method} ${req.path}`;
    metrics.byRoute[routeKey] = (metrics.byRoute[routeKey] || 0) + 1;

    const statusKey = String(res.statusCode);
    metrics.byStatus[statusKey] = (metrics.byStatus[statusKey] || 0) + 1;

    console.log(
      `[request] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });

  next();
});

app.use("/api/auth", authRateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/exercises", exerciseRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "backend",
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/metrics", (req, res) => {
  const avgLatencyMs =
    metrics.totalRequests > 0
      ? Math.round((metrics.totalLatencyMs / metrics.totalRequests) * 100) / 100
      : 0;

  res.status(200).json({
    ...metrics,
    avgLatencyMs,
  });
});

app.get("/", (req, res) => {
  res.send("Hello, Visionava!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});