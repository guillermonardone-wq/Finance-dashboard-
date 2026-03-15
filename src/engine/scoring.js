// ============================================================
// SCORING ENGINE — Three-layer thesis evaluator
// ============================================================
// Layer 1: Evidence Score (40%)    — quality, independence, freshness, reliability, quantity
// Layer 2: Structural Logic (35%) — causal clarity, consistency, counter-case, assumptions, timing
// Layer 3: Market Edge (25%)      — awareness, prediction market divergence, reaction gaps, liquidity, catalyst
//
// Each factor is scored 0-10. Layer scores are weighted averages of their factors.
// Composite = Evidence×0.40 + Structure×0.35 + MarketEdge×0.25
// Penalties are subtracted AFTER layer aggregation.
// Confidence is tracked separately from score.
// ============================================================

// --- LAYER DEFINITIONS ---

export const EVIDENCE_FACTORS = {
  signal_quality:       { weight: 25, label: 'Signal Quality' },
  signal_independence:  { weight: 25, label: 'Signal Independence' },
  evidence_freshness:   { weight: 20, label: 'Evidence Freshness' },
  data_reliability:     { weight: 15, label: 'Data Reliability' },
  evidence_quantity:    { weight: 15, label: 'Evidence Quantity' },
};

export const STRUCTURE_FACTORS = {
  causal_chain_clarity:    { weight: 25, label: 'Causal Chain Clarity' },
  internal_consistency:    { weight: 20, label: 'Internal Consistency' },
  counter_case_robustness: { weight: 25, label: 'Counter-Case Robustness' },
  assumption_load:         { weight: 15, label: 'Assumption Load' },
  timing_clarity:          { weight: 15, label: 'Timing Clarity' },
};

export const MARKET_EDGE_FACTORS = {
  market_awareness:               { weight: 20, label: 'Market Awareness' },
  prediction_market_divergence:   { weight: 20, label: 'Prediction Mkt Divergence' },
  asset_reaction_gaps:            { weight: 25, label: 'Asset Reaction Gaps' },
  liquidity_sensitivity:          { weight: 15, label: 'Liquidity Sensitivity' },
  catalyst_clarity:               { weight: 20, label: 'Catalyst Clarity' },
};

export const LAYER_WEIGHTS = {
  evidence:    0.40,
  structure:   0.35,
  market_edge: 0.25,
};

export const LAYERS = {
  evidence:    { label: 'Evidence',         factors: EVIDENCE_FACTORS,  weight: LAYER_WEIGHTS.evidence },
  structure:   { label: 'Structural Logic', factors: STRUCTURE_FACTORS, weight: LAYER_WEIGHTS.structure },
  market_edge: { label: 'Market Edge',      factors: MARKET_EDGE_FACTORS, weight: LAYER_WEIGHTS.market_edge },
};

// All factor keys (flat)
export const ALL_FACTORS = {
  ...EVIDENCE_FACTORS,
  ...STRUCTURE_FACTORS,
  ...MARKET_EDGE_FACTORS,
};

export const ALL_FACTOR_KEYS = Object.keys(ALL_FACTORS);

// --- PENALTY DEFINITIONS ---

