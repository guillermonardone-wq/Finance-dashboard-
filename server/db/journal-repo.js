// ============================================================
// JOURNAL REPOSITORY — Daily journal entries
// ============================================================
// One entry per user per day. UNIQUE constraint enforced at DB level.
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex, userScoped } from "./connection.js";

/**
 * Get today's journal entry, or create an empty one if none exists.
 * Uses INSERT ... ON CONFLICT DO NOTHING to avoid race conditions.
 *
 * @param {string} entryDate - ISO date string (YYYY-MM-DD)
 * @param {string} [userId='default']
 * @returns {Promise<object>} the journal entry
 */
export async function getOrCreateEntry(entryDate, userId = "default") {
  const knex = getKnex();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Attempt insert — silently does nothing if entry already exists
  await knex.raw(
    `INSERT INTO daily_journal (id, user_id, entry_date, content, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?)
     ON CONFLICT (user_id, entry_date) DO NOTHING`,
    [id, userId, entryDate, now, now],
  );

  return knex("daily_journal")
    .where({ entry_date: entryDate, ...userScoped(userId) })
    .first();
}

/**
 * Update an existing journal entry.
 *
 * @param {string} id - journal entry id
 * @param {object} data
 * @param {string} [data.content]
 * @param {string} [data.mood]
 * @param {string} [data.marketConditions]
 * @param {Array} [data.keyDecisions] - array of decision_log ids
 * @param {string} [userId='default']
 * @returns {Promise<object|null>} updated entry or null if not found
 */
export async function updateEntry(id, { content, mood, marketConditions, keyDecisions }, userId = "default") {
  const knex = getKnex();
  const existing = await knex("daily_journal").where({ id, ...userScoped(userId) }).first();
  if (!existing) return null;

  const updates = { updated_at: new Date().toISOString() };
  if (content !== undefined) updates.content = content;
  if (mood !== undefined) updates.mood = mood;
  if (marketConditions !== undefined) updates.market_conditions = marketConditions;
  if (keyDecisions !== undefined) updates.key_decisions = JSON.stringify(keyDecisions);

  await knex("daily_journal").where({ id }).update(updates);
  return knex("daily_journal").where({ id }).first();
}

/**
 * List recent journal entries, newest first.
 */
export async function listEntries(userId = "default", limit = 30) {
  const knex = getKnex();
  return knex("daily_journal")
    .where(userScoped(userId))
    .orderBy("entry_date", "desc")
    .limit(limit);
}

/**
 * Full-text search on journal content using PostgreSQL ILIKE.
 */
export async function searchEntries(query, userId = "default") {
  const knex = getKnex();
  const pattern = `%${query}%`;
  return knex("daily_journal")
    .where(userScoped(userId))
    .where("content", "ilike", pattern)
    .orderBy("entry_date", "desc");
}
