import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db/pool.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { errorMessage } from "./utils/errorMessage.js";

import authRoutes from "./routes/auth.js";
import pantryRoutes from "./routes/pantry.js";
import mealRoutes from "./routes/meals.js";
import notificationRoutes from "./routes/notifications.js";
import doctorRoutes from "./routes/doctor.js";
import ocrRoutes from "./routes/ocr.js";
import supervisionRoutes from "./routes/supervision.js";
import foodGalleryRoutes from "./routes/foodGallery.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const alertSoundPath = path.join(__dirname, "../../notificationalert.mp3");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(publicDir));
const healthHandler = asyncHandler(async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error(
      "Health check database failure:",
      errorMessage(error, "unknown database error"),
    );
    res.status(503).json({
      ok: false,
      database: "unavailable",
      error: "Database unavailable",
    });
  }
});

// Keep the public health check outside the API namespace for deployment probes.
app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// All application APIs live under /api so they cannot collide with frontend
// pages such as /pantry, /meals, /notifications, and /doctor.
app.get("/api/notificationalert.mp3", (req, res) => res.sendFile(alertSoundPath));
app.use("/api/auth", authRoutes);
app.use("/api/pantry", pantryRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/doctor", doctorRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/supervision", supervisionRoutes);
app.use("/api/food-gallery", foodGalleryRoutes);

// Last-resort error handler: anything an individual route didn't
// already catch and format lands here instead of crashing the process.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status =
    Number.isInteger(err?.statusCode) && err.statusCode >= 400
      ? err.statusCode
      : 500;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : errorMessage(err),
  });
});

const PORT = process.env.PORT || 3002;
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

export default app;