export const PENALTY_DEFINITIONS = [
  {
    id: 'single_source',
    label: 'Single Source Signals',
    maxPenalty: 8,
    detect: (scores, signals) => {
      const sourceTypes = new Set((signals || []).map(s => s.source_type));
      return sourceTypes.size <= 1 && (signals || []).length > 0;
    },
    compute: (scores, signals) => {
      const sourceTypes = new Set((signals || []).map(s => s.source_type));
      return sourceTypes.size <= 1 ? 8 : 0;
    },
    reason: 'All signals come from a single source type. No independent corroboration.',
  },
  {
    id: 'circular_signals',
    label: 'Circular Signals',
    maxPenalty: 10,
    detect: (scores, signals) => {
      if (!signals || signals.length < 2) return false;
      const titles = signals.map(s => s.title?.toLowerCase().trim());
      const unique = new Set(titles);
      return unique.size < titles.length * 0.7;
    },
    compute: (scores, signals) => {
      if (!signals || signals.length < 2) return 0;
      const titles = signals.map(s => s.title?.toLowerCase().trim());
      const unique = new Set(titles);
      const dupeRatio = 1 - (unique.size / titles.length);
      return Math.round(dupeRatio * 10);
    },
    reason: 'Signals appear to be circular — similar titles/sources citing each other.',
  },
  {
    id: 'stale_data',
    label: 'Stale Data',
    maxPenalty: 6,
    detect: (scores) => scores.evidence_freshness != null && scores.evidence_freshness < 4,
    compute: (scores) => {
      if (scores.evidence_freshness == null) return 0;
      if (scores.evidence_freshness >= 4) return 0;
      return Math.round((4 - scores.evidence_freshness) * 2);
    },
    reason: 'Supporting data is stale. Market may have moved past your evidence.',
  },
  {
    id: 'narrative_bias',
    label: 'Narrative Bias',
    maxPenalty: 7,
    detect: (scores) => {
      const counterCase = scores.counter_case_robustness ?? 10;
      const consistency = scores.internal_consistency ?? 10;
      return counterCase < 4 && consistency >= 7;
    },
    compute: (scores) => {
      const counterCase = scores.counter_case_robustness ?? 10;
      if (counterCase >= 4) return 0;
      return Math.round((4 - counterCase) * 2.3);
    },
    reason: 'Strong internal narrative but weak counter-case suggests narrative bias.',
  },
  {
    id: 'already_priced',
    label: 'Market Already Priced',
    maxPenalty: 8,
    detect: (scores) => scores.market_awareness != null && scores.market_awareness >= 8 && (scores.asset_reaction_gaps ?? 5) < 3,
    compute: (scores) => {
      if ((scores.market_awareness ?? 0) < 8) return 0;
      const gaps = scores.asset_reaction_gaps ?? 5;
      if (gaps >= 3) return 0;
      return Math.round((3 - gaps) * 2.7);
    },
    reason: 'Market is highly aware and assets already reflect the thesis. Edge may be gone.',
  },
  {
    id: 'missing_invalidation',
    label: 'Missing Invalidation',
    maxPenalty: 10,
    detect: (scores, signals, thesis) => {
      const inv = thesis?.invalidating_indicators || [];
      return inv.length === 0;
    },
    compute: (scores, signals, thesis) => {
      const inv = thesis?.invalidating_indicators || [];
      return inv.length === 0 ? 10 : 0;
    },
    reason: 'No invalidation criteria defined. You cannot exit a thesis you cannot prove wrong.',
  },
];

// --- TIME DECAY ---

/**
 * Apply exponential time-decay to evidence freshness.
 * Half-life is 24 hours. Evidence older than 72h gets heavy discount.
 */
export function computeTimeDecay(ageHours) {
  const halfLife = 24;
  const decay = Math.pow(0.5, ageHours / halfLife);
  return Math.max(0, Math.min(1, decay));
}

/**
 * Score evidence freshness using time-decay curve instead of hard thresholds.
 * Returns 0-10 score.
 */
export function scoreEvidenceFreshness(marketObs) {
  if (!marketObs || marketObs.length === 0) return null;

  const now = Date.now();
  let totalDecay = 0;

  for (const obs of marketObs) {
    const ageHours = (now - new Date(obs.fetched_at || obs.created_at).getTime()) / (1000 * 60 * 60);
    totalDecay += computeTimeDecay(ageHours);
  }

  const avgDecay = totalDecay / marketObs.length;
  return Math.round(avgDecay * 10 * 10) / 10;
}

// --- SIGNAL INDEPENDENCE DETECTION ---

/**
 * Detect signal independence using source diversity, content similarity,
 * and temporal clustering analysis.
 * Returns { score: 0-10, clusters: [], warnings: [] }
 */
