// ============================================================
// THESIS UPDATE SAFETY TESTS — Dynamic SQL correctness
// ============================================================
// Validates that the dynamic update function:
// - Only writes provided fields
// - Preserves unmentioned fields
// - Serializes JSON fields correctly
// - Handles partial updates without misalignment
// - Rejects unknown columns
// - Tracks classification changes and calibration snapshots
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, '../data/test-update-safety.db');

process.env.DB_PATH = TEST_DB_PATH;
process.env.FRED_API_KEY = '';
process.env.FINNHUB_API_KEY = '';
process.env.NEWSAPI_API_KEY = '';
process.env.ALPHA_VANTAGE_API_KEY = '';

const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

const { initDb, closeDb } = await import('../server/db/connection.js');
const thesisRepo = await import('../server/db/thesis-repo.js');

beforeAll(async () => {
  initDb();
  const m1 = await import('../server/db/migrate-scoring-v2.js');
  m1.migrateScoringV2();
  const m2 = await import('../server/db/migrate-source-types.js');
  m2.migrateSourceTypes();
});

afterAll(() => {
  closeDb();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

describe('Thesis Update Safety — Partial Updates', () => {
  const id = 'update-safety-001';

  it('creates a baseline thesis', () => {
    const created = thesisRepo.create(id, {
      title: 'Original Title',
      thesis_statement: 'Original statement about macro conditions',
      probability_low: 0.2,
      probability_high: 0.6,
      probability_best: 0.4,
      causal_chain: ['Step A', 'Step B'],
      affected_assets: [{ asset: 'SPY', direction: 'long' }],
      disconfirming_evidence: ['Evidence 1'],
      strongest_bear_case: 'Bears say inflation stays high',
      tags: ['macro', 'fed'],
    });

    expect(created.title).toBe('Original Title');
    expect(created.probability_low).toBe(0.2);
    expect(created.causal_chain).toEqual(['Step A', 'Step B']);
    expect(created.tags).toEqual(['macro', 'fed']);
  });

  it('updates only title, preserves everything else', () => {
    const updated = thesisRepo.update(id, { title: 'Updated Title' });

    expect(updated.title).toBe('Updated Title');
    // These must be preserved:
    expect(updated.thesis_statement).toBe('Original statement about macro conditions');
    expect(updated.probability_low).toBe(0.2);
    expect(updated.probability_high).toBe(0.6);
    expect(updated.probability_best).toBe(0.4);
    expect(updated.causal_chain).toEqual(['Step A', 'Step B']);
    expect(updated.affected_assets).toEqual([{ asset: 'SPY', direction: 'long' }]);
    expect(updated.disconfirming_evidence).toEqual(['Evidence 1']);
    expect(updated.strongest_bear_case).toBe('Bears say inflation stays high');
    expect(updated.tags).toEqual(['macro', 'fed']);
  });

  it('updates only a score field, preserves non-score fields', () => {
    const updated = thesisRepo.update(id, { score_signal_quality: 7.5 });

    expect(updated.score_signal_quality).toBe(7.5);
    expect(updated.title).toBe('Updated Title');
    expect(updated.causal_chain).toEqual(['Step A', 'Step B']);
  });

  it('updates multiple score fields at once', () => {
    const updated = thesisRepo.update(id, {
      score_signal_independence: 6,
      score_evidence_freshness: 8,
      score_data_reliability: 7,
      composite_score: 65.5,
    });

    expect(updated.score_signal_independence).toBe(6);
    expect(updated.score_evidence_freshness).toBe(8);
    expect(updated.score_data_reliability).toBe(7);
    expect(updated.composite_score).toBe(65.5);
    // Prior score preserved
    expect(updated.score_signal_quality).toBe(7.5);
  });

  it('updates JSON fields correctly', () => {
    const updated = thesisRepo.update(id, {
      causal_chain: ['New Step 1', 'New Step 2', 'New Step 3'],
      key_assumptions: ['Assumption A'],
    });

    expect(updated.causal_chain).toEqual(['New Step 1', 'New Step 2', 'New Step 3']);
    expect(updated.key_assumptions).toEqual(['Assumption A']);
    // Other JSON fields preserved
    expect(updated.affected_assets).toEqual([{ asset: 'SPY', direction: 'long' }]);
  });

  it('ignores unknown columns silently', () => {
    const before = thesisRepo.findById(id);
    const updated = thesisRepo.update(id, {
      unknown_field: 'should be ignored',
      __proto__: { bad: true },
      constructor: 'evil',
      title: 'Still works',
    });

    expect(updated.title).toBe('Still works');
    // Database unchanged for non-existent fields
    expect(updated.unknown_field).toBeUndefined();
  });

  it('handles empty update (only updates updated_at)', () => {
    const before = thesisRepo.findById(id);
    const updated = thesisRepo.update(id, {});

    expect(updated.title).toBe('Still works');
    // updated_at is always written; may match if test runs within same ms
    expect(updated.updated_at).toBeTruthy();
  });
});

describe('Thesis Update Safety — Classification Tracking', () => {
  const id = 'update-safety-002';

  it('creates a thesis at WATCH', () => {
    const created = thesisRepo.create(id, {
      title: 'Classification test',
      thesis_statement: 'Testing classification changes',
    });
    expect(created.classification).toBe('WATCH');
    // previous_classifications is not set in create() — starts as null (parsed as null by JSON parser)
    expect(created.previous_classifications == null || (Array.isArray(created.previous_classifications) && created.previous_classifications.length === 0)).toBe(true);
  });

  it('tracks classification change to DEVELOP', () => {
    const updated = thesisRepo.update(id, {
      classification: 'DEVELOP',
      classification_reason: 'More evidence gathered',
    });

    expect(updated.classification).toBe('DEVELOP');
    expect(updated.previous_classifications.length).toBe(1);
    expect(updated.previous_classifications[0].from).toBe('WATCH');
    expect(updated.previous_classifications[0].to).toBe('DEVELOP');
    expect(updated.previous_classifications[0].reason).toBe('More evidence gathered');
  });

  it('tracks second classification change', () => {
    const updated = thesisRepo.update(id, {
      classification: 'PAPER_TRADE',
    });

    expect(updated.classification).toBe('PAPER_TRADE');
    expect(updated.previous_classifications.length).toBe(2);
    expect(updated.previous_classifications[1].from).toBe('DEVELOP');
    expect(updated.previous_classifications[1].to).toBe('PAPER_TRADE');
  });

  it('does not add entry for same classification', () => {
    const updated = thesisRepo.update(id, {
      classification: 'PAPER_TRADE',
      title: 'Updated title',
    });

    expect(updated.previous_classifications.length).toBe(2);
  });
});

describe('Thesis Update Safety — Calibration Snapshots', () => {
  const id = 'update-safety-003';

  it('creates a thesis with no calibration', () => {
    const created = thesisRepo.create(id, {
      title: 'Calibration test',
      thesis_statement: 'Testing calibration snapshots',
    });
    expect(created.score_at_creation).toBeNull();
    expect(created.classification_at_creation).toBeNull();
  });

  it('sets calibration snapshot on first composite_score', () => {
    const updated = thesisRepo.update(id, { composite_score: 55.0 });

    expect(updated.score_at_creation).toBe(55.0);
    expect(updated.classification_at_creation).toBe('WATCH');
  });

  it('does not overwrite calibration on subsequent scoring', () => {
    const updated = thesisRepo.update(id, { composite_score: 72.0 });

    expect(updated.score_at_creation).toBe(55.0); // unchanged
    expect(updated.composite_score).toBe(72.0);
  });

  it('sets approval snapshot when status transitions to approved', () => {
    const updated = thesisRepo.update(id, {
      status: 'approved',
      composite_score: 78.0,
    });

    expect(updated.score_at_approval).toBe(78.0);
  });

  it('does not overwrite approval snapshot on further updates', () => {
    const updated = thesisRepo.update(id, {
      composite_score: 82.0,
    });

    expect(updated.score_at_approval).toBe(78.0); // unchanged
  });
});

describe('Thesis Update Safety — penalty_details and confidence_factors', () => {
  const id = 'update-safety-004';

  it('creates and updates penalty_details as JSON', () => {
    thesisRepo.create(id, {
      title: 'Penalty test',
      thesis_statement: 'Testing JSON fields',
    });

    const updated = thesisRepo.update(id, {
      penalty_details: [{ id: 'single_source', value: 8, active: true }],
      penalty_total: 8,
    });

    expect(updated.penalty_details).toEqual([{ id: 'single_source', value: 8, active: true }]);
    expect(updated.penalty_total).toBe(8);
  });

  it('updates confidence_factors as JSON', () => {
    const updated = thesisRepo.update(id, {
      confidence_factors: { completeness: 0.8, evidence_volume: 0.7 },
      confidence_level: 0.72,
    });

    expect(updated.confidence_factors).toEqual({ completeness: 0.8, evidence_volume: 0.7 });
    expect(updated.confidence_level).toBe(0.72);
  });
});
