import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || join(__dirname, '../../data/decision-engine.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb() {
  const database = getDb();
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  database.exec(schema);
  return database;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