export function detectSignalIndependence(signals) {
  if (!signals || signals.length === 0) return { score: 0, clusters: [], warnings: [] };
  if (signals.length === 1) return { score: 2, clusters: [], warnings: ['Single signal — no independence possible'] };

  const warnings = [];

  // Factor 1: Source type diversity (0-4 points)
  const sourceTypes = new Set(signals.map(s => s.source_type));
  const sourceDiversity = Math.min(4, sourceTypes.size * 1.3);

  // Factor 2: Category diversity (0-3 points)
  const categories = new Set(signals.map(s => s.category));
  const categoryDiversity = Math.min(3, categories.size * 0.8);

  // Factor 3: Temporal spread — signals arriving at different times are more independent (0-2 points)
  const timestamps = signals
    .map(s => new Date(s.created_at).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);

  let temporalSpread = 0;
  if (timestamps.length >= 2) {
    const spanHours = (timestamps[timestamps.length - 1] - timestamps[0]) / (1000 * 3600);
    temporalSpread = Math.min(2, spanHours / 24);
  }

  // Factor 4: Content similarity penalty (0 to -2 points)
  const titles = signals.map(s => (s.title || '').toLowerCase().trim());
  const uniqueTitles = new Set(titles);
  let similarityPenalty = 0;
  if (uniqueTitles.size < titles.length * 0.6) {
    similarityPenalty = -2;
    warnings.push('High content similarity between signals — possible echo chamber');
  } else if (uniqueTitles.size < titles.length * 0.8) {
    similarityPenalty = -1;
    warnings.push('Some content overlap between signals');
  }

  // Cluster detection: group by source_type + close timestamps
  const clusters = [];
  const clusterWindow = 4 * 3600 * 1000; // 4 hours
  const sorted = [...signals].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  let currentCluster = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].created_at).getTime();
    const curr = new Date(sorted[i].created_at).getTime();
    if (sorted[i].source_type === sorted[i - 1].source_type && curr - prev < clusterWindow) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length >= 2) {
        clusters.push({
          source_type: currentCluster[0].source_type,
          count: currentCluster.length,
          ids: currentCluster.map(s => s.id),
        });
        warnings.push(`${currentCluster.length} signals clustered from ${currentCluster[0].source_type} within 4h window`);
      }
      currentCluster = [sorted[i]];
    }
  }
  if (currentCluster.length >= 2) {
    clusters.push({
      source_type: currentCluster[0].source_type,
      count: currentCluster.length,
      ids: currentCluster.map(s => s.id),
    });
  }

  const clusterPenalty = Math.min(0, -(clusters.length * 0.5));

  const rawScore = sourceDiversity + categoryDiversity + temporalSpread + similarityPenalty + clusterPenalty;
  const score = Math.max(0, Math.min(10, Math.round(rawScore * 10) / 10));

  return { score, clusters, warnings };
}

// --- MARKET REACTION COMPARISON ---

/**
 * Compare thesis expectations against actual asset reactions.
 * Uses market observations to detect whether assets are reacting as the thesis predicts.
 * Returns { score: 0-10, gaps: [], explanation: string }
 */
export function compareMarketReaction(thesis, marketObs) {
  if (!thesis.affected_assets || thesis.affected_assets.length === 0) {
    return { score: 5, gaps: [], explanation: 'No affected assets defined — cannot compare reactions' };
  }
  if (!marketObs || marketObs.length === 0) {
    return { score: 5, gaps: [], explanation: 'No market observations available for comparison' };
  }

  const gaps = [];
  const affectedAssets = Array.isArray(thesis.affected_assets) ? thesis.affected_assets : [];

  for (const asset of affectedAssets) {
    const symbol = asset.asset || asset.symbol;
    if (!symbol) continue;

    const obs = marketObs.filter(o => o.symbol && o.symbol.toLowerCase() === symbol.toLowerCase());
    if (obs.length === 0) {
      gaps.push({ asset: symbol, expected: asset.direction, actual: 'no_data', aligned: false });
      continue;
    }

    // Check price observations for direction alignment
    const priceObs = obs.filter(o => o.observation_type === 'price' || o.observation_type === 'candle');
    if (priceObs.length >= 2) {
      const sorted = priceObs.sort((a, b) => new Date(a.fetched_at) - new Date(b.fetched_at));
      const firstData = typeof sorted[0].data === 'string' ? JSON.parse(sorted[0].data) : sorted[0].data;
      const lastData = typeof sorted[sorted.length - 1].data === 'string' ? JSON.parse(sorted[sorted.length - 1].data) : sorted[sorted.length - 1].data;

      const firstPrice = firstData.close || firstData.price || firstData.value;
      const lastPrice = lastData.close || lastData.price || lastData.value;

      if (firstPrice && lastPrice) {
        const pctChange = (lastPrice - firstPrice) / firstPrice;
        const expectedLong = asset.direction === 'long' || asset.direction === 'up';
        const actuallyUp = pctChange > 0.005;
        const actuallyDown = pctChange < -0.005;
        const aligned = (expectedLong && actuallyUp) || (!expectedLong && actuallyDown);

        gaps.push({
          asset: symbol,
          expected: asset.direction,
          actual: actuallyUp ? 'up' : actuallyDown ? 'down' : 'flat',
          pctChange: Math.round(pctChange * 10000) / 100,
          aligned,
        });
      }
    }
  }

  if (gaps.length === 0) {
    return { score: 5, gaps: [], explanation: 'Insufficient data for reaction comparison' };
  }

  const alignedCount = gaps.filter(g => g.aligned).length;
  const misalignedCount = gaps.filter(g => g.aligned === false && g.actual !== 'no_data').length;
  const score = Math.max(0, Math.min(10, Math.round((alignedCount / gaps.length) * 10)));

  const explanation = `${alignedCount}/${gaps.length} assets reacting as expected. ${misalignedCount} misaligned.`;

  return { score, gaps, explanation };
}

