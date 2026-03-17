// ============================================================
// SEED SCRIPT — Populate the database with sample data
// Run: node server/seed.js
// ============================================================

import dotenv from "dotenv";
dotenv.config();

import { initDb, closeDb } from "./db/connection.js";
import { seed } from "./seed-fn.js";

console.log("Initializing database...");
initDb();
seed();
closeDb();
