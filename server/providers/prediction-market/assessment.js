// ============================================================
// PREDICTION MARKET ASSESSMENT — Consensus/divergence computation
// ============================================================
// This module computes the interpreted comparison between
// a thesis and its linked prediction market contracts.
//
// CRITICAL CONSTRAINTS:
// - This is evidence, not authority
// - Cannot override gates or classification
// - Thin markets are penalized
// - Wording mismatch must be visible
// - Stale data must be flagged
// ============================================================

import {
  DIVERGENCE_ALIGNED,
  DIVERGENCE_MILDLY_DIVERGENT,
  WORDING_MATCH_FLOOR,
  MAX_SCORING_MODIFIER,
} from './types.js';
import { predictionMarketAdapter } from './adapter.js';

/**
 * Compute a single assessment for a thesis based on its linked prediction market data.
 *
 * @param {Object} thesis - The thesis object with probability_low, probability_high, probability_best
 * @param {Array} links - Array of thesis_prediction_links with joined event + latest snapshot
 * @returns {Object} Assessment result
 */
export function computeAssessment(thesis, links) {
  if (!links || links.length === 0) {
    return {
      thesis_probability_low: thesis.probability_low,
      thesis_probability_high: thesis.probability_high,
      prediction_market_implied_probability: null,
      divergence_score: null,
      consensus_state: 'not_comparable',
      wording_warning: false,
      liquidity_warning: false,
      thin_market_penalty: 0,
      notes: 'No prediction market contracts linked.',
      contracts: [],
    };
  }

  const contractResults = [];
  let weightedProbSum = 0;
  let weightSum = 0;
  let anyWordingMismatch = false;
  let anyLiquidityWarning = false;
  let maxThinPenalty = 0;

  for (const link of links) {
    const snapshot = link.latest_snapshot;
    if (!snapshot) continue;

    const isStale = predictionMarketAdapter.isStale(snapshot.observed_at);
    const isThin = predictionMarketAdapter.isThinMarket(snapshot);
    const thinPenalty = predictionMarketAdapter.computeThinMarketPenalty(snapshot);
    const wordingMismatch = link.wording_mismatch_flag === 1 || link.wording_match_score < WORDING_MATCH_FLOOR;

    if (wordingMismatch) anyWordingMismatch = true;
    if (isThin) anyLiquidityWarning = true;
    maxThinPenalty = Math.max(maxThinPenalty, thinPenalty);

    // Weight by: link_confidence * wording_match_score * (1 - thinPenalty) * freshness
    const freshnessFactor = isStale ? 0.3 : 1.0;
    const weight = link.link_confidence * link.wording_match_score * (1 - thinPenalty) * freshnessFactor;

    if (weight > 0.01 && !wordingMismatch) {
      weightedProbSum += snapshot.implied_probability * weight;
      weightSum += weight;
    }

    contractResults.push({
      event_id: link.prediction_market_event_id,
      event_title: link.event_title || '',
      link_type: link.link_type,
      link_confidence: link.link_confidence,
      wording_match_score: link.wording_match_score,
      wording_mismatch: wordingMismatch,
      implied_probability: snapshot.implied_probability,
      volume_24h: snapshot.volume_24h,
      liquidity: snapshot.liquidity,
      is_stale: isStale,
      is_thin: isThin,
      thin_penalty: thinPenalty,
      observed_at: snapshot.observed_at,
      weight,
    });
  }

  // Compute weighted market probability
  const marketProb = weightSum > 0 ? weightedProbSum / weightSum : null;

  // Compute divergence
  let divergenceScore = null;
  let consensusState = 'not_comparable';

  if (marketProb != null) {
    const thesisMid = (thesis.probability_low + thesis.probability_high) / 2;
    divergenceScore = Math.abs(thesisMid - marketProb);

    // Adjust divergence by thin market penalty
    const adjustedDivergence = divergenceScore * (1 - maxThinPenalty * 0.5);

    if (anyWordingMismatch && contractResults.every(c => c.wording_mismatch)) {
      consensusState = 'not_comparable';
    } else if (adjustedDivergence < DIVERGENCE_ALIGNED) {
      consensusState = 'aligned';
    } else if (adjustedDivergence < DIVERGENCE_MILDLY_DIVERGENT) {
      consensusState = 'mildly_divergent';
    } else {
      consensusState = 'strongly_divergent';
    }
  }

  // Build notes
  const notes = buildAssessmentNotes(thesis, marketProb, divergenceScore, consensusState, anyWordingMismatch, anyLiquidityWarning, contractResults);

  return {
    thesis_probability_low: thesis.probability_low,
    thesis_probability_high: thesis.probability_high,
    prediction_market_implied_probability: marketProb != null ? Math.round(marketProb * 1000) / 1000 : null,
    divergence_score: divergenceScore != null ? Math.round(divergenceScore * 1000) / 1000 : null,
    consensus_state: consensusState,
    wording_warning: anyWordingMismatch,
    liquidity_warning: anyLiquidityWarning,
    thin_market_penalty: Math.round(maxThinPenalty * 1000) / 1000,
    notes,
    contracts: contractResults,
  };
}