// --- PLAYBOOK PATTERN MATCHING ---

/**
 * Match a thesis against playbook entries using category, signals, and keyword overlap.
 * Returns { matches: [{ entry, score, reasons }], bestMatch: entry|null }
 */
export function matchPlaybookPatterns(thesis, signals, playbookEntries) {
  if (!playbookEntries || playbookEntries.length === 0) {
    return { matches: [], bestMatch: null };
  }

  const signalCategories = new Set((signals || []).map(s => s.category));
  const thesisWords = new Set(
    `${thesis.title} ${thesis.thesis_statement}`.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );

  const matches = [];

  for (const entry of playbookEntries) {
    let matchScore = 0;
    const reasons = [];

    // Category match
    if (signalCategories.has(entry.category)) {
      matchScore += 3;
      reasons.push(`Category match: ${entry.category}`);
    }

    // Trigger condition match
    const triggers = Array.isArray(entry.trigger_conditions) ? entry.trigger_conditions : [];
    for (const trigger of triggers) {
      const triggerWords = (typeof trigger === 'string' ? trigger : trigger.condition || '')
        .toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const overlap = triggerWords.filter(w => thesisWords.has(w));
      if (overlap.length >= 2) {
        matchScore += 2;
        reasons.push(`Trigger keyword overlap: ${overlap.join(', ')}`);
      }
    }

    // Asset overlap
    const typicalAssets = Array.isArray(entry.typical_assets) ? entry.typical_assets : [];
    const thesisAssets = (Array.isArray(thesis.affected_assets) ? thesis.affected_assets : [])
      .map(a => (a.asset || a.symbol || '').toLowerCase());
    for (const ta of typicalAssets) {
      const taStr = (typeof ta === 'string' ? ta : ta.symbol || '').toLowerCase();
      if (thesisAssets.some(a => a.includes(taStr) || taStr.includes(a))) {
        matchScore += 2;
        reasons.push(`Asset overlap: ${taStr}`);
      }
    }

    // Keyword overlap in pattern description
    const patternWords = (entry.pattern_description || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const kwOverlap = patternWords.filter(w => thesisWords.has(w));
    if (kwOverlap.length >= 3) {
      matchScore += 1;
      reasons.push(`Pattern description overlap (${kwOverlap.length} words)`);
    }

    if (matchScore >= 3) {
      matches.push({ entry, score: Math.min(10, matchScore), reasons });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  return {
    matches: matches.slice(0, 5),
    bestMatch: matches.length > 0 ? matches[0].entry : null,
  };
}

// --- PREDICTION MARKET DIVERGENCE SCORING ---

/**
 * Score prediction market divergence with safety caps.
 * Uses sqrt curve. Capped at 8/10 — prediction markets are informative but not authoritative.
 * Returns { score: number|null, confidence: number, explanation: string }
 */
export function scorePredictionMarketDivergence(predictionMarketAssessment) {
  if (!predictionMarketAssessment || !predictionMarketAssessment.scoring_helpers) {
    return { score: null, confidence: 0, explanation: 'No prediction market data available' };
  }

  const helpers = predictionMarketAssessment.scoring_helpers;
  const qualifyingCount = helpers.qualifying_contract_count ?? 0;

  if (qualifyingCount < 2) {
    return { score: null, confidence: 0, explanation: `Only ${qualifyingCount} qualifying contracts (need ≥2)` };
  }

  if (helpers.prediction_market_divergence == null) {
    return { score: null, confidence: 0, explanation: 'No divergence data' };
  }

  if ((helpers.prediction_market_confidence ?? 0) <= 0.4) {
    return { score: null, confidence: helpers.prediction_market_confidence, explanation: 'PM confidence too low (<40%)' };
  }

  // Sqrt curve with hard cap at 8
  const rawScore = Math.min(8, Math.sqrt(helpers.prediction_market_divergence * 10) * 3);
  const score = Math.round(rawScore * 10) / 10;
  const confidence = helpers.prediction_market_confidence;
  const explanation = `PM divergence: ${score}/10 (capped at 8), confidence: ${(confidence * 100).toFixed(0)}%, ${qualifyingCount} contracts. ${helpers.prediction_market_commentary || ''}`;

  return { score, confidence, explanation };
}

// --- LAYER SCORE COMPUTATION ---

/**
 * Compute a single layer's score from its factor scores.
 * Returns { score: 0-10, breakdown: [], missing: [], completeness: number }
 */
function computeLayerScore(factorDefs, scores) {
  const breakdown = [];
  const missing = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, def] of Object.entries(factorDefs)) {
    const rawScore = scores[key];
    if (rawScore == null) {
      missing.push(key);
      breakdown.push({ factor: key, label: def.label, rawScore: null, weight: def.weight, contribution: 0, status: 'missing' });
      continue;
    }

    const clamped = Math.max(0, Math.min(10, rawScore));
    const contribution = clamped * def.weight;
    weightedSum += contribution;
    totalWeight += def.weight;

    breakdown.push({
      factor: key,
      label: def.label,
      rawScore: clamped,
      weight: def.weight,
      contribution: Math.round(contribution) / 100,
      status: clamped >= 7 ? 'strong' : clamped >= 4 ? 'moderate' : 'weak',
    });
  }

  // Missing penalty: 30% of missing weight applied to denominator
  const missingWeight = Object.entries(factorDefs)
    .filter(([k]) => missing.includes(k))
    .reduce((sum, [, def]) => sum + def.weight, 0);
  const missingPenalty = missingWeight * 0.3;

  const effectiveDenominator = 100; // weights always sum to 100
  const score = totalWeight > 0
    ? Math.max(0, Math.round(((weightedSum / effectiveDenominator) * 10 - missingPenalty / 10) * 100) / 100)
    : 0;

  const totalFactors = Object.keys(factorDefs).length;
  const completeness = Math.round(((totalFactors - missing.length) / totalFactors) * 100);

  return { score: Math.max(0, Math.min(10, score)), breakdown, missing, missingPenalty, completeness };
}

// --- COMPOSITE SCORE ---

/**
 * Compute the three-layer composite score.
 * @param {Object} scores - all factor scores { signal_quality: 7, ... }
 * @param {Object} penalties - penalty results from computePenalties()
 * @returns {{ composite: number, layers: Object, penalties: Object, completeness: number }}
 */
export function computeCompositeScore(scores, penalties = null) {
  const evidenceLayer = computeLayerScore(EVIDENCE_FACTORS, scores);
  const structureLayer = computeLayerScore(STRUCTURE_FACTORS, scores);
  const marketEdgeLayer = computeLayerScore(MARKET_EDGE_FACTORS, scores);

  // Weighted composite: each layer score is 0-10, scale to 0-100
  const rawComposite = (
    evidenceLayer.score * LAYER_WEIGHTS.evidence +
    structureLayer.score * LAYER_WEIGHTS.structure +
    marketEdgeLayer.score * LAYER_WEIGHTS.market_edge
  ) * 10;

  // Apply penalties
  let totalPenalty = 0;
  const appliedPenalties = [];
  if (penalties && penalties.items) {
    for (const p of penalties.items) {
      if (p.active && p.value > 0) {
        totalPenalty += p.value;
        appliedPenalties.push(p);
      }
    }
  }

  const composite = Math.max(0, Math.round((rawComposite - totalPenalty) * 100) / 100);

  // Overall completeness
  const allMissing = [...evidenceLayer.missing, ...structureLayer.missing, ...marketEdgeLayer.missing];
  const completeness = Math.round(((ALL_FACTOR_KEYS.length - allMissing.length) / ALL_FACTOR_KEYS.length) * 100);

  return {
    composite,
    rawComposite: Math.round(rawComposite * 100) / 100,
    layers: {
      evidence:    { ...evidenceLayer, weight: LAYER_WEIGHTS.evidence },
      structure:   { ...structureLayer, weight: LAYER_WEIGHTS.structure },
      market_edge: { ...marketEdgeLayer, weight: LAYER_WEIGHTS.market_edge },
    },
    penalties: {
      total: Math.round(totalPenalty * 100) / 100,
      applied: appliedPenalties,
    },
    missing: allMissing,
    completeness,
  };
}

// --- PENALTY COMPUTATION ---

/**
 * Compute all penalties for a thesis.
 * @returns {{ items: [{ id, label, active, value, reason }], total: number }}
 */
export function computePenalties(scores, signals, thesis) {
  const items = [];
  let total = 0;

  for (const def of PENALTY_DEFINITIONS) {
    const active = def.detect(scores, signals, thesis);
    const value = active ? Math.min(def.maxPenalty, def.compute(scores, signals, thesis)) : 0;
    total += value;
    items.push({
      id: def.id,
      label: def.label,
      active,
      value,
      maxPenalty: def.maxPenalty,
      reason: active ? def.reason : null,
    });
  }

  return { items, total: Math.round(total * 100) / 100 };
}

// --- AUTO-SCORING ---

/**
 * Auto-score all factors from available thesis data.
 * Returns { scores: Object, explanations: Object, independence: Object, marketReaction: Object }
 */
export function autoScoreThesis(thesis, signals = [], marketObs = [], predictionMarketAssessment = null, playbookEntries = []) {
  const auto = {};
  const explanations = {};

  // --- EVIDENCE LAYER ---

  // Signal Quality
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

  // Signal Independence (enhanced)
  const independence = detectSignalIndependence(signals);
  if (signals.length > 0) {
    auto.signal_independence = independence.score;
    explanations.signal_independence = independence.warnings.length > 0
      ? `Score: ${independence.score}/10. Warnings: ${independence.warnings.join('; ')}`
      : `Score: ${independence.score}/10. ${new Set(signals.map(s => s.source_type)).size} source types, ${new Set(signals.map(s => s.category)).size} categories`;
  }

  // Evidence Freshness (time-decay curve)
  const freshness = scoreEvidenceFreshness(marketObs);
  if (freshness != null) {
    auto.evidence_freshness = freshness;
    const now = Date.now();
    const avgAge = marketObs.reduce((sum, obs) => {
      return sum + (now - new Date(obs.fetched_at || obs.created_at).getTime()) / (1000 * 60 * 60);
    }, 0) / marketObs.length;
    explanations.evidence_freshness = `Time-decay score: ${freshness}/10. Avg age: ${avgAge.toFixed(1)}h across ${marketObs.length} observations`;
  }

  // Data Reliability
  if (signals.length > 0) {
    const reliabilityMap = { verified: 10, likely: 7, unverified: 4, disputed: 2, false: 0 };
    const avgReliability = signals.reduce((sum, s) => sum + (reliabilityMap[s.reliability] || 4), 0) / signals.length;
    auto.data_reliability = Math.round(avgReliability * 10) / 10;
    const verifiedCount = signals.filter(s => s.reliability === 'verified' || s.reliability === 'likely').length;
    explanations.data_reliability = `${verifiedCount}/${signals.length} signals verified/likely. Avg reliability: ${avgReliability.toFixed(1)}/10`;
  }

  // Evidence Quantity
  if (signals.length > 0) {
    // Diminishing returns: 3 signals = 5/10, 5 = 7, 8+ = 9, 12+ = 10
    const qty = Math.min(10, Math.round(Math.sqrt(signals.length) * 3.2 * 10) / 10);
    auto.evidence_quantity = qty;
    explanations.evidence_quantity = `${signals.length} linked signals → quantity score ${qty}/10`;
  }

  // --- STRUCTURE LAYER ---

  // Causal Chain Clarity
  if (thesis.causal_chain) {
    const chain = Array.isArray(thesis.causal_chain) ? thesis.causal_chain : [];
    const hasAlternatives = (thesis.alternative_explanations || []).length > 0;
    let score = 3;
    if (chain.length >= 2) score += Math.min(3, chain.length);
    if (hasAlternatives) score += 2;
    if (thesis.key_assumptions && thesis.key_assumptions.length <= 3) score += 2;
    auto.causal_chain_clarity = Math.min(10, score);
    explanations.causal_chain_clarity = `${chain.length} steps, ${(thesis.alternative_explanations || []).length} alternatives, ${(thesis.key_assumptions || []).length} assumptions`;
  }

  // Internal Consistency
  {
    let score = 5; // base
    const hasChain = thesis.causal_chain && (Array.isArray(thesis.causal_chain) ? thesis.causal_chain : []).length > 0;
    const hasAssets = thesis.affected_assets && (Array.isArray(thesis.affected_assets) ? thesis.affected_assets : []).length > 0;
    const hasTimeline = thesis.expected_timeline && (thesis.expected_timeline.start || thesis.expected_timeline.end);
    const hasProbRange = thesis.probability_low != null && thesis.probability_high != null;

    if (hasChain) score += 1;
    if (hasAssets) score += 1;
    if (hasTimeline) score += 1;
    if (hasProbRange) {
      const spread = thesis.probability_high - thesis.probability_low;
      if (spread >= 0.15 && spread <= 0.6) score += 2; // reasonable uncertainty range
      else if (spread > 0) score += 1;
    }
    auto.internal_consistency = Math.min(10, score);
    explanations.internal_consistency = `Chain: ${hasChain ? 'yes' : 'no'}, assets: ${hasAssets ? 'yes' : 'no'}, timeline: ${hasTimeline ? 'yes' : 'no'}, prob range: ${hasProbRange ? 'yes' : 'no'}`;
  }

  // Counter-Case Robustness
  {
    const disconfirm = thesis.disconfirming_evidence || [];
    const hasBearCase = thesis.strongest_bear_case && thesis.strongest_bear_case.length > 20;
    const hasOpposite = thesis.what_would_make_opposite_stronger && thesis.what_would_make_opposite_stronger.length > 20;
    let score = 0;
    if (disconfirm.length > 0) score += Math.min(4, disconfirm.length * 1.5);
    if (hasBearCase) score += 3;
    if (hasOpposite) score += 3;
    auto.counter_case_robustness = Math.min(10, Math.round(score * 10) / 10);
    explanations.counter_case_robustness = `${disconfirm.length} counter-evidence items, bear case: ${hasBearCase ? 'yes' : 'NO'}, opposite case: ${hasOpposite ? 'yes' : 'NO'}`;
  }

  // Assumption Load (inverted: fewer assumptions = higher score)
  {
    const assumptions = thesis.key_assumptions || [];
    let score;
    if (assumptions.length === 0) score = 8; // no assumptions stated (might mean not assessed)
    else if (assumptions.length <= 2) score = 10;
    else if (assumptions.length <= 4) score = 7;
    else if (assumptions.length <= 6) score = 5;
    else if (assumptions.length <= 8) score = 3;
    else score = 1;
    auto.assumption_load = score;
    explanations.assumption_load = `${assumptions.length} key assumptions → score ${score}/10 (fewer = better)`;
  }

  // Timing Clarity
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
    auto.timing_clarity = score;
    explanations.timing_clarity = tl.start && tl.end
      ? `Window: ${tl.start} to ${tl.end}`
      : 'Timeline not fully specified';
  }

  // --- MARKET EDGE LAYER ---

  // Market Awareness — how well-known is this thesis in the market?
  // Higher awareness = LOWER edge, but we score the quality of the analyst's awareness assessment.
  // This is typically manual, but we can hint from signal novelty.
  if (signals.length > 0) {
    const noveltyScores = { new: 9, developing: 7, known: 4, stale: 2, unknown: 5 };
    const avgNovelty = signals.reduce((sum, s) => sum + (noveltyScores[s.novelty] || 5), 0) / signals.length;
    auto.market_awareness = Math.round(avgNovelty * 10) / 10;
    explanations.market_awareness = `Avg signal novelty score: ${avgNovelty.toFixed(1)}/10 (new=9, known=4, stale=2)`;
  }

  // Prediction Market Divergence (capped)
  const pmResult = scorePredictionMarketDivergence(predictionMarketAssessment);
  if (pmResult.score != null) {
    auto.prediction_market_divergence = pmResult.score;
    explanations.prediction_market_divergence = pmResult.explanation;
  }

  // Asset Reaction Gaps
  const reactionResult = compareMarketReaction(thesis, marketObs);
  if (reactionResult.gaps.length > 0) {
    auto.asset_reaction_gaps = reactionResult.score;
    explanations.asset_reaction_gaps = reactionResult.explanation;
  }

  // Catalyst Clarity
  if (thesis.leading_indicators) {
    const indicators = Array.isArray(thesis.leading_indicators) ? thesis.leading_indicators : [];
    let score = 3;
    if (indicators.length >= 1) score += 2;
    if (indicators.length >= 3) score += 2;
    if (indicators.some(i => i.target_state)) score += 2;
    if (thesis.expected_timeline?.basis) score += 1;
    auto.catalyst_clarity = Math.min(10, score);
    explanations.catalyst_clarity = `${indicators.length} leading indicators, timeline basis: ${thesis.expected_timeline?.basis ? 'yes' : 'no'}`;
  }

  // Liquidity Sensitivity is typically manual — skip auto-scoring

  // Playbook matching
  const playbookResult = matchPlaybookPatterns(thesis, signals, playbookEntries);

  return {
    scores: auto,
    explanations,
    independence,
    marketReaction: reactionResult,
    playbookMatch: playbookResult,
    predictionMarket: pmResult,
  };
}

