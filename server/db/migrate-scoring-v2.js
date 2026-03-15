// ============================================================
// MIGRATION: Three-layer scoring model
// ============================================================
// Adds new score columns, confidence tracking, and calibration fields
// to the theses table. Safe to run multiple times (uses IF NOT EXISTS pattern).
// ============================================================

import { getDb } from './connection.js';

const NEW_COLUMNS = [
  // Evidence layer
  ['score_evidence_freshness', 'REAL'],
  ['score_data_reliability', 'REAL'],
  ['score_evidence_quantity', 'REAL'],
  ['score_evidence_layer', 'REAL'],

  // Structure layer
  ['score_causal_chain_clarity', 'REAL'],
  ['score_internal_consistency', 'REAL'],
  ['score_counter_case_robustness', 'REAL'],
  ['score_assumption_load', 'REAL'],
  ['score_timing_clarity', 'REAL'],
  ['score_structure_layer', 'REAL'],

  // Market Edge layer
  ['score_market_awareness', 'REAL'],
  ['score_prediction_market_divergence', 'REAL'],
  ['score_asset_reaction_gaps', 'REAL'],
  ['score_liquidity_sensitivity', 'REAL'],
  ['score_catalyst_clarity', 'REAL'],
  ['score_market_edge_layer', 'REAL'],

  // Penalties
  ['penalty_total', 'REAL'],
  ['penalty_details', 'TEXT'],

  // Confidence
  ['confidence_level', 'REAL'],
  ['confidence_factors', 'TEXT'],

  // Calibration
  ['score_at_creation', 'REAL'],
  ['score_at_approval', 'REAL'],
  ['classification_at_creation', 'TEXT'],
  ['final_outcome', 'TEXT'],
];

export function migrateScoringV2() {
  const db = getDb();

  // Get existing columns
  const existingCols = new Set(
    db.prepare("PRAGMA table_info('theses')").all().map(c => c.name)
  );

  let added = 0;
  for (const [name, type] of NEW_COLUMNS) {
    if (!existingCols.has(name)) {
      db.exec(`ALTER TABLE theses ADD COLUMN ${name} ${type}`);
      added++;
    }
  }

  if (added > 0) {
    console.log(`[Migration] scoring-v2: Added ${added} new columns to theses table`);
  } else {
    console.log('[Migration] scoring-v2: All columns already exist, no changes needed');
  }

  return added;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateScoringV2();
  console.log('Migration complete.');
}
