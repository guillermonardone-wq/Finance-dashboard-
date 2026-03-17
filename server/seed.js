// ============================================================
// SEED SCRIPT — Populate the database with sample data
// Run: node server/seed.js
// ============================================================

import dotenv from "dotenv";
dotenv.config();

import { initDb, closeDb } from "./db/connection.js";
import { seed } from "./seed-fn.js";

(async () => {
  try {
    console.log("Initializing database...");
    await initDb();
    await seed();
    console.log("Seed complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
