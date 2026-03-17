// ============================================================
// DATABASE CONNECTION — Knex + PostgreSQL
// ============================================================
// All repo files import knex from here.
// ============================================================

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import Knex from "knex";
import config from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = resolve(__dirname, "migrations");

let knexInstance = null;

export function getKnex() {
  if (!knexInstance) {
    knexInstance = Knex({
      client: "pg",
      connection: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
      },
      pool: { min: 2, max: 10 },
    });
  }
  return knexInstance;
}

/**
 * Wait for PostgreSQL to accept connections (retries with backoff).
 * Retries up to 10 times with 1.5s initial delay, doubling each attempt.
 */
async function waitForDb(knex, retries = 10, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      await knex.raw("SELECT 1");
      console.log(`[DB] Connected on attempt ${i + 1}.`);
      return;
    } catch (err) {
      if (i === retries - 1) {
        console.error(`[DB] All ${retries} connection attempts failed.`);
        throw err;
      }
      console.log(
        `[DB] Connection attempt ${i + 1}/${retries} failed (${err.code || err.message}), retrying in ${Math.round(delayMs / 1000)}s...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 2, 30000);
    }
  }
}

/**
 * Run pending Knex migrations on startup.
 * Waits for DB to be reachable first.
 */
export async function initDb() {
  const knex = getKnex();
  await waitForDb(knex);
  await knex.migrate.latest({
    directory: MIGRATIONS_DIR,
  });
}

/**
 * Graceful shutdown — destroy the connection pool.
 */
export async function closeDb() {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}

/**
 * Helper: scope any query to a user_id.
 * Usage: knex('theses').where(userScoped(userId)).where(...)
 */
export function userScoped(userId = "default") {
  return { user_id: userId };
}

