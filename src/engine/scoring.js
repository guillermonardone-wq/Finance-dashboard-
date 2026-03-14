// ============================================================
// SCORING ENGINE — Weighted multi-factor thesis evaluator
// ============================================================
// This is NOT a dashboard metric. This is a behavioral discipline tool.
// Every score must be auditable. Every output must explain WHY.
//
// 12 scoring dimensions with fixed MVP weights (total = 100).
// Weights are configurable post-MVP but fixed now to prevent gaming.
// ============================================================

export const SCORE_WEIGHTS = {
  signal_quality:                14,
  signal_independence:           9,
  causal_chain_clarity:          11,
  market_mispricing_likelihood:  14,
  catalyst_visibility:           8,
  timing_precision:              8,
  expression_quality:            9,
  risk_containment:              9,
  disconfirmation_robustness:    6,
  emotional_neutrality:          4,
  data_freshness:                4,
  market_confirmation_divergence: 4,
};
// Sum = 100

export const SCORE_DIMENSIONS = Object.keys(SCORE_WEIGHTS);

// Each dimension is scored 0-10 by the user or computed from inputs.
// The weighted composite is: sum(score_i * weight_i) / 100, normalized to 0-100 scale.

/**
 * Compute weighted composite score from individual dimension scores.
 * @param {Object} scores - { signal_quality: 7, signal_independence: 5, ... } (each 0-10)
 * @returns {{ composite: number, breakdown: Object[], missing: string[] }}
 */
export function computeCompositeScore(scores) {
  const breakdown = [];
  const missing = [];
  let totalWeightedScore = 0;

  for (const dim of SCORE_DIMENSIONS) {
    const rawScore = scores[dim];
    const weight = SCORE_WEIGHTS[dim];

    if (rawScore == null) {
      missing.push(dim);
      breakdown.push({
        dimension: dim,
        rawScore: null,
        weight,
        weightedContribution: 0,
        status: 'missing',
      });
      continue;
    }

    const clamped = Math.max(0, Math.min(10, rawScore));
    const contribution = (clamped / 10) * weight;
    totalWeightedScore += contribution;

    breakdown.push({
      dimension: dim,
      rawScore: clamped,
      weight,
      weightedContribution: Math.round(contribution * 100) / 100,
      status: clamped >= 7 ? 'strong' : clamped >= 4 ? 'moderate' : 'weak',
    });
  }

  // Penalize for missing scores — don't reward incomplete assessments
  const missingPenalty = missing.length > 0
    ? missing.reduce((sum, dim) => sum + SCORE_WEIGHTS[dim], 0) * 0.3
    : 0;

  const composite = Math.max(0, Math.round((totalWeightedScore - missingPenalty) * 100) / 100);

  return {
    composite,
    breakdown,
    missing,
    missingPenalty: Math.round(missingPenalty * 100) / 100,
    completeness: Math.round(((SCORE_DIMENSIONS.length - missing.length) / SCORE_DIMENSIONS.length) * 100),
  };
}

/**
 * Compute individual dimension scores from thesis data (auto-scoring where possible).
 * Many dimensions require manual input, but some can be partially derived.
 */
