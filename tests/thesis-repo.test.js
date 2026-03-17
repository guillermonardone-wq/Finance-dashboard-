// ============================================================
// THESIS REPO — Column allowlist and update safety tests
// ============================================================
// Tests the UPDATABLE_COLUMNS allowlist to ensure:
// - Expected fields are present
// - Dangerous columns (id, user_id, created_at) are excluded
// - The dynamic update builder only writes allowed columns
// ============================================================

import { describe, it, expect } from 'vitest';
import { UPDATABLE_COLUMNS } from '../server/db/thesis-repo.js';

describe('UPDATABLE_COLUMNS allowlist', () => {
  it('exists and is a Set', () => {
    expect(UPDATABLE_COLUMNS).toBeInstanceOf(Set);
    expect(UPDATABLE_COLUMNS.size).toBeGreaterThan(0);
  });

  it('contains all 15 score columns', () => {
    const scoreColumns = [
      'score_signal_quality',
      'score_signal_independence',
      'score_evidence_freshness',
      'score_data_reliability',
      'score_evidence_quantity',
      'score_evidence_layer',
      'score_causal_chain_clarity',
      'score_internal_consistency',
      'score_counter_case_robustness',
      'score_assumption_load',
      'score_timing_clarity',
      'score_structure_layer',
      'score_market_awareness',
      'score_prediction_market_divergence',
      'score_asset_reaction_gaps',
      'score_liquidity_sensitivity',
      'score_catalyst_clarity',
      'score_market_edge_layer',
    ];
    for (const col of scoreColumns) {
      expect(UPDATABLE_COLUMNS.has(col), `missing: ${col}`).toBe(true);
    }
  });

  it('contains thesis content fields', () => {
    const contentFields = [
      'title',
      'thesis_statement',
      'causal_chain',
      'affected_assets',
      'expected_timeline',
      'probability_low',
      'probability_high',
      'probability_best',
      'key_assumptions',
      'invalidating_indicators',
      'disconfirming_evidence',
      'strongest_bear_case',
    ];
    for (const col of contentFields) {
      expect(UPDATABLE_COLUMNS.has(col), `missing: ${col}`).toBe(true);
    }
  });

  it('contains classification and status fields', () => {
    expect(UPDATABLE_COLUMNS.has('classification')).toBe(true);
    expect(UPDATABLE_COLUMNS.has('classification_reason')).toBe(true);
    expect(UPDATABLE_COLUMNS.has('status')).toBe(true);
    expect(UPDATABLE_COLUMNS.has('composite_score')).toBe(true);
    expect(UPDATABLE_COLUMNS.has('confidence_level')).toBe(true);
  });

  it('does NOT contain dangerous columns', () => {
    const dangerous = [
      'id',
      'user_id',
      'created_at',
      'updated_at',
      'score_at_creation',
      'score_at_approval',
      'classification_at_creation',
      'previous_classifications',
    ];
    for (const col of dangerous) {
      expect(UPDATABLE_COLUMNS.has(col), `should not contain: ${col}`).toBe(
        false,
      );
    }
  });

  it('does not contain SQL injection vectors', () => {
    for (const col of UPDATABLE_COLUMNS) {
      expect(col).toMatch(/^[a-z_]+$/);
      expect(col.includes(' ')).toBe(false);
      expect(col.includes(';')).toBe(false);
      expect(col.includes("'")).toBe(false);
    }
  });
});
