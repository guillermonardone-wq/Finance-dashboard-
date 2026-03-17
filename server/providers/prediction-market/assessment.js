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
// - Stale data (>48h) is EXCLUDED, not merely downweighted
// - Proxy/adjacent markets are mechanically discounted
// - Minimum 2 qualifying contracts required for numeric output
// ============================================================

import {
  DIVERGENCE_ALIGNED,
  DIVERGENCE_MILDLY_DIVERGENT,
  WORDING_MATCH_FLOOR,
  MAX_SCORING_MODIFIER,
  LINK_TYPE_WEIGHTS,
  MIN_SCORABLE_CONTRACTS,
  MIN_CONTRACT_WEIGHT,
  PM_CONFIDENCE_FLOOR,
} from "./types.js";
import { predictionMarketAdapter } from "./adapter.js";

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
      consensus_state: "not_comparable",
      wording_warning: false,
      liquidity_warning: false,
      thin_market_penalty: 0,
      proxy_dominance_warning: false,
      insufficient_evidence: true,
      notes: "No prediction market contracts linked.",
      contracts: [],
    };
  }

  const contractResults = [];
  let weightedProbSum = 0;
  let weightSum = 0;
  let anyWordingMismatch = false;
  let anyLiquidityWarning = false;
  let maxThinPenalty = 0;
  let proxyWeight = 0;
  let directWeight = 0;

  for (const link of links) {
    const snapshot = link.latest_snapshot;
    if (!snapshot) continue;

    // Hard exclusion: >48h snapshots are excluded entirely
    const excluded = predictionMarketAdapter.isExcluded(snapshot.observed_at);
    const isStale = predictionMarketAdapter.isStale(snapshot.observed_at);
    const isThin = predictionMarketAdapter.isThinMarket(snapshot);
    const thinPenalty =
      predictionMarketAdapter.computeThinMarketPenalty(snapshot);
    const wordingMismatch =
      link.wording_mismatch_flag === 1 ||
      link.wording_match_score < WORDING_MATCH_FLOOR;

    if (wordingMismatch) anyWordingMismatch = true;
    if (isThin) anyLiquidityWarning = true;
    maxThinPenalty = Math.max(maxThinPenalty, thinPenalty);

    // Graduated freshness: 1.0 → 0.5 → 0.3 → 0 (excluded)
    const freshnessFactor = predictionMarketAdapter.freshnessFactor(
      snapshot.observed_at,
    );

    // Link type multiplier: direct=1.0, partial=0.7, proxy=0.4, adjacent=0.0
    const linkTypeWeight = LINK_TYPE_WEIGHTS[link.link_type] ?? 0;

    // Weight = confidence * wording * (1-thinPenalty) * freshness * linkType
    const weight =
      link.link_confidence *
      link.wording_match_score *
      (1 - thinPenalty) *
      freshnessFactor *
      linkTypeWeight;

    // Only include in aggregation if: not excluded, not wording-mismatched, not adjacent_signal
    if (!excluded && !wordingMismatch && weight > 0.01 && linkTypeWeight > 0) {
      weightedProbSum += snapshot.implied_probability * weight;
      weightSum += weight;

      // Track weight by type for proxy dominance check
      if (link.link_type === "proxy" || link.link_type === "adjacent_signal") {
        proxyWeight += weight;
      } else {
        directWeight += weight;
      }
    }

    contractResults.push({
      event_id: link.prediction_market_event_id,
      event_title: link.event_title || "",
      link_type: link.link_type,
      link_type_multiplier: linkTypeWeight,
      link_confidence: link.link_confidence,
      wording_match_score: link.wording_match_score,
      wording_mismatch: wordingMismatch,
      implied_probability: snapshot.implied_probability,
      volume_24h: snapshot.volume_24h,
      liquidity: snapshot.liquidity,
      is_stale: isStale,
      is_excluded: excluded,
      is_thin: isThin,
      thin_penalty: thinPenalty,
      freshness_factor: freshnessFactor,
      observed_at: snapshot.observed_at,
      weight,
    });
  }

  // Minimum evidence check: require at least MIN_SCORABLE_CONTRACTS with weight > MIN_CONTRACT_WEIGHT
  const qualifyingContracts = contractResults.filter(
    (c) =>
      c.weight > MIN_CONTRACT_WEIGHT && !c.is_excluded && !c.wording_mismatch,
  );
  const insufficientEvidence =
    qualifyingContracts.length < MIN_SCORABLE_CONTRACTS;

  // Proxy dominance check: >50% of aggregate weight from proxy/adjacent
  const totalAggWeight = proxyWeight + directWeight;
  const proxyDominance =
    totalAggWeight > 0 && proxyWeight / totalAggWeight > 0.5;

  // Compute weighted market probability
  const marketProb =
    !insufficientEvidence && weightSum > 0 ? weightedProbSum / weightSum : null;

  // Compute divergence
  let divergenceScore = null;
  let consensusState = "not_comparable";

  if (marketProb != null) {
    const thesisMid = (thesis.probability_low + thesis.probability_high) / 2;
    divergenceScore = Math.abs(thesisMid - marketProb);

    // Thin markets push toward not_comparable — they do NOT reduce apparent divergence
    if (maxThinPenalty > 0.5) {
      consensusState = "not_comparable";
    } else if (
      anyWordingMismatch &&
      contractResults.every((c) => c.wording_mismatch)
    ) {
      consensusState = "not_comparable";
    } else if (insufficientEvidence) {
      consensusState = "not_comparable";
    } else if (divergenceScore < DIVERGENCE_ALIGNED) {
      consensusState = "aligned";
    } else if (divergenceScore < DIVERGENCE_MILDLY_DIVERGENT) {
      consensusState = "mildly_divergent";
    } else {
      consensusState = "strongly_divergent";
    }
  }

  // Build notes
  const notes = buildAssessmentNotes(
    thesis,
    marketProb,
    divergenceScore,
    consensusState,
    anyWordingMismatch,
    anyLiquidityWarning,
    contractResults,
    insufficientEvidence,
    proxyDominance,
  );

  return {
    thesis_probability_low: thesis.probability_low,
    thesis_probability_high: thesis.probability_high,
    prediction_market_implied_probability:
      marketProb != null ? Math.round(marketProb * 1000) / 1000 : null,
    divergence_score:
      divergenceScore != null
        ? Math.round(divergenceScore * 1000) / 1000
        : null,
    consensus_state: consensusState,
    wording_warning: anyWordingMismatch,
    liquidity_warning: anyLiquidityWarning,
    thin_market_penalty: Math.round(maxThinPenalty * 1000) / 1000,
    proxy_dominance_warning: proxyDominance,
    insufficient_evidence: insufficientEvidence,
    qualifying_contract_count: qualifyingContracts.length,
    notes,
    contracts: contractResults,
  };
}

/**
 * Compute bounded scoring helpers from an assessment.
 * These are informational — they do NOT override any scoring dimension.
 */
export function computeScoringHelpers(assessment) {
  if (
    !assessment ||
    assessment.consensus_state === "not_comparable" ||
    assessment.insufficient_evidence
  ) {
    return {
      prediction_market_divergence: null,
      prediction_market_confidence: null,
      prediction_market_commentary: assessment?.insufficient_evidence
        ? `Insufficient evidence: ${assessment.qualifying_contract_count} qualifying contract(s), need ${MIN_SCORABLE_CONTRACTS}.`
        : "No comparable prediction market data available.",
      qualifying_contract_count: assessment?.qualifying_contract_count ?? 0,
    };
  }

  // Bounded confidence: reduced by warnings
  let confidence = 1.0;
  if (assessment.wording_warning) confidence *= 0.5;
  if (assessment.liquidity_warning) confidence *= 0.6;
  if (assessment.proxy_dominance_warning) confidence *= 0.5;
  confidence *= 1 - assessment.thin_market_penalty;
  confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

  // Bounded divergence modifier (capped at MAX_SCORING_MODIFIER)
  const divergenceModifier =
    assessment.divergence_score != null
      ? Math.min(
          MAX_SCORING_MODIFIER,
          assessment.divergence_score * 10 * confidence,
        )
      : null;

  // Commentary
  let commentary = "";
  const mp = assessment.prediction_market_implied_probability;
  const tl = assessment.thesis_probability_low;
  const th = assessment.thesis_probability_high;

  if (mp != null) {
    commentary = `Market implies ${(mp * 100).toFixed(0)}% probability. `;
    commentary += `Thesis range: ${(tl * 100).toFixed(0)}-${(th * 100).toFixed(0)}%. `;
    commentary += `Consensus: ${assessment.consensus_state.replace(/_/g, " ")}. `;
    commentary += `Based on ${assessment.qualifying_contract_count} qualifying contract(s). `;

    if (assessment.wording_warning) {
      commentary += "WARNING: Contract wording may not match thesis. ";
    }
    if (assessment.liquidity_warning) {
      commentary += "WARNING: Thin market — reduced confidence. ";
    }
    if (assessment.proxy_dominance_warning) {
      commentary +=
        "WARNING: Assessment driven primarily by proxy markets — direct comparison unavailable. ";
    }
  }

  return {
    prediction_market_divergence: divergenceModifier,
    prediction_market_confidence: confidence,
    prediction_market_commentary: commentary.trim(),
    qualifying_contract_count: assessment.qualifying_contract_count,
  };
}

function buildAssessmentNotes(
  thesis,
  marketProb,
  divergence,
  consensus,
  wordingWarn,
  liquidityWarn,
  contracts,
  insufficientEvidence,
  proxyDominance,
) {
  const lines = [];

  if (insufficientEvidence) {
    const qualifying = contracts.filter(
      (c) =>
        c.weight > MIN_CONTRACT_WEIGHT && !c.is_excluded && !c.wording_mismatch,
    );
    lines.push(
      `INSUFFICIENT EVIDENCE: Only ${qualifying.length} qualifying contract(s). Need at least ${MIN_SCORABLE_CONTRACTS} to produce a numeric assessment.`,
    );
  }

  if (marketProb != null) {
    const tl = (thesis.probability_low * 100).toFixed(0);
    const th = (thesis.probability_high * 100).toFixed(0);
    const mp = (marketProb * 100).toFixed(0);
    lines.push(
      `Thesis: ${tl}-${th}% | Market: ${mp}% | Divergence: ${(divergence * 100).toFixed(0)}pp`,
    );
    lines.push(`Consensus state: ${consensus.replace(/_/g, " ")}`);
  }

  if (wordingWarn) {
    lines.push(
      "WORDING WARNING: Contract wording does not closely match thesis statement. Comparison reliability is reduced.",
    );
  }

  if (liquidityWarn) {
    lines.push(
      "LIQUIDITY WARNING: One or more linked markets are thinly traded. Signal value is reduced.",
    );
  }

  const excludedContracts = contracts.filter((c) => c.is_excluded);
  if (excludedContracts.length > 0) {
    lines.push(
      `EXCLUDED: ${excludedContracts.length} contract(s) older than 48h — removed from aggregation entirely.`,
    );
  }

  const staleContracts = contracts.filter((c) => c.is_stale && !c.is_excluded);
  if (staleContracts.length > 0) {
    lines.push(
      `STALENESS WARNING: ${staleContracts.length} contract(s) have stale data (6-48h). Weight reduced.`,
    );
  }

  if (proxyDominance) {
    lines.push(
      "PROXY DOMINANCE WARNING: >50% of aggregate weight comes from proxy markets. Direct comparison unavailable. Do not treat as definitive.",
    );
  }

  return lines.join("\n");
}
