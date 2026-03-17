// ============================================================
// DATABASE CONNECTION — Knex + PostgreSQL
// ============================================================
// Replaces better-sqlite3 with Knex connection pool.
// All repo files import knex from here instead of getDb().
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
 * Run pending Knex migrations on startup.
 */
export async function initDb() {
  const knex = getKnex();
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