// --- CONFIDENCE ESTIMATION ---

/**
 * Estimate confidence level separately from score.
 * Confidence reflects HOW SURE we are of the score, not the score itself.
 * A thesis can have a high score with low confidence (incomplete data)
 * or a low score with high confidence (well-assessed weak thesis).
 *
 * Returns { level: 0-1, factors: Object, explanation: string }
 */
export function estimateConfidence(scoreResult, signals, marketObs, predictionMarketAssessment) {
  let confidence = 0.5; // base
  const factors = {};

  // Factor 1: Completeness of scoring (0-0.25)
  const completeness = scoreResult.completeness / 100;
  const completenessFactor = completeness * 0.25;
  confidence += completenessFactor;
  factors.completeness = { value: completeness, contribution: completenessFactor };

  // Factor 2: Evidence volume (0-0.15)
  const signalCount = (signals || []).length;
  const volumeFactor = Math.min(0.15, (signalCount / 10) * 0.15);
  confidence += volumeFactor;
  factors.evidence_volume = { value: signalCount, contribution: volumeFactor };

  // Factor 3: Data recency (0-0.10)
  if (marketObs && marketObs.length > 0) {
    const now = Date.now();
    const avgAgeHours = marketObs.reduce((sum, o) =>
      sum + (now - new Date(o.fetched_at || o.created_at).getTime()) / 3600000, 0) / marketObs.length;
    const recencyFactor = Math.max(0, Math.min(0.10, (1 - avgAgeHours / 72) * 0.10));
    confidence += recencyFactor;
    factors.data_recency = { value: avgAgeHours, contribution: recencyFactor };
  }

  // Factor 4: PM corroboration (0-0.10)
  if (predictionMarketAssessment?.scoring_helpers) {
    const pmConf = predictionMarketAssessment.scoring_helpers.prediction_market_confidence ?? 0;
    const pmFactor = pmConf * 0.10;
    confidence += pmFactor;
    factors.pm_corroboration = { value: pmConf, contribution: pmFactor };
  }

  // Negative factors
  // Penalty for missing scores (-0.15 max)
  const missingRatio = scoreResult.missing.length / ALL_FACTOR_KEYS.length;
  const missingPenalty = missingRatio * 0.15;
  confidence -= missingPenalty;
  factors.missing_penalty = { value: missingRatio, contribution: -missingPenalty };

  confidence = Math.max(0, Math.min(1, Math.round(confidence * 100) / 100));

  let explanation;
  if (confidence >= 0.8) explanation = 'High confidence — comprehensive data and scoring';
  else if (confidence >= 0.6) explanation = 'Moderate confidence — reasonable evidence base';
  else if (confidence >= 0.4) explanation = 'Low confidence — significant gaps in data or scoring';
  else explanation = 'Very low confidence — insufficient data for reliable scoring';

  return { level: confidence, factors, explanation };
}

