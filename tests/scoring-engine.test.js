// ============================================================
// SCORING ENGINE TESTS — Comprehensive coverage
// ============================================================
// Tests: autoScoreThesis, estimateConfidence, computeCompositeScore,
//        computePenalties, runGates, classifyThesis,
//        all forced downgrades, threshold boundaries, penalty interactions.
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  computeCompositeScore,
  computePenalties,
  autoScoreThesis,
  estimateConfidence,
  computeTimeDecay,
  scoreEvidenceFreshness,
  detectSignalIndependence,
  scorePredictionMarketDivergence,
  LAYER_WEIGHTS,
  ALL_FACTOR_KEYS,
} from '../src/engine/scoring.js';
import { runGates } from '../src/engine/gates.js';
import { classifyThesis } from '../src/engine/classification.js';
import { runChecklist, getMaxPositionSize } from '../src/engine/behavioral.js';


// ---- Helper factories ----

function makeScores(overrides = {}) {
  const base = {
    signal_quality: 7,
    signal_independence: 6,
    evidence_freshness: 8,
    data_reliability: 7,
    evidence_quantity: 5,
    causal_chain_clarity: 8,
    internal_consistency: 7,
    counter_case_robustness: 6,
    assumption_load: 7,
    timing_clarity: 5,
    market_awareness: 6,
    prediction_market_divergence: 5,
    asset_reaction_gaps: 4,
    liquidity_sensitivity: 5,
    catalyst_clarity: 6,
  };
  return { ...base, ...overrides };
}

