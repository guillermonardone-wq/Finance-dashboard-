// ============================================================
// THESIS REPOSITORY — Knex-based DB access layer for theses
// ============================================================

import { getKnex, userScoped } from "./connection.js";

// Fields stored as JSONB in PostgreSQL — no JSON.stringify/parse needed
// when writing, but we keep the list for reference and for the
// UPDATABLE_COLUMNS allowlist.
const JSONB_FIELDS = new Set([
  "causal_chain",
  "affected_assets",
  "expected_timeline",
  "market_pricing_assessment",
  "key_assumptions",
  "alternative_explanations",
  "leading_indicators",
  "confirming_indicators",
  "invalidating_indicators",
  "coincident_indicators",
  "lagging_indicators",
  "disconfirming_evidence",
  "previous_classifications",
  "tags",
  "penalty_details",
  "confidence_factors",
  "final_outcome",
]);

// All columns that callers may update. This is the authoritative allowlist.
// Any key in `data` not in this set is silently ignored.
export const UPDATABLE_COLUMNS = new Set([
  "title",
  "thesis_statement",
  "causal_chain",
  "affected_assets",
  "expected_timeline",
  "probability_low",
  "probability_high",
  "probability_best",
  "market_pricing_assessment",
  "key_assumptions",
  "alternative_explanations",
  "leading_indicators",
  "confirming_indicators",
  "invalidating_indicators",
  "coincident_indicators",
  "lagging_indicators",
  "disconfirming_evidence",
  "strongest_bear_case",
  "what_would_make_opposite_stronger",
  "early_vs_right",
  "score_signal_quality",
  "score_signal_independence",
  "score_evidence_freshness",
  "score_data_reliability",
  "score_evidence_quantity",
  "score_evidence_layer",
  "score_causal_chain_clarity",
  "score_internal_consistency",
  "score_counter_case_robustness",
  "score_assumption_load",
  "score_timing_clarity",
  "score_structure_layer",
  "score_market_awareness",
  "score_prediction_market_divergence",
  "score_asset_reaction_gaps",
  "score_liquidity_sensitivity",
  "score_catalyst_clarity",
  "score_market_edge_layer",
  "composite_score",
  "penalty_total",
  "penalty_details",
  "confidence_level",
  "confidence_factors",
  "final_outcome",
  "classification",
  "classification_reason",
  "status",
  "quarantine_reason",
  "quarantine_until",
  "tags",
]);

export async function findAll({ status, classification } = {}, userId = "default") {
  const knex = getKnex();
  let query = knex("theses").where(userScoped(userId));
  if (status) query = query.where("status", status);
  if (classification) query = query.where("classification", classification);
  return query.orderBy("updated_at", "desc");
}

export async function findById(id, userId = "default") {
  const knex = getKnex();
  return knex("theses").where({ id, ...userScoped(userId) }).first() || null;
}

export async function create(id, data, userId = "default") {
  const knex = getKnex();
  const now = new Date().toISOString();
  const t = data;

  const row = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    title: t.title,
    thesis_statement: t.thesis_statement,
    causal_chain: t.causal_chain || [],
    affected_assets: t.affected_assets || [],
    expected_timeline: t.expected_timeline || {},
    probability_low: t.probability_low ?? 0.2,
    probability_high: t.probability_high ?? 0.6,
    probability_best: t.probability_best ?? 0.4,
    market_pricing_assessment: t.market_pricing_assessment || {},
    key_assumptions: t.key_assumptions || [],
    alternative_explanations: t.alternative_explanations || [],
    leading_indicators: t.leading_indicators || [],
    confirming_indicators: t.confirming_indicators || [],
    invalidating_indicators: t.invalidating_indicators || [],
    coincident_indicators: t.coincident_indicators || [],
    lagging_indicators: t.lagging_indicators || [],
    disconfirming_evidence: t.disconfirming_evidence || [],
    strongest_bear_case: t.strongest_bear_case || "",
    what_would_make_opposite_stronger: t.what_would_make_opposite_stronger || "",
    early_vs_right: t.early_vs_right || null,
    status: t.status || "draft",
    classification: t.classification || "WATCH",
    tags: t.tags || [],
  };

  await knex("theses").insert(row);
  return findById(id, userId);
}

export async function update(id, data, userId = "default") {
  const knex = getKnex();
  const existing = await knex("theses").where({ id, ...userScoped(userId) }).first();
  if (!existing) return null;

  const now = new Date().toISOString();

  // --- Derived fields computed from data + existing state ---

  // Track classification changes
  let prevClassifications = existing.previous_classifications || [];
  if (typeof prevClassifications === "string") {
    try { prevClassifications = JSON.parse(prevClassifications); } catch { prevClassifications = []; }
  }
  if (data.classification && data.classification !== existing.classification) {
    prevClassifications.push({
      date: now,
      from: existing.classification,
      to: data.classification,
      reason: data.classification_reason || "manual change",
    });
  }

  // Calibration snapshots
  let scoreAtCreation = existing.score_at_creation;
  let classificationAtCreation = existing.classification_at_creation;
  if (data.composite_score != null && scoreAtCreation == null) {
    scoreAtCreation = data.composite_score;
    classificationAtCreation = data.classification || existing.classification;
  }

  let scoreAtApproval = existing.score_at_approval;
  if (
    data.status === "approved" &&
    existing.status !== "approved" &&
    data.composite_score != null
  ) {
    scoreAtApproval = data.composite_score;
  }

  // --- Build update object from provided fields ---
  const updates = { updated_at: now };

  for (const [key, value] of Object.entries(data)) {
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    updates[key] = value;
  }

  // Always write derived fields
  updates.previous_classifications = prevClassifications;
  updates.score_at_creation = scoreAtCreation;
  updates.score_at_approval = scoreAtApproval;
  updates.classification_at_creation = classificationAtCreation;

  await knex("theses").where({ id }).update(updates);
  return findById(id, userId);
}

export async function remove(id, userId = "default") {
  const knex = getKnex();
  await knex("theses").where({ id, ...userScoped(userId) }).del();
}
