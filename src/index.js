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

(async function start() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  await initDB();
  console.log("Database ready");

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
})();