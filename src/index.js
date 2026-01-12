// src/index.js
import "dotenv/config";
import express from "express";
import { initDB } from "./services/db.service.js";
import { handleTelegramWebhook } from "./bot.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "tiwantiwa-backend" });
});

app.get("/health/db", async (req, res) => {
  try {
    await initDB();
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/telegram-webhook", handleTelegramWebhook);

// 🚨 START SERVER FIRST (Railway requirement)
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

// 🔁 DB connects in background (never crashes app)
if (process.env.DATABASE_URL) {
  initDB()
    .then(() => console.log("Database connected"))
    .catch(err => console.error("Database error:", err.message));
} else {
  console.warn("DATABASE_URL not set — running without DB");
}