function makeThesis(overrides = {}) {
  return {
    id: 'test-thesis',
    title: 'Test thesis about macro events',
    thesis_statement: 'The Fed will cut rates due to employment weakness',
    causal_chain: ['Employment slows', 'CPI drops', 'Fed pivots'],
    affected_assets: [{ asset: 'SPY', direction: 'long' }],
    expected_timeline: { start: '2025-01-01', end: '2025-06-01', basis: 'Historical Fed cycles' },
    probability_low: 0.3,
    probability_high: 0.7,
    probability_best: 0.5,
    key_assumptions: ['Employment continues to weaken', 'No inflation resurgence'],
    alternative_explanations: ['Fiscal stimulus offsets monetary tightening'],
    invalidating_indicators: [{ indicator: 'CPI > 4%', description: 'Inflation re-accelerates' }],
    disconfirming_evidence: ['Strong payroll data could invalidate'],
    strongest_bear_case: 'Inflation may prove stickier than expected, preventing any rate action for years.',
    what_would_make_opposite_stronger: 'If core services inflation reaccelerates above 5% while employment stays strong, the thesis is dead.',
    leading_indicators: [{ indicator: 'Initial claims', target_state: 'Rising above 250k' }],
    status: 'active',
    classification: 'DEVELOP',
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

function makeSignals(count = 5, overrides = {}) {
  const types = ['manual', 'fred', 'newsapi', 'finnhub', 'gdelt'];
  const categories = ['central_bank_action', 'labor_market', 'inflation', 'geopolitical', 'fiscal_policy'];
  return Array.from({ length: count }, (_, i) => ({
    id: `sig-${i}`,
    title: `Signal ${i}: ${categories[i % categories.length]}`,
    source_type: types[i % types.length],
    category: categories[i % categories.length],
    reliability: i % 3 === 0 ? 'verified' : 'likely',
    signal_strength: 0.6 + (i * 0.05),
    novelty: 'developing',
    status: 'linked',
    thesis_id: 'test-thesis',
    created_at: new Date(Date.now() - (i * 12) * 3600 * 1000).toISOString(),
    ...overrides,
  }));
}

function makeGateResult(overrides = {}) {
  return {
    passed: true,
    total: 13,
    totalPassed: 13,
    totalFailed: 0,
    hardFails: [],
    softFails: [],
    results: [],
    ...overrides,
  };
}

function makeLayerScores(overrides = {}) {
  return {
    evidence: { score: 7, ...overrides.evidence },
    structure: { score: 7, ...overrides.structure },
    market_edge: { score: 6, ...overrides.market_edge },
  };
}


// ============================================================
// autoScoreThesis
// ============================================================

describe('autoScoreThesis', () => {
  it('scores all evidence factors with sufficient signals', () => {
    const thesis = makeThesis();
    const signals = makeSignals(5);
    const result = autoScoreThesis(thesis, signals, []);

    expect(result.scores.signal_quality).toBeDefined();
    expect(result.scores.signal_independence).toBeDefined();
    expect(result.scores.evidence_quantity).toBeDefined();
    expect(result.scores.data_reliability).toBeDefined();
  });

  it('scores structure factors from thesis fields', () => {
    const thesis = makeThesis();
    const result = autoScoreThesis(thesis, [], []);

    expect(result.scores.causal_chain_clarity).toBeDefined();
    expect(result.scores.internal_consistency).toBeDefined();
    expect(result.scores.counter_case_robustness).toBeDefined();
    expect(result.scores.assumption_load).toBeDefined();
    expect(result.scores.timing_clarity).toBeDefined();
  });

  it('does not auto-score liquidity_sensitivity', () => {
    const thesis = makeThesis();
    const result = autoScoreThesis(thesis, makeSignals(3), []);
    expect(result.scores.liquidity_sensitivity).toBeUndefined();
  });

  it('returns empty scores for empty thesis', () => {
    const result = autoScoreThesis({}, [], []);
    expect(result.scores.signal_quality).toBeUndefined();
    expect(result.scores.causal_chain_clarity).toBeUndefined();
  });

  it('scores market awareness from signal novelty', () => {
    const signals = makeSignals(3, { novelty: 'new' });
    const result = autoScoreThesis(makeThesis(), signals, []);
    expect(result.scores.market_awareness).toBeGreaterThan(7);
  });

  it('scores catalyst clarity from leading indicators', () => {
    const thesis = makeThesis({ leading_indicators: [
      { indicator: 'NFP', target_state: 'Below 100k' },
      { indicator: 'Claims', target_state: 'Above 250k' },
      { indicator: 'ISM', target_state: 'Below 50' },
    ]});
    const result = autoScoreThesis(thesis, [], []);
    expect(result.scores.catalyst_clarity).toBeGreaterThanOrEqual(7);
  });

  it('gives high assumption_load score when few assumptions', () => {
    const thesis = makeThesis({ key_assumptions: ['One'] });
    const result = autoScoreThesis(thesis, [], []);
    expect(result.scores.assumption_load).toBe(10);
  });

  it('gives low assumption_load score when many assumptions', () => {
    const thesis = makeThesis({
      key_assumptions: Array.from({ length: 10 }, (_, i) => `Assumption ${i}`),
    });
    const result = autoScoreThesis(thesis, [], []);
    expect(result.scores.assumption_load).toBe(1);
  });

  it('returns independence analysis with clusters and warnings', () => {
    const signals = makeSignals(4, { source_type: 'manual' });
    const result = autoScoreThesis(makeThesis(), signals, []);
    expect(result.independence).toBeDefined();
    expect(result.independence.score).toBeDefined();
  });

  it('scores prediction market divergence when data available', () => {
    const pmAssessment = {
      scoring_helpers: {
        qualifying_contract_count: 5,
        prediction_market_divergence: 0.3,
        prediction_market_confidence: 0.7,
        prediction_market_commentary: 'Moderate divergence detected',
      },
    };
    const result = autoScoreThesis(makeThesis(), [], [], pmAssessment);
    expect(result.scores.prediction_market_divergence).toBeDefined();
    expect(result.scores.prediction_market_divergence).toBeLessThanOrEqual(8);
    expect(result.predictionMarket.score).toBeDefined();
  });

  it('returns explanations for all scored factors', () => {
    const thesis = makeThesis();
    const signals = makeSignals(3);
    const result = autoScoreThesis(thesis, signals, []);

    for (const key of Object.keys(result.scores)) {
      expect(result.explanations[key]).toBeDefined();
    }
  });
});


// ============================================================
// estimateConfidence
// ============================================================

describe('estimateConfidence', () => {
  it('returns base confidence for minimal data', () => {
    const scoreResult = { completeness: 0, missing: ALL_FACTOR_KEYS };
    const result = estimateConfidence(scoreResult, [], [], null);
    expect(result.level).toBeGreaterThanOrEqual(0);
    expect(result.level).toBeLessThanOrEqual(1);
    expect(result.explanation).toContain('low');
  });

  it('increases confidence with high completeness', () => {
    const low = estimateConfidence({ completeness: 20, missing: ALL_FACTOR_KEYS.slice(0, 12) }, [], [], null);
    const high = estimateConfidence({ completeness: 100, missing: [] }, makeSignals(10), [], null);
    expect(high.level).toBeGreaterThan(low.level);
  });

  it('increases confidence with more signals', () => {
    const scoreResult = { completeness: 80, missing: ['liquidity_sensitivity'] };
    const few = estimateConfidence(scoreResult, makeSignals(2), [], null);
    const many = estimateConfidence(scoreResult, makeSignals(10), [], null);
    expect(many.level).toBeGreaterThan(few.level);
  });

  it('incorporates prediction market corroboration', () => {
    const scoreResult = { completeness: 80, missing: [] };
    const signals = makeSignals(5);
    const noPM = estimateConfidence(scoreResult, signals, [], null);
    const withPM = estimateConfidence(scoreResult, signals, [], {
      scoring_helpers: { prediction_market_confidence: 0.9 },
    });
    expect(withPM.level).toBeGreaterThan(noPM.level);
  });

  it('reduces confidence for missing factors', () => {
    const complete = estimateConfidence({ completeness: 100, missing: [] }, [], [], null);
    const incomplete = estimateConfidence({ completeness: 30, missing: ALL_FACTOR_KEYS.slice(0, 10) }, [], [], null);
    expect(complete.level).toBeGreaterThan(incomplete.level);
  });

  it('returns all factor contributions', () => {
    const scoreResult = { completeness: 80, missing: ['liquidity_sensitivity'] };
    const result = estimateConfidence(scoreResult, makeSignals(5), [], null);
    expect(result.factors.completeness).toBeDefined();
    expect(result.factors.evidence_volume).toBeDefined();
    expect(result.factors.missing_penalty).toBeDefined();
  });

  it('clamps to [0, 1]', () => {
    const result = estimateConfidence({ completeness: 100, missing: [] }, makeSignals(20), [
      { fetched_at: new Date().toISOString() },
    ], { scoring_helpers: { prediction_market_confidence: 1.0 } });
    expect(result.level).toBeLessThanOrEqual(1);
    expect(result.level).toBeGreaterThanOrEqual(0);
  });
});


// ============================================================
// computeCompositeScore
// ============================================================

describe('computeCompositeScore', () => {
  it('returns 0 for empty scores', () => {
    const result = computeCompositeScore({});
    expect(result.composite).toBe(0);
    expect(result.completeness).toBe(0);
  });

  it('returns full score for perfect 10s', () => {
    const scores = {};
    for (const key of ALL_FACTOR_KEYS) scores[key] = 10;
    const result = computeCompositeScore(scores);
    expect(result.composite).toBe(100);
    expect(result.completeness).toBe(100);
  });

  it('respects layer weights (evidence=40%, structure=35%, market_edge=25%)', () => {
    // All evidence at 10, rest at 0
    const evidenceOnly = {};
    for (const key of ['signal_quality', 'signal_independence', 'evidence_freshness', 'data_reliability', 'evidence_quantity']) {
      evidenceOnly[key] = 10;
    }
    const result = computeCompositeScore(evidenceOnly);
    // Evidence layer = 10, others = 0. Composite = 10 * 0.40 * 10 = 40
    expect(result.layers.evidence.score).toBe(10);
    expect(result.rawComposite).toBeCloseTo(40, 0);
  });

  it('subtracts penalties from raw composite', () => {
    const scores = makeScores();
    const noPenalty = computeCompositeScore(scores);
    const withPenalty = computeCompositeScore(scores, { items: [{ active: true, value: 10 }] });
    expect(withPenalty.composite).toBe(noPenalty.composite - 10);
  });

  it('floors composite at 0 even with large penalties', () => {
    const scores = makeScores({ signal_quality: 1 });
    const result = computeCompositeScore(scores, { items: [{ active: true, value: 200 }] });
    expect(result.composite).toBe(0);
  });

  it('reports missing factors', () => {
    const result = computeCompositeScore({ signal_quality: 7 });
    expect(result.missing).toContain('signal_independence');
    expect(result.missing).toContain('timing_clarity');
    expect(result.missing.length).toBe(14);
  });
});


// ============================================================
// computePenalties
// ============================================================

describe('computePenalties', () => {
  it('detects missing invalidation', () => {
    const result = computePenalties({}, [], { invalidating_indicators: [] });
    const p = result.items.find(i => i.id === 'missing_invalidation');
    expect(p.active).toBe(true);
    expect(p.value).toBe(10);
  });

  it('does not penalize when invalidation exists', () => {
    const result = computePenalties({}, [], { invalidating_indicators: [{ indicator: 'CPI' }] });
    const p = result.items.find(i => i.id === 'missing_invalidation');
    expect(p.active).toBe(false);
    expect(p.value).toBe(0);
  });

  it('detects single source signals', () => {
    const signals = [{ source_type: 'manual' }, { source_type: 'manual' }];
    const result = computePenalties({}, signals, { invalidating_indicators: ['x'] });
    const p = result.items.find(i => i.id === 'single_source');
    expect(p.active).toBe(true);
    expect(p.value).toBe(8);
  });

  it('does not penalize diverse sources', () => {
    const signals = [{ source_type: 'manual' }, { source_type: 'fred' }];
    const result = computePenalties({}, signals, { invalidating_indicators: ['x'] });
    const p = result.items.find(i => i.id === 'single_source');
    expect(p.active).toBe(false);
  });

  it('detects stale data', () => {
    const result = computePenalties({ evidence_freshness: 2 }, [], { invalidating_indicators: ['x'] });
    const p = result.items.find(i => i.id === 'stale_data');
    expect(p.active).toBe(true);
    expect(p.value).toBe(4);
  });

  it('detects narrative bias', () => {
    const result = computePenalties(
      { counter_case_robustness: 2, internal_consistency: 9 },
      [], { invalidating_indicators: ['x'] }
    );
    const p = result.items.find(i => i.id === 'narrative_bias');
    expect(p.active).toBe(true);
    expect(p.value).toBeGreaterThan(0);
  });

  it('detects already-priced condition', () => {
    const result = computePenalties(
      { market_awareness: 9, asset_reaction_gaps: 1 },
      [], { invalidating_indicators: ['x'] }
    );
    const p = result.items.find(i => i.id === 'already_priced');
    expect(p.active).toBe(true);
  });

  it('caps each penalty at maxPenalty', () => {
    const result = computePenalties(
      { evidence_freshness: 0, counter_case_robustness: 0, internal_consistency: 10, market_awareness: 10, asset_reaction_gaps: 0 },
      [{ source_type: 'a' }, { source_type: 'a' }],
      { invalidating_indicators: [] }
    );
    for (const item of result.items) {
      expect(item.value).toBeLessThanOrEqual(item.maxPenalty);
    }
  });

  it('sums total correctly', () => {
    const result = computePenalties({}, [], { invalidating_indicators: [] });
    const sum = result.items.reduce((s, i) => s + i.value, 0);
    expect(result.total).toBeCloseTo(sum, 2);
  });
});


// ============================================================
// Time Decay and Evidence Freshness
// ============================================================

describe('computeTimeDecay', () => {
  it('returns 1.0 for age 0', () => {
    expect(computeTimeDecay(0)).toBe(1);
  });

  it('returns 0.5 at half-life (24h)', () => {
    expect(computeTimeDecay(24)).toBeCloseTo(0.5, 5);
  });

  it('returns ~0.125 at 72h', () => {
    expect(computeTimeDecay(72)).toBeCloseTo(0.125, 3);
  });

  it('clamps to [0, 1]', () => {
    expect(computeTimeDecay(1000)).toBeGreaterThanOrEqual(0);
    expect(computeTimeDecay(-1)).toBeLessThanOrEqual(1);
  });
});

describe('scoreEvidenceFreshness', () => {
  it('returns null for empty observations', () => {
    expect(scoreEvidenceFreshness([])).toBeNull();
    expect(scoreEvidenceFreshness(null)).toBeNull();
  });

  it('returns high score for fresh data', () => {
    const obs = [{ fetched_at: new Date().toISOString() }];
    const score = scoreEvidenceFreshness(obs);
    expect(score).toBeGreaterThanOrEqual(9);
  });

  it('returns low score for old data', () => {
    const old = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    const obs = [{ fetched_at: old }];
    const score = scoreEvidenceFreshness(obs);
    expect(score).toBeLessThan(3);
  });
});


// ============================================================
// Signal Independence
// ============================================================

describe('detectSignalIndependence', () => {
  it('returns 0 for no signals', () => {
    expect(detectSignalIndependence([]).score).toBe(0);
  });

  it('returns 2 for single signal', () => {
    expect(detectSignalIndependence([{ source_type: 'manual', category: 'macro', created_at: new Date().toISOString() }]).score).toBe(2);
  });

  it('scores higher with diverse sources', () => {
    const diverse = makeSignals(5); // 5 different source types
    const uniform = makeSignals(5, { source_type: 'manual' });
    const diverseResult = detectSignalIndependence(diverse);
    const uniformResult = detectSignalIndependence(uniform);
    expect(diverseResult.score).toBeGreaterThan(uniformResult.score);
  });

  it('penalizes similar content', () => {
    const similar = Array.from({ length: 5 }, () => ({
      id: 'x',
      title: 'Same title',
      source_type: 'manual',
      category: 'macro',
      created_at: new Date().toISOString(),
    }));
    const result = detectSignalIndependence(similar);
    expect(result.warnings.some(w => w.includes('similarity'))).toBe(true);
  });
});


// ============================================================
// Prediction Market Divergence
// ============================================================

describe('scorePredictionMarketDivergence', () => {
  it('returns null for missing data', () => {
    expect(scorePredictionMarketDivergence(null).score).toBeNull();
  });

  it('returns null for insufficient contracts', () => {
    const result = scorePredictionMarketDivergence({
      scoring_helpers: { qualifying_contract_count: 1, prediction_market_divergence: 0.5, prediction_market_confidence: 0.8 },
    });
    expect(result.score).toBeNull();
  });

  it('returns null for low confidence', () => {
    const result = scorePredictionMarketDivergence({
      scoring_helpers: { qualifying_contract_count: 5, prediction_market_divergence: 0.5, prediction_market_confidence: 0.3 },
    });
    expect(result.score).toBeNull();
  });

  it('caps at 8/10', () => {
    const result = scorePredictionMarketDivergence({
      scoring_helpers: { qualifying_contract_count: 10, prediction_market_divergence: 100, prediction_market_confidence: 0.95 },
    });
    expect(result.score).toBeLessThanOrEqual(8);
  });

  it('scores with valid data', () => {
    const result = scorePredictionMarketDivergence({
      scoring_helpers: { qualifying_contract_count: 5, prediction_market_divergence: 0.3, prediction_market_confidence: 0.7 },
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.confidence).toBe(0.7);
  });
});


// ============================================================
// runGates
// ============================================================

describe('runGates', () => {
  it('passes all gates with complete thesis + execution plan', () => {
    const thesis = makeThesis();
    const executionPlan = {
      max_risk_dollars: 5000,
      max_risk_percent: 2,
      expression_vehicle: 'SPY puts',
    };
    const signals = makeSignals(5).map(s => ({ ...s, thesis_id: thesis.id, status: 'linked' }));
    const checklistAnswers = { emotional_state: 'calm', would_take_if_not_mine: true };

    const result = runGates(thesis, executionPlan, signals, checklistAnswers);
    expect(result.hardFails.length).toBe(0);
  });

  it('blocks on missing invalidation', () => {
    const thesis = makeThesis({ invalidating_indicators: [] });
    const result = runGates(thesis);
    const fail = result.hardFails.find(f => f.id === 'invalidation_defined');
    expect(fail).toBeDefined();
    expect(result.passed).toBe(false);
  });

  it('blocks on missing disconfirming evidence', () => {
    const thesis = makeThesis({ disconfirming_evidence: [] });
    const result = runGates(thesis);
    const fail = result.hardFails.find(f => f.id === 'disconfirming_case');
    expect(fail).toBeDefined();
  });

  it('blocks on missing bear case', () => {
    const thesis = makeThesis({ strongest_bear_case: '' });
    const result = runGates(thesis);
    const fail = result.hardFails.find(f => f.id === 'bear_case_written');
    expect(fail).toBeDefined();
  });

  it('blocks on missing time horizon', () => {
    const thesis = makeThesis({ expected_timeline: {} });
    const result = runGates(thesis);
    const fail = result.hardFails.find(f => f.id === 'time_horizon');
    expect(fail).toBeDefined();
  });

  it('blocks on missing risk definition', () => {
    const thesis = makeThesis();
    const result = runGates(thesis, null);
    const fail = result.hardFails.find(f => f.id === 'max_risk_defined');
    expect(fail).toBeDefined();
  });

  it('blocks on missing expression vehicle', () => {
    const result = runGates(makeThesis(), { max_risk_dollars: 1000 });
    const fail = result.hardFails.find(f => f.id === 'expression_vehicle');
    expect(fail).toBeDefined();
  });

  it('blocks on dangerous emotional state', () => {
    const result = runGates(makeThesis(), null, [], { emotional_state: 'fomo' });
    const fail = result.hardFails.find(f => f.id === 'emotional_neutrality');
    expect(fail).toBeDefined();
  });

  it('allows calm emotional state', () => {
    const result = runGates(makeThesis(), null, [], { emotional_state: 'calm' });
    const emo = result.results.find(r => r.id === 'emotional_neutrality');
    expect(emo.passed).toBe(true);
  });

  it('soft-fails on few signals', () => {
    const thesis = makeThesis();
    const signals = [{ thesis_id: thesis.id, status: 'linked', source_type: 'a' }];
    const result = runGates(thesis, null, signals);
    const fail = result.softFails.find(f => f.id === 'min_confirming_signals');
    expect(fail).toBeDefined();
  });

  it('soft-fails on narrow probability range', () => {
    const thesis = makeThesis({ probability_low: 0.5, probability_high: 0.55 });
    const result = runGates(thesis);
    const fail = result.softFails.find(f => f.id === 'probability_honesty');
    expect(fail).toBeDefined();
  });

  it('soft-fails on cooling-off for new thesis', () => {
    const thesis = makeThesis({ created_at: new Date().toISOString(), quarantine_until: null });
    const result = runGates(thesis);
    const fail = result.softFails.find(f => f.id === 'sleep_on_it');
    expect(fail).toBeDefined();
  });

  it('passes cooling-off for old thesis', () => {
    const thesis = makeThesis({ created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() });
    const result = runGates(thesis);
    const gate = result.results.find(r => r.id === 'sleep_on_it');
    expect(gate.passed).toBe(true);
  });

  it('returns correct total counts', () => {
    const result = runGates(makeThesis());
    expect(result.total).toBe(13);
    expect(result.totalPassed + result.totalFailed).toBe(result.total);
  });
});


// ============================================================
// classifyThesis — Score-based classification
// ============================================================

describe('classifyThesis — score thresholds', () => {
  const passingGates = makeGateResult();
  const defaultThesis = makeThesis();
  const goodLayers = makeLayerScores();

  it('classifies IGNORE for score < 35', () => {
    const r = classifyThesis(34, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('IGNORE');
  });

  it('classifies WATCH at score 35', () => {
    const r = classifyThesis(35, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('WATCH');
  });

  it('classifies WATCH at score 49', () => {
    const r = classifyThesis(49, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('WATCH');
  });

  it('classifies DEVELOP at score 50', () => {
    const r = classifyThesis(50, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('classifies DEVELOP at score 64', () => {
    const r = classifyThesis(64, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('classifies PAPER_TRADE at score 65', () => {
    const r = classifyThesis(65, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('PAPER_TRADE');
  });

  it('classifies SMALL_POSITION at score 75', () => {
    const r = classifyThesis(75, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('SMALL_POSITION');
  });

  it('classifies SMALL_POSITION at score 84', () => {
    const r = classifyThesis(84, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('SMALL_POSITION');
  });

  it('classifies FULLY_QUALIFIED at score 85', () => {
    const r = classifyThesis(85, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('FULLY_QUALIFIED');
  });

  it('classifies FULLY_QUALIFIED at score 100', () => {
    const r = classifyThesis(100, makeScores(), passingGates, defaultThesis, goodLayers);
    expect(r.classification).toBe('FULLY_QUALIFIED');
  });
});


// ============================================================
// classifyThesis — Forced downgrades
// ============================================================

describe('classifyThesis — forced downgrades', () => {
  const passingGates = makeGateResult();
  const thesis = makeThesis();
  const goodLayers = makeLayerScores();

  it('caps at WATCH when signal_quality < 3', () => {
    const r = classifyThesis(90, makeScores({ signal_quality: 2 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('WATCH');
    expect(r.overrideActive).toBe(true);
  });

  it('caps at WATCH when signal_independence < 3', () => {
    const r = classifyThesis(90, makeScores({ signal_independence: 2 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('WATCH');
  });

  it('caps at DEVELOP when evidence_freshness < 3', () => {
    const r = classifyThesis(90, makeScores({ evidence_freshness: 2 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('caps at WATCH when causal_chain_clarity < 3', () => {
    const r = classifyThesis(90, makeScores({ causal_chain_clarity: 2 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('WATCH');
  });

  it('caps at DEVELOP when counter_case_robustness < 4', () => {
    const r = classifyThesis(90, makeScores({ counter_case_robustness: 3 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('caps at WATCH when timing_clarity < 4', () => {
    const r = classifyThesis(90, makeScores({ timing_clarity: 3 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('WATCH');
  });

  it('caps at DEVELOP when assumption_load < 3', () => {
    const r = classifyThesis(90, makeScores({ assumption_load: 2 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('caps at DEVELOP when catalyst_clarity < 3', () => {
    const r = classifyThesis(90, makeScores({ catalyst_clarity: 2 }), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('does not downgrade when factors above thresholds', () => {
    const r = classifyThesis(90, makeScores(), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('FULLY_QUALIFIED');
    expect(r.overrideActive).toBe(false);
  });
});


// ============================================================
// classifyThesis — Layer minimums
// ============================================================

describe('classifyThesis — layer minimums', () => {
  const passingGates = makeGateResult();
  const thesis = makeThesis();

  it('caps at WATCH when evidence layer < 3', () => {
    const layers = makeLayerScores({ evidence: { score: 2 } });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, layers);
    expect(r.classification).toBe('WATCH');
  });

  it('caps at WATCH when structure layer < 3', () => {
    const layers = makeLayerScores({ structure: { score: 2 } });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, layers);
    expect(r.classification).toBe('WATCH');
  });

  it('caps at DEVELOP when evidence layer < 5', () => {
    const layers = makeLayerScores({ evidence: { score: 4 } });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, layers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('caps at DEVELOP when structure layer < 5', () => {
    const layers = makeLayerScores({ structure: { score: 4 } });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, layers);
    expect(r.classification).toBe('DEVELOP');
  });
});


// ============================================================
// classifyThesis — Gate-driven downgrades
// ============================================================

describe('classifyThesis — gate-driven downgrades', () => {
  const thesis = makeThesis();
  const goodLayers = makeLayerScores();

  it('caps at DEVELOP when hard gates fail', () => {
    const failedGates = makeGateResult({
      passed: false,
      hardFails: [{ id: 'invalidation_defined', name: 'Invalidation', severity: 'hard' }],
    });
    const r = classifyThesis(90, makeScores(), failedGates, thesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('downgrades by 1 level for 2 soft failures', () => {
    const softGates = makeGateResult({
      softFails: [
        { id: 'a', name: 'Soft 1', severity: 'soft' },
        { id: 'b', name: 'Soft 2', severity: 'soft' },
      ],
    });
    const r = classifyThesis(85, makeScores(), softGates, thesis, goodLayers);
    expect(r.classification).toBe('SMALL_POSITION');
  });

  it('downgrades by 2 levels for 4 soft failures', () => {
    const softGates = makeGateResult({
      softFails: Array.from({ length: 4 }, (_, i) => ({ id: `s${i}`, name: `Soft ${i}`, severity: 'soft' })),
    });
    const r = classifyThesis(85, makeScores(), softGates, thesis, goodLayers);
    expect(r.classification).toBe('PAPER_TRADE');
  });
});


// ============================================================
// classifyThesis — Assumption overload
// ============================================================

describe('classifyThesis — assumption overload', () => {
  const passingGates = makeGateResult();
  const goodLayers = makeLayerScores();

  it('caps at WATCH for > 7 assumptions', () => {
    const thesis = makeThesis({ key_assumptions: Array.from({ length: 8 }, (_, i) => `A${i}`) });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('WATCH');
  });

  it('caps at DEVELOP for 6-7 assumptions', () => {
    const thesis = makeThesis({ key_assumptions: Array.from({ length: 6 }, (_, i) => `A${i}`) });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('DEVELOP');
  });

  it('no cap for <= 5 assumptions', () => {
    const thesis = makeThesis({ key_assumptions: ['A', 'B', 'C'] });
    const r = classifyThesis(90, makeScores(), passingGates, thesis, goodLayers);
    expect(r.classification).toBe('FULLY_QUALIFIED');
  });
});


// ============================================================
// classifyThesis — Penalty-driven downgrade
// ============================================================

describe('classifyThesis — penalty-driven downgrade', () => {
  it('caps at DEVELOP when penalty total > 15', () => {
    const r = classifyThesis(90, { ...makeScores(), _penaltyTotal: 20 }, makeGateResult(), makeThesis(), makeLayerScores());
    expect(r.classification).toBe('DEVELOP');
  });

  it('no cap when penalty total <= 15', () => {
    const r = classifyThesis(90, { ...makeScores(), _penaltyTotal: 10 }, makeGateResult(), makeThesis(), makeLayerScores());
    expect(r.classification).toBe('FULLY_QUALIFIED');
  });
});


// ============================================================
// classifyThesis — Multiple downgrades stack correctly
// ============================================================

describe('classifyThesis — stacking downgrades', () => {
  it('applies the most restrictive downgrade when multiple fire', () => {
    // signal_quality < 3 caps WATCH, evidence_freshness < 3 caps DEVELOP
    const scores = makeScores({ signal_quality: 1, evidence_freshness: 1 });
    const r = classifyThesis(90, scores, makeGateResult(), makeThesis(), makeLayerScores());
    expect(r.classification).toBe('WATCH');
    expect(r.downgrades.length).toBeGreaterThan(0);
  });

  it('combines factor downgrades with gate failures', () => {
    const failedGates = makeGateResult({
      passed: false,
      hardFails: [{ id: 'test', name: 'Test', severity: 'hard' }],
    });
    const scores = makeScores({ signal_quality: 1 });
    const r = classifyThesis(90, scores, failedGates, makeThesis(), makeLayerScores());
    expect(r.classification).toBe('WATCH');
  });
});


// ============================================================
// runChecklist
// ============================================================

describe('runChecklist', () => {
  it('blocks on empty answers', () => {
    const result = runChecklist({});
    expect(result.passed).toBe(false);
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.score).toBe(0);
  });

  it('passes with complete correct answers', () => {
    const answers = {
      opposite_case: true,
      invalidation_defined: 'If CPI rises above 4% for two consecutive quarters',
      timing_bounded: true,
      real_mispricing: 'measurable',
      clean_vehicle: true,
      risk_capped: true,
      independent_signals: 5,
      data_fresh: true,
      process_not_excitement: 'process',
      would_take_if_not_mine: true,
      early_vs_right: 'If employment data reverses for 3 months without rate action, I am wrong not early',
      emotional_state: 'calm',
    };
    const result = runChecklist(answers);
    expect(result.passed).toBe(true);
    expect(result.blocks.length).toBe(0);
    expect(result.score).toBe(100);
  });

  it('blocks on excitement-driven action', () => {
    const answers = {
      opposite_case: true,
      invalidation_defined: 'CPI above 4%',
      timing_bounded: true,
      real_mispricing: 'measurable',
      clean_vehicle: true,
      risk_capped: true,
      independent_signals: 5,
      data_fresh: true,
      process_not_excitement: 'excitement',
      would_take_if_not_mine: true,
      early_vs_right: 'Some long explanation about timing differences',
      emotional_state: 'calm',
    };
    const result = runChecklist(answers);
    expect(result.passed).toBe(false);
    expect(result.blocks.some(b => b.id === 'process_not_excitement')).toBe(true);
  });

  it('warns on few independent signals', () => {
    const answers = {
      opposite_case: true,
      invalidation_defined: 'CPI above 4% for two quarters straight',
      timing_bounded: true,
      real_mispricing: 'measurable',
      clean_vehicle: true,
      risk_capped: true,
      independent_signals: 2,
      data_fresh: true,
      process_not_excitement: 'process',
      would_take_if_not_mine: true,
      early_vs_right: 'If employment reverses for 3 months without action, I am wrong',
      emotional_state: 'calm',
    };
    const result = runChecklist(answers);
    expect(result.warnings.some(w => w.id === 'independent_signals')).toBe(true);
    // Warning doesn't block
    expect(result.passed).toBe(true);
  });

  it('blocks on dangerous emotional state', () => {
    const result = runChecklist({ emotional_state: 'fomo' });
    expect(result.blocks.some(b => b.id === 'emotional_state')).toBe(true);
  });

  it('blocks on narrative-only mispricing', () => {
    const result = runChecklist({ real_mispricing: 'narrative_only' });
    expect(result.blocks.some(b => b.id === 'real_mispricing')).toBe(true);
  });
});


// ============================================================
// getMaxPositionSize
// ============================================================

describe('getMaxPositionSize', () => {
  it('returns 5% for FULLY_QUALIFIED', () => {
    const result = getMaxPositionSize('FULLY_QUALIFIED', 100000);
    expect(result.maxPercent).toBe(5);
    expect(result.maxDollars).toBe(5000);
  });

  it('returns 2% for SMALL_POSITION', () => {
    const result = getMaxPositionSize('SMALL_POSITION', 100000);
    expect(result.maxPercent).toBe(2);
    expect(result.maxDollars).toBe(2000);
  });

  it('returns 0% for PAPER_TRADE and below', () => {
    for (const c of ['PAPER_TRADE', 'DEVELOP', 'WATCH', 'IGNORE', 'QUARANTINED']) {
      const result = getMaxPositionSize(c, 100000);
      expect(result.maxPercent).toBe(0);
      expect(result.maxDollars).toBe(0);
    }
  });

  it('handles unknown classification', () => {
    const result = getMaxPositionSize('NONEXISTENT', 100000);
    expect(result.maxDollars).toBe(0);
  });
});
