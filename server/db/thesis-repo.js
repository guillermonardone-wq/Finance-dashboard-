// ============================================================
// THESIS REPOSITORY — DB access layer for theses
// ============================================================
// Isolates all direct database queries for theses into one file.
// Routes call these functions instead of touching getDb() directly.
// This creates a clean seam for future database migration.
// ============================================================

import { getDb } from "./connection.js";

const JSON_FIELDS = [
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
];

function parseJsonFields(row) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (parsed[field] && typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        /* leave as string */
      }
    }
  }
  return parsed;
}

export function findAll({ status, classification } = {}) {
  const db = getDb();
  let sql = "SELECT * FROM theses WHERE 1=1";
  const params = [];
  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (classification) {
    sql += " AND classification = ?";
    params.push(classification);
  }
  sql += " ORDER BY updated_at DESC";
  return db
    .prepare(sql)
    .all(...params)
    .map(parseJsonFields);
}

export function findById(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM theses WHERE id = ?").get(id);
  return row ? parseJsonFields(row) : null;
}

export function create(id, data) {
  const db = getDb();
  const now = new Date().toISOString();
  const t = data;

  db.prepare(
    `
    INSERT INTO theses (
      id, created_at, updated_at, title, thesis_statement, causal_chain,
      affected_assets, expected_timeline, probability_low, probability_high, probability_best,
      market_pricing_assessment, key_assumptions, alternative_explanations,
      leading_indicators, confirming_indicators, invalidating_indicators,
      coincident_indicators, lagging_indicators,
      disconfirming_evidence, strongest_bear_case, what_would_make_opposite_stronger,
      early_vs_right, status, classification, tags
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `,
  ).run(
    id,
    now,
    now,
    t.title,
    t.thesis_statement,
    JSON.stringify(t.causal_chain || []),
    JSON.stringify(t.affected_assets || []),
    JSON.stringify(t.expected_timeline || {}),
    t.probability_low ?? 0.2,
    t.probability_high ?? 0.6,
    t.probability_best ?? 0.4,
    JSON.stringify(t.market_pricing_assessment || {}),
    JSON.stringify(t.key_assumptions || []),
    JSON.stringify(t.alternative_explanations || []),
    JSON.stringify(t.leading_indicators || []),
    JSON.stringify(t.confirming_indicators || []),
    JSON.stringify(t.invalidating_indicators || []),
    JSON.stringify(t.coincident_indicators || []),
    JSON.stringify(t.lagging_indicators || []),
    JSON.stringify(t.disconfirming_evidence || []),
    t.strongest_bear_case || "",
    t.what_would_make_opposite_stronger || "",
    t.early_vs_right || null,
    t.status || "draft",
    t.classification || "WATCH",
    JSON.stringify(t.tags || []),
  );

  return findById(id);
}

// Fields that are stored as JSON in SQLite but exposed as objects/arrays.
const JSON_COLUMNS = new Set(JSON_FIELDS);

// All columns that callers may update. This is the authoritative allowlist.
// Any key in `data` not in this set is silently ignored — prevents SQL injection
// via crafted key names and ensures only known columns are written.
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

/**
 * Serialize a value for a given column.
 * JSON columns are stringified; everything else is passed through.
 */
function serializeValue(column, value) {
  if (value == null) return value;
  if (JSON_COLUMNS.has(column)) return JSON.stringify(value);
  return value;
}

export function update(id, data) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM theses WHERE id = ?").get(id);
  if (!existing) return null;

  const now = new Date().toISOString();

  // --- Derived fields computed from data + existing state ---

  // Track classification changes
  let prevClassifications = [];
  try {
    prevClassifications = JSON.parse(existing.previous_classifications || "[]");
  } catch {
    /* keep empty */
  }
  if (data.classification && data.classification !== existing.classification) {
    prevClassifications.push({
      date: now,
      from: existing.classification,
      to: data.classification,
      reason: data.classification_reason || "manual change",
    });
  }

  // Calibration snapshots — first score locks creation snapshot
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

  // --- Build dynamic SET clause from provided fields ---

  const setClauses = ["updated_at = ?"];
  const params = [now];

  for (const [key, value] of Object.entries(data)) {
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    setClauses.push(`${key} = ?`);
    params.push(serializeValue(key, value));
  }

  // Always write derived fields
  setClauses.push("previous_classifications = ?");
  params.push(JSON.stringify(prevClassifications));

  setClauses.push("score_at_creation = ?");
  params.push(scoreAtCreation);

  setClauses.push("score_at_approval = ?");
  params.push(scoreAtApproval);

  setClauses.push("classification_at_creation = ?");
  params.push(classificationAtCreation);

  // WHERE clause
  params.push(id);

  const sql = `UPDATE theses SET ${setClauses.join(", ")} WHERE id = ?`;
  db.prepare(sql).run(...params);

  return findById(id);
}

export function remove(id) {
  const db = getDb();
  db.prepare("DELETE FROM theses WHERE id = ?").run(id);
}