// --- SCORE EXPLANATION ---

/**
 * Generate a human-readable explanation of the three-layer composite score.
 */
export function explainScore(scoreResult) {
  const { composite, layers, penalties, missing, completeness } = scoreResult;
  const lines = [];

  lines.push(`COMPOSITE SCORE: ${composite}/100`);
  lines.push(`Completeness: ${completeness}%`);

  if (missing.length > 0) {
    lines.push(`WARNING: ${missing.length} factors not scored: ${missing.join(', ')}`);
  }

  lines.push('');

  for (const [layerKey, layer] of Object.entries(layers)) {
    const layerLabel = LAYERS[layerKey]?.label || layerKey;
    const weightPct = (layer.weight * 100).toFixed(0);
    lines.push(`${layerLabel.toUpperCase()} (${weightPct}%): ${layer.score}/10`);

    const scored = layer.breakdown.filter(b => b.rawScore != null);
    for (const b of scored) {
      const bar = '█'.repeat(Math.round(b.rawScore)) + '░'.repeat(10 - Math.round(b.rawScore));
      lines.push(`  ${b.label.padEnd(30)} ${bar} ${b.rawScore}/10 (w:${b.weight})`);
    }

    const layerMissing = layer.breakdown.filter(b => b.rawScore == null);
    if (layerMissing.length > 0) {
      lines.push(`  Missing: ${layerMissing.map(b => b.label).join(', ')}`);
    }
    lines.push('');
  }

  if (penalties.applied.length > 0) {
    lines.push('PENALTIES APPLIED:');
    for (const p of penalties.applied) {
      lines.push(`  -${p.value}: ${p.label} — ${p.reason}`);
    }
    lines.push(`  Total penalty: -${penalties.total}`);
  }

  return lines.join('\n');
}
