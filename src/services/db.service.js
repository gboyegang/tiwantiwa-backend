// src/services/db.service.js
import pkg from "pg";
const { Pool } = pkg;

let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing at runtime");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function initDB() {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id BIGINT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'free',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT,
      event TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function getUser(chatId) {
  const db = getPool();

  const r = await db.query(
    "SELECT chat_id, tier FROM users WHERE chat_id = $1",
    [chatId]
  );

  if (r.rows.length) return r.rows[0];

  const i = await db.query(
    "INSERT INTO users (chat_id) VALUES ($1) RETURNING chat_id, tier",
    [chatId]
  );

  return i.rows[0];
}

export async function upgradeUser(chatId) {
  const db = getPool();
  await db.query(
    "UPDATE users SET tier = 'premium' WHERE chat_id = $1",
    [chatId]
  );
}

export async function logEvent(chatId, event, metadata = null) {
  const db = getPool();
  await db.query(
    "INSERT INTO events (chat_id, event, metadata) VALUES ($1, $2, $3)",
    [chatId, event, metadata]
  );
}