/**
 * Compute bounded scoring helpers from an assessment.
 * These are informational — they do NOT override any scoring dimension.
 */
export function computeScoringHelpers(assessment) {
  if (!assessment || assessment.consensus_state === 'not_comparable') {
    return {
      prediction_market_divergence: null,
      prediction_market_confidence: null,
      prediction_market_commentary: 'No comparable prediction market data available.',
    };
  }

  // Bounded confidence: reduced by warnings
  let confidence = 1.0;
  if (assessment.wording_warning) confidence *= 0.5;
  if (assessment.liquidity_warning) confidence *= 0.6;
  confidence *= (1 - assessment.thin_market_penalty);
  confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

  // Bounded divergence modifier (capped at MAX_SCORING_MODIFIER)
  const divergenceModifier = assessment.divergence_score != null
    ? Math.min(MAX_SCORING_MODIFIER, assessment.divergence_score * 10 * confidence)
    : null;

  // Commentary
  let commentary = '';
  const mp = assessment.prediction_market_implied_probability;
  const tl = assessment.thesis_probability_low;
  const th = assessment.thesis_probability_high;

  if (mp != null) {
    commentary = `Market implies ${(mp * 100).toFixed(0)}% probability. `;
    commentary += `Thesis range: ${(tl * 100).toFixed(0)}-${(th * 100).toFixed(0)}%. `;
    commentary += `Consensus: ${assessment.consensus_state.replace(/_/g, ' ')}. `;

    if (assessment.wording_warning) {
      commentary += 'WARNING: Contract wording may not match thesis. ';
    }
    if (assessment.liquidity_warning) {
      commentary += 'WARNING: Thin market — reduced confidence. ';
    }
  }

  return {
    prediction_market_divergence: divergenceModifier,
    prediction_market_confidence: confidence,
    prediction_market_commentary: commentary.trim(),
  };
}

function buildAssessmentNotes(thesis, marketProb, divergence, consensus, wordingWarn, liquidityWarn, contracts) {
  const lines = [];

  if (marketProb != null) {
    const tl = (thesis.probability_low * 100).toFixed(0);
    const th = (thesis.probability_high * 100).toFixed(0);
    const mp = (marketProb * 100).toFixed(0);
    lines.push(`Thesis: ${tl}-${th}% | Market: ${mp}% | Divergence: ${(divergence * 100).toFixed(0)}pp`);
    lines.push(`Consensus state: ${consensus.replace(/_/g, ' ')}`);
  }

  if (wordingWarn) {
    lines.push('WORDING WARNING: Contract wording does not closely match thesis statement. Comparison reliability is reduced.');
  }

  if (liquidityWarn) {
    lines.push('LIQUIDITY WARNING: One or more linked markets are thinly traded. Signal value is reduced.');
  }

  const staleContracts = contracts.filter(c => c.is_stale);
  if (staleContracts.length > 0) {
    lines.push(`STALENESS WARNING: ${staleContracts.length} contract(s) have stale data. Do not treat as current consensus.`);
  }

  return lines.join('\n');
}
