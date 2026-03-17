// ============================================================
// DATABASE CONNECTION — Knex + PostgreSQL
// ============================================================
// All repo files import knex from here.
// ============================================================

import Knex from "knex";
import config from "../config.js";

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
 */
async function waitForDb(knex, retries = 5, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await knex.raw("SELECT 1");
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(
        `[DB] Connection attempt ${i + 1}/${retries} failed, retrying in ${delayMs}ms...`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
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
    directory: "./server/db/migrations",
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