export function autoScoreThesis(thesis, signals = [], marketObs = []) {
  const auto = {};
  const explanations = {};

  // --- Signal Quality ---
  // Based on linked signals' reliability and strength
  if (signals.length > 0) {
    const reliabilityScores = { verified: 9, likely: 7, unverified: 4, disputed: 2, false: 0 };
    const avgReliability = signals.reduce((sum, s) => sum + (reliabilityScores[s.reliability] || 3), 0) / signals.length;
    const withStrength = signals.filter(s => s.signal_strength != null);
    if (withStrength.length > 0) {
      const avgStrength = withStrength.reduce((sum, s) => sum + s.signal_strength * 10, 0) / withStrength.length;
      auto.signal_quality = Math.round(((avgReliability + avgStrength) / 2) * 10) / 10;
      explanations.signal_quality = `${signals.length} signals, avg reliability ${avgReliability.toFixed(1)}/10, avg strength ${avgStrength.toFixed(1)}/10`;
    } else {
      auto.signal_quality = Math.round(avgReliability * 10) / 10;
      explanations.signal_quality = `${signals.length} signals, avg reliability ${avgReliability.toFixed(1)}/10 (no strength data)`;
    }
  }

  // --- Signal Independence ---
  // How many distinct source types are represented?
  if (signals.length > 0) {
    const sourceTypes = new Set(signals.map(s => s.source_type));
    const categories = new Set(signals.map(s => s.category));
    const independence = Math.min(10, (sourceTypes.size * 2) + (categories.size * 1.5));
    auto.signal_independence = Math.round(independence * 10) / 10;
    explanations.signal_independence = `${sourceTypes.size} source types, ${categories.size} categories`;
  }

  // --- Causal Chain Clarity ---
  if (thesis.causal_chain) {
    const chain = Array.isArray(thesis.causal_chain) ? thesis.causal_chain : [];
    const hasSteps = chain.length >= 2;
    const hasAlternatives = (thesis.alternative_explanations || []).length > 0;
    let score = 3; // base
    if (hasSteps) score += Math.min(3, chain.length);
    if (hasAlternatives) score += 2;
    if (thesis.key_assumptions && thesis.key_assumptions.length <= 3) score += 2;
    auto.causal_chain_clarity = Math.min(10, score);
    explanations.causal_chain_clarity = `${chain.length} steps, ${(thesis.alternative_explanations || []).length} alternatives, ${(thesis.key_assumptions || []).length} assumptions`;
  }

  // --- Disconfirmation Robustness ---
  const disconfirm = thesis.disconfirming_evidence || [];
  const hasBearCase = thesis.strongest_bear_case && thesis.strongest_bear_case.length > 20;
  const hasOpposite = thesis.what_would_make_opposite_stronger && thesis.what_would_make_opposite_stronger.length > 20;
  let disScore = 0;
  if (disconfirm.length > 0) disScore += Math.min(4, disconfirm.length * 1.5);
  if (hasBearCase) disScore += 3;
  if (hasOpposite) disScore += 3;
  auto.disconfirmation_robustness = Math.min(10, Math.round(disScore * 10) / 10);
  explanations.disconfirmation_robustness = `${disconfirm.length} counter-evidence items, bear case: ${hasBearCase ? 'yes' : 'NO'}, opposite case: ${hasOpposite ? 'yes' : 'NO'}`;

  // --- Data Freshness ---
  if (marketObs.length > 0) {
    const now = Date.now();
    const avgAge = marketObs.reduce((sum, obs) => {
      const age = (now - new Date(obs.fetched_at || obs.created_at).getTime()) / (1000 * 60 * 60);
      return sum + age;
    }, 0) / marketObs.length;

    // Fresh = <1h = 10, <6h = 7, <24h = 5, <48h = 3, older = 1
    let freshness = 1;
    if (avgAge < 1) freshness = 10;
    else if (avgAge < 6) freshness = 7;
    else if (avgAge < 24) freshness = 5;
    else if (avgAge < 48) freshness = 3;
    auto.data_freshness = freshness;
    explanations.data_freshness = `Avg data age: ${avgAge.toFixed(1)} hours across ${marketObs.length} observations`;
  }

  // --- Timing Precision ---
  if (thesis.expected_timeline) {
    const tl = thesis.expected_timeline;
    let score = 2;
    if (tl.start && tl.end) {
      const spanDays = (new Date(tl.end) - new Date(tl.start)) / (1000 * 86400);
      if (spanDays <= 7) score = 9;
      else if (spanDays <= 30) score = 7;
      else if (spanDays <= 90) score = 5;
      else if (spanDays <= 180) score = 3;
      else score = 2;
    }
    if (tl.basis && tl.basis.length > 10) score = Math.min(10, score + 1);
    auto.timing_precision = score;
    explanations.timing_precision = tl.start && tl.end
      ? `Window: ${tl.start} to ${tl.end}`
      : 'Timeline not fully specified';
  }

  return { scores: auto, explanations };
}

/**
 * Generate a human-readable explanation of the composite score.
 */
export function explainScore(scoreResult) {
  const { composite, breakdown, missing, missingPenalty } = scoreResult;
  const lines = [];

  lines.push(`COMPOSITE SCORE: ${composite}/100`);
  if (missing.length > 0) {
    lines.push(`WARNING: ${missing.length} dimensions not scored. Penalty: -${missingPenalty}`);
    lines.push(`Missing: ${missing.join(', ')}`);
  }

  lines.push('');
  lines.push('DIMENSION BREAKDOWN:');
  const sorted = [...breakdown]
    .filter(b => b.rawScore != null)
    .sort((a, b) => b.weightedContribution - a.weightedContribution);

  for (const b of sorted) {
    const bar = '█'.repeat(Math.round(b.rawScore)) + '░'.repeat(10 - Math.round(b.rawScore));
    lines.push(`  ${b.dimension.padEnd(35)} ${bar} ${b.rawScore}/10 (w:${b.weight}, contrib:${b.weightedContribution})`);
  }

  // Weakest links
  const weak = breakdown.filter(b => b.status === 'weak' && b.rawScore != null);
  if (weak.length > 0) {
    lines.push('');
    lines.push('WEAKEST DIMENSIONS (will limit classification):');
    for (const w of weak) {
      lines.push(`  ⚠ ${w.dimension}: ${w.rawScore}/10`);
    }
  }

  return lines.join('\n');
}
