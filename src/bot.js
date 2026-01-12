import fetch from "node-fetch";
import { askGroq } from "./services/groq.service.js";
import {
  initDB,
  getUser,
  upgradeUser,
  logEvent,
} from "./services/db.service.js";

import { lesson1 } from "./lessons/lesson1.js";
import { lesson2 } from "./lessons/lesson2.js";
import { lesson3 } from "./lessons/lesson3.js";
import { lesson4 } from "./lessons/lesson4.js";
import { lesson5 } from "./lessons/lesson5.js";
import { lesson6 } from "./lessons/lesson6.js";
import { summaries } from "./lessons/summaries.js";

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const LESSONS = [
  { id: 1, title: "Foundations", access: "free", content: lesson1 },
  { id: 2, title: "Sentence Structure", access: "mixed", content: lesson2 },
  { id: 3, title: "Aspect & Time", access: "premium", content: lesson3 },
  { id: 4, title: "Negation", access: "premium", content: lesson4 },
  { id: 5, title: "Questions & Focus", access: "premium", content: lesson5 },
  { id: 6, title: "Serial Verbs & Motion", access: "premium", content: lesson6 },
];

const progress = new Map();
const onboardingFlags = new Map();

/* Utilities */
async function sendMessage(chatId, text, parseMode = null) {
  const body = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendLesson(chatId, lesson) {
  for (let i = 1; i < lesson.length; i++) {
    await new Promise((r) => setTimeout(r, 900));
    await sendMessage(chatId, lesson[i].text, "Markdown");
  }
}

function routeLesson(id, user, chatId, res) {
  const L = LESSONS.find((l) => l.id === id);
  if (!L) return res.status(200).json({});

  logEvent(chatId, "lesson_opened", { lesson: id });

  if (L.access === "premium" && user.tier !== "premium") {
    logEvent(chatId, "premium_blocked", { lesson: id });

    if (!onboardingFlags.get(chatId)?.premiumBlocked) {
      onboardingFlags.set(chatId, { premiumBlocked: true });
      sendMessage(
        chatId,
        "This concept builds core Yorùbá grammar. Premium unlocks the full system."
      );
    }

    return res.status(200).json({
      method: "sendMessage",
      chat_id: chatId,
      text: "🔒 Premium lesson. Use /upgrade.",
    });
  }

  res.status(200).json({
    method: "sendMessage",
    chat_id: chatId,
    text: L.content[0].text,
    parse_mode: "Markdown",
  });

  setImmediate(() => sendLesson(chatId, L.content));
  logEvent(chatId, "lesson_completed", { lesson: id });
}

/* Webhook */
export async function handleTelegramWebhook(req, res) {
  try {
    const msg = req.body?.message;
    if (!msg?.text || !msg?.chat) return res.status(200).json({});

    const chatId = msg.chat.id;
    const text = msg.text.trim().toLowerCase();
    const user = await getUser(chatId);

    if (text === "/start") {
      logEvent(chatId, "user_started");
      progress.set(chatId, 1);

      sendMessage(
        chatId,
        "Welcome.\n\nThis tutor teaches Standard Yorùbá with full tone accuracy.\n\nStart with /lesson 1 or type a sentence."
      );
      return res.status(200).json({});
    }

    if (text === "/lesson list") {
      return res.status(200).json({
        method: "sendMessage",
        chat_id: chatId,
        text: LESSONS.map(
          (l) =>
            `Lesson ${l.id}: ${l.title}` +
            (l.access === "premium" && user.tier !== "premium" ? " 🔒" : "")
        ).join("\n"),
      });
    }

    if (text === "/next") {
      const n = Math.min((progress.get(chatId) ?? 1) + 1, LESSONS.length);
      progress.set(chatId, n);
      return routeLesson(n, user, chatId, res);
    }

    if (text === "/repeat") {
      return routeLesson(progress.get(chatId) ?? 1, user, chatId, res);
    }

    if (text.startsWith("/lesson ")) {
      const n = parseInt(text.split(" ")[1], 10);
      if (n >= 1 && n <= LESSONS.length) {
        progress.set(chatId, n);
        return routeLesson(n, user, chatId, res);
      }
    }

    /* ---------- SUMMARY COMMAND ---------- */
    if (text === "/summary") {
      const current = progress.get(chatId) ?? 1;
      const summary = summaries[current];

      if (!summary) {
        return res.status(200).json({
          method: "sendMessage",
          chat_id: chatId,
          text: "No summary available yet.",
        });
      }

      logEvent(chatId, "summary_viewed", { lesson: current });

      const body =
        `🧠 *${summary.title} — Key Takeaways*\n\n` +
        summary.points.map((p) => `• ${p}`).join("\n");

      return res.status(200).json({
        method: "sendMessage",
        chat_id: chatId,
        text: body,
        parse_mode: "Markdown",
      });
    }

    if (text === "/upgrade") {
      logEvent(chatId, "upgrade_viewed");
      return res.status(200).json({
        method: "sendMessage",
        chat_id: chatId,
        text:
          "₮3 TON / month\n\nWallet:\n" +
          "`UQA5puEo8wbYDuQvFxHizXq2WIrXYIJ4x2AXCBo0GIGo-GSe`\n\n" +
          "Then send: PAID <hash>",
        parse_mode: "Markdown",
      });
    }

    if (text.startsWith("paid ")) {
      await upgradeUser(chatId);
      logEvent(chatId, "premium_activated");
      sendMessage(chatId, "Premium activated. Continue with /next.");
      return res.status(200).json({});
    }

    /* Translation mode */
    const prompt = `
You are a Standard Yorùbá linguistics tutor.
Rules:
- Standard Yorùbá only
- Full tone marks
- First line: Yorùbá
- Second: English explanation

Sentence:
"${msg.text}"
`;

    const ai = await askGroq(prompt);
    const lines = ai?.split("\n").filter(Boolean) || [];
    const y = lines[0] || "Mo fẹ́ kọ́ èdè Yorùbá.";
    const e = lines.slice(1).join("\n") || "";

    logEvent(chatId, "translation_used");

    return res.status(200).json({
      method: "sendMessage",
      chat_id: chatId,
      text: `Yorùbá:\n${y}\n\nExplanation:\n${e}`,
    });
  } catch {
    return res.status(200).json({});
  }
}
