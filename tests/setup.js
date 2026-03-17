// ============================================================
// SHARED TEST UTILITIES
// ============================================================
// Reusable factories and helpers for Signal Forge test suites.
// Import these in any test file to avoid duplicating test data.
// ============================================================

/**
 * Create a thesis object with all required fields filled in.
 * Pass overrides to customize specific fields.
 */
export function makeThesis(overrides = {}) {
  return {
    id: "test-thesis",
    title: "Test thesis about macro events",
    thesis_statement: "The Fed will cut rates due to employment weakness",
    causal_chain: ["Employment slows", "CPI drops", "Fed pivots"],
    affected_assets: [{ asset: "SPY", direction: "long" }],
    expected_timeline: {
      start: "2025-01-01",
      end: "2025-06-01",
      basis: "Historical Fed cycles",
    },
    probability_low: 0.3,
    probability_high: 0.7,
    probability_best: 0.5,
    key_assumptions: [
      "Employment continues to weaken",
      "No inflation resurgence",
    ],
    alternative_explanations: ["Fiscal stimulus offsets monetary tightening"],
    invalidating_indicators: [
      { indicator: "CPI > 4%", description: "Inflation re-accelerates" },
    ],
    disconfirming_evidence: ["Strong payroll data could invalidate"],
    strongest_bear_case:
      "Inflation may prove stickier than expected, preventing any rate action for years.",
    what_would_make_opposite_stronger:
      "If core services inflation reaccelerates above 5% while employment stays strong, the thesis is dead.",
    leading_indicators: [
      { indicator: "Initial claims", target_state: "Rising above 250k" },
    ],
    status: "active",
    classification: "DEVELOP",
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

/**
 * Create a full set of 15 factor scores with sensible defaults.
 * Pass overrides to customize specific factors.
 */
export function makeScores(overrides = {}) {
  return {
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
    ...overrides,
  };
}

/**
 * Create an array of signal objects with diverse source types.
 */
export function makeSignals(count = 5, overrides = {}) {
  const types = ["manual", "fred", "newsapi", "finnhub", "gdelt"];
  const categories = [
    "central_bank_action",
    "labor_market",
    "inflation",
    "geopolitical",
    "fiscal_policy",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `sig-${i}`,
    title: `Signal ${i}: ${categories[i % categories.length]}`,
    source_type: types[i % types.length],
    category: categories[i % categories.length],
    reliability: i % 3 === 0 ? "verified" : "likely",
    signal_strength: 0.6 + i * 0.05,
    novelty: "developing",
    status: "linked",
    thesis_id: "test-thesis",
    created_at: new Date(Date.now() - i * 12 * 3600 * 1000).toISOString(),
    ...overrides,
  }));
}

/**
 * Create a gate result object (all-passing by default).
 */
export function makeGateResult(overrides = {}) {
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

/**
 * Create layer scores object with sensible defaults.
 */
export function makeLayerScores(overrides = {}) {
  return {
    evidence: { score: 7, ...overrides.evidence },
    structure: { score: 7, ...overrides.structure },
    market_edge: { score: 6, ...overrides.market_edge },
  };
}
