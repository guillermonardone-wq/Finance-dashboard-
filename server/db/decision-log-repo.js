// ============================================================
// DECISION LOG REPOSITORY — Append-only audit trail
// ============================================================
// Thin data access layer. No business logic.
// The decision_log table has PostgreSQL triggers preventing
// UPDATE and DELETE — this repo only inserts and reads.
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex, userScoped } from "./connection.js";

/**
 * Log a decision to the append-only decision_log.
 *
 * @param {object} params
 * @param {string} [params.thesisId] - thesis this decision relates to
 * @param {string} [params.signalId] - signal this decision relates to (optional)
 * @param {string} params.action - e.g. 'status_change', 'classification_change', 'override'
 * @param {string} [params.fromValue] - previous value
 * @param {string} [params.toValue] - new value
 * @param {string} params.reason - the "Why?" answer
 * @param {object} [params.contextSnapshot] - snapshot of thesis state at time of decision
 * @param {string} [userId='default']
 * @returns {Promise<object>} the inserted row
 */
export async function logDecision(
  { thesisId, signalId, action, fromValue, toValue, reason, contextSnapshot },
  userId = "default",
) {
  const knex = getKnex();
  const id = uuidv4();

  await knex("decision_log").insert({
    id,
    user_id: userId,
    thesis_id: thesisId || null,
    signal_id: signalId || null,
    action,
    from_value: fromValue || null,
    to_value: toValue || null,
    reason,
    context_snapshot: contextSnapshot ? JSON.stringify(contextSnapshot) : null,
  });

  return knex("decision_log").where({ id }).first();
}

/**
 * Get all decisions for a thesis, newest first.
 */
export async function getDecisionHistory(thesisId, userId = "default") {
  const knex = getKnex();
  return knex("decision_log")
    .where({ thesis_id: thesisId, ...userScoped(userId) })
    .orderBy("created_at", "desc");
}

/**
 * Get the most recent N decisions across all theses.
 */
export async function getRecentDecisions(userId = "default", limit = 50) {
  const knex = getKnex();
  return knex("decision_log")
    .where(userScoped(userId))
    .orderBy("created_at", "desc")
    .limit(limit);
}

/**
 * Full-text search on reason and action fields using PostgreSQL ILIKE.
 */
export async function searchDecisions(query, userId = "default") {
  const knex = getKnex();
  const pattern = `%${query}%`;
  return knex("decision_log")
    .where(userScoped(userId))
    .andWhere(function () {
      this.where("reason", "ilike", pattern).orWhere("action", "ilike", pattern);
    })
    .orderBy("created_at", "desc");
}
