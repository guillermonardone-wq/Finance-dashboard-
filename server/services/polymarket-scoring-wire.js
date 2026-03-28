// ============================================================
// POLYMARKET SCORING WIRE — Session 4 lightweight integration
// ============================================================
// Exposes prediction market data as a scoring input for the
// "prediction_market_divergence" dimension in the scoring engine.
//
// Does NOT redesign the scoring engine.
// Does NOT add new prediction market features.
// Simply bridges PM assessment → scoring dimension input.
// ============================================================

import { getLinksForThesis, getLatestAssessment } from "../providers/prediction-market/service.js";
import { computeScoringHelpers } from "../providers/prediction-market/assessment.js";

/**
 * Get the Polymarket scoring input for a thesis.
 *
 * Returns a shape usable by the scoring engine's
 * prediction_market_divergence dimension.
 *
 * @param {string} thesisId
 * @returns {Promise<{
 *   available: boolean,
 *   divergence_score: number|null,
 *   confidence: number|null,
 *   implied_probability: number|null,
 *   consensus_state: string,
 *   commentary: string,
 *   qualifying_contracts: number,
 *   warnings: string[]
 * }>}
 */
export async function getPolymarketScoringInput(thesisId) {
  const noData = {
    available: false,
    divergence_score: null,
    confidence: null,
    implied_probability: null,
    consensus_state: "not_comparable",
    commentary: "No prediction market data linked to this thesis.",
    qualifying_contracts: 0,
    warnings: [],
  };

  try {
    // Check if thesis has any PM links
    const links = await getLinksForThesis(thesisId);
    if (!links || links.length === 0) return noData;

    // Get latest assessment
    const assessment = await getLatestAssessment(thesisId);
    if (!assessment) return noData;

    // Compute scoring helpers from the assessment
    const helpers = computeScoringHelpers(assessment);

    // Build warnings list
    const warnings = [];
    if (assessment.wording_warning) warnings.push("wording_mismatch");
    if (assessment.liquidity_warning) warnings.push("thin_market");
    if (assessment.proxy_dominance_warning) warnings.push("proxy_dominance");
    if (assessment.insufficient_evidence) warnings.push("insufficient_evidence");

    return {
      available: helpers.prediction_market_divergence != null,
      divergence_score: helpers.prediction_market_divergence,
      confidence: helpers.prediction_market_confidence,
      implied_probability: assessment.prediction_market_implied_probability,
      consensus_state: assessment.consensus_state,
      commentary: helpers.prediction_market_commentary,
      qualifying_contracts: helpers.qualifying_contract_count,
      warnings,
    };
  } catch (err) {
    console.warn(`[Polymarket Wire] Failed for thesis ${thesisId}: ${err.message}`);
    return { ...noData, commentary: `Error fetching PM data: ${err.message}` };
  }
}

/**
 * Check if Polymarket scoring wire is available (any PM provider is configured).
 *
 * @returns {Promise<{ available: boolean, provider: string|null, eventCount: number }>}
 */
export async function getPolymarketWireStatus() {
  try {
    const { getKnex } = await import("../db/connection.js");
    const knex = getKnex();

    const provider = await knex("prediction_market_providers")
      .where("active", true)
      .first();

    if (!provider) {
      return { available: false, provider: null, eventCount: 0 };
    }

    const eventCount = await knex("prediction_market_events")
      .where("provider_id", provider.id)
      .where("status", "open")
      .count("id as count")
      .first();

    return {
      available: true,
      provider: provider.name,
      eventCount: Number(eventCount?.count || 0),
    };
  } catch {
    return { available: false, provider: null, eventCount: 0 };
  }
}
