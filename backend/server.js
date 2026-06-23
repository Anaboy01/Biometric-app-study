import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import enrollRoutes from "./routes/enroll.js";
import verifyRoutes from "./routes/verify.js";
import statsRoutes from "./routes/stats.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── API request logger ──────────────────────────────────────────
const methodColor = (method) => {
  const colors = { GET: "\x1b[32m", POST: "\x1b[34m", PUT: "\x1b[33m", DELETE: "\x1b[31m", PATCH: "\x1b[35m" };
  return colors[method] || "\x1b[37m";
};

const statusColor = (code) => {
  if (code < 300) return "\x1b[32m";  // green  — 2xx
  if (code < 400) return "\x1b[36m";  // cyan   — 3xx
  if (code < 500) return "\x1b[33m";  // yellow — 4xx
  return "\x1b[31m";                   // red    — 5xx
};

const reset = "\x1b[0m";

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `[${new Date().toISOString()}]`,
      `${methodColor(req.method)}${req.method.padEnd(7)}${reset}`,
      req.originalUrl,
      `${statusColor(res.statusCode)}${res.statusCode}${reset}`,
      `${Date.now() - start}ms`
    );
  });
  next();
});
// ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://biometric-app-study.vercel.app"
  ]
}));
app.use(express.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/enroll", enrollRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/stats", statsRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/biometric_db")
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB error:", err));