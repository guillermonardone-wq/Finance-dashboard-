// ============================================================
// MISPRICING CHECKER — Separates important from tradable
// ============================================================

import {
  validateMispricingAssessment,
  MARKET_REACTION_STATES,
} from "./types.js";
import { getKnex } from "../db/connection.js";

export function assessMispricing(cluster, options = {}) {
  const { maxStaleHours = 24 } = options;

  let marketObs = options.marketObservations || [];
  if (marketObs.length === 0) {
    // fetchRelevantObservations is now async, but assessMispricing is called synchronously
    // from the pipeline. We'll handle this by passing marketObs from the caller.
    // If no observations were passed, we skip DB fetch in sync context.
    marketObs = [];
  }

  const now = Date.now();
  let avgFreshnessHours = null;
  let staleDataPenalty = false;

  if (marketObs.length > 0) {
    const ages = marketObs.map((obs) => {
      const fetchedAt = obs.fetched_at || obs.created_at;
      return (now - new Date(fetchedAt).getTime()) / (1000 * 3600);
    });
    avgFreshnessHours =
      Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
    staleDataPenalty = avgFreshnessHours > maxStaleHours;
  } else {
    staleDataPenalty = true;
    avgFreshnessHours = null;
  }

  const reactionState = determineReactionState(cluster, marketObs);

  const linkedSymbols = cluster.linked_market_symbols || [];
  const checkedAssets = marketObs.map((obs) => {
    const data = typeof obs.data === "string" ? JSON.parse(obs.data) : obs.data;
    return {
      symbol: obs.symbol || data?.symbol || "unknown",
      type: obs.observation_type,
      source: obs.source_attribution || obs.provider,
    };
  });

  const marketSignals = [];
  for (const obs of marketObs) {
    const data = typeof obs.data === "string" ? JSON.parse(obs.data) : obs.data;
    if (data.changePercent && Math.abs(data.changePercent) > 1.5) {
      marketSignals.push({
        symbol: data.symbol || obs.symbol,
        change: data.changePercent,
        description: `${data.symbol || obs.symbol} moved ${data.changePercent > 0 ? "+" : ""}${data.changePercent.toFixed(2)}%`,
      });
    }
    if (data.impliedVol30d && data.historicalVol30d) {
      const ratio = data.impliedVol30d / data.historicalVol30d;
      if (ratio < 0.85) {
        marketSignals.push({
          symbol: data.symbol || obs.symbol,
          description: `IV/HV ratio at ${ratio.toFixed(2)} — implied vol below realized. Potential underpricing of risk.`,
        });
      } else if (ratio > 1.3) {
        marketSignals.push({
          symbol: data.symbol || obs.symbol,
          description: `IV/HV ratio at ${ratio.toFixed(2)} — implied vol elevated above realized. Market may already be pricing elevated risk.`,
        });
      }
    }
  }

  let mispricingLikelihood = 0.3;

  if (marketObs.length === 0) {
    mispricingLikelihood = 0.3;
  } else if (
    reactionState === "no_reaction" &&
    cluster.cluster_strength !== "weak"
  ) {
    mispricingLikelihood = 0.6;
  } else if (reactionState === "early_reaction") {
    mispricingLikelihood = 0.5;
  } else if (reactionState === "partial_repricing") {
    mispricingLikelihood = 0.35;
  } else if (reactionState === "fully_repriced") {
    mispricingLikelihood = 0.1;
  } else if (reactionState === "overreaction") {
    mispricingLikelihood = 0.15;
  }

  if (staleDataPenalty) {
    mispricingLikelihood = Math.max(0.1, mispricingLikelihood * 0.7);
  }

  const reasoningParts = [];
  reasoningParts.push(`Market reaction: ${reactionState}`);
  reasoningParts.push(
    `Data freshness: ${avgFreshnessHours != null ? avgFreshnessHours.toFixed(1) + " hours avg" : "NO DATA"}`,
  );
  if (staleDataPenalty) reasoningParts.push("STALE DATA PENALTY APPLIED");
  if (marketSignals.length > 0) {
    reasoningParts.push(
      `Market signals: ${marketSignals.map((s) => s.description).join("; ")}`,
    );
  }
  if (checkedAssets.length === 0) {
    reasoningParts.push(
      "WARNING: No correlated assets could be checked. Mispricing assessment is low-confidence.",
    );
  }

  const assessment = validateMispricingAssessment({
    cluster_id: cluster.id,
    market_reaction_state: reactionState,
    correlated_assets_checked: checkedAssets,
    market_signals_found: marketSignals,
    implied_mispricing_likelihood: Math.round(mispricingLikelihood * 100) / 100,
    reasoning: reasoningParts.join(" | "),
    confidence_range: {
      low: Math.max(0, mispricingLikelihood - 0.2),
      high: Math.min(1, mispricingLikelihood + 0.2),
      best: mispricingLikelihood,
    },
    stale_data_penalty_applied: staleDataPenalty,
    data_freshness_hours: avgFreshnessHours,
  });

  return assessment.normalized;
}

function determineReactionState(cluster, marketObs) {
  if (marketObs.length === 0) return "unknown";

  const significantMoves = [];
  for (const obs of marketObs) {
    const data = typeof obs.data === "string" ? JSON.parse(obs.data) : obs.data;
    if (data.changePercent != null) {
      significantMoves.push(Math.abs(data.changePercent));
    }
  }

  if (significantMoves.length === 0) return "unknown";

  const maxMove = Math.max(...significantMoves);
  const avgMove =
    significantMoves.reduce((a, b) => a + b, 0) / significantMoves.length;

  if (maxMove > 5 || avgMove > 3) return "fully_repriced";
  if (maxMove > 3 || avgMove > 1.5) return "partial_repricing";
  if (maxMove > 1 || avgMove > 0.5) return "early_reaction";
  return "no_reaction";
}
