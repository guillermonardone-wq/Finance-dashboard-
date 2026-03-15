// ============================================================
// THESIS PACKET GENERATOR — Compiles full context for LLM review
// ============================================================
// Builds a structured packet containing everything an LLM needs
// to evaluate a thesis: the thesis itself, linked signals,
// market context, prediction market data, deterministic scores,
// and playbook matches.
//
// The packet is:
// 1. Sent as structured context in the LLM prompt
// 2. Stored alongside the LLM response for audit/replay
// ============================================================

import { getDb } from '../db/connection.js';

/**
 * Build a complete thesis packet for LLM evaluation.
 *
 * @param {string} thesisId
 * @param {Object} options - { includeMarketObs, includePredictionMarkets, includePlaybook }
 * @returns {Object} - structured packet
 */
export function buildThesisPacket(thesisId, options = {}) {
  const db = getDb();
  const {
    includeMarketObs = true,
    includePredictionMarkets = true,
    includePlaybook = true,
  } = options;

  // --- Core thesis ---
  const thesis = db.prepare('SELECT * FROM theses WHERE id = ?').get(thesisId);
  if (!thesis) throw new Error(`Thesis not found: ${thesisId}`);

  const parseJson = (val) => {
    if (!val || typeof val !== 'string') return val;
    try { return JSON.parse(val); } catch { return val; }
  };

  const thesisData = {
    id: thesis.id,
    title: thesis.title,
    thesis_statement: thesis.thesis_statement,
    status: thesis.status,
    classification: thesis.classification,
    created_at: thesis.created_at,
    updated_at: thesis.updated_at,

    // Core structure
    causal_chain: parseJson(thesis.causal_chain),
    affected_assets: parseJson(thesis.affected_assets),
    expected_timeline: parseJson(thesis.expected_timeline),

    // Probability
    probability: {
      low: thesis.probability_low,
      high: thesis.probability_high,
      best: thesis.probability_best,
    },

    // Market assessment
    market_pricing_assessment: parseJson(thesis.market_pricing_assessment),
    key_assumptions: parseJson(thesis.key_assumptions),
    alternative_explanations: parseJson(thesis.alternative_explanations),

    // Indicators
    leading_indicators: parseJson(thesis.leading_indicators),
    confirming_indicators: parseJson(thesis.confirming_indicators),
    invalidating_indicators: parseJson(thesis.invalidating_indicators),

    // Disconfirmation
    disconfirming_evidence: parseJson(thesis.disconfirming_evidence),
    strongest_bear_case: thesis.strongest_bear_case,
    what_would_make_opposite_stronger: thesis.what_would_make_opposite_stronger,
    early_vs_right: thesis.early_vs_right,
  };

  // --- Linked signals ---
  const signals = db.prepare(
    'SELECT id, title, description, category, source_type, source_attribution, novelty, reliability, signal_strength, created_at FROM signals WHERE thesis_id = ? AND status = ?'
  ).all(thesisId, 'linked');

  // --- Deterministic score snapshot ---
  const deterministicScores = {
    composite_score: thesis.composite_score,
    evidence_layer: thesis.score_evidence_layer,
    structure_layer: thesis.score_structure_layer,
    market_edge_layer: thesis.score_market_edge_layer,
    confidence_level: thesis.confidence_level,
    penalty_total: thesis.penalty_total,
    penalty_details: parseJson(thesis.penalty_details),

    // Individual factors
    signal_quality: thesis.score_signal_quality,
    signal_independence: thesis.score_signal_independence,
    evidence_freshness: thesis.score_evidence_freshness,
    data_reliability: thesis.score_data_reliability,
    evidence_quantity: thesis.score_evidence_quantity,
    causal_chain_clarity: thesis.score_causal_chain_clarity,
    internal_consistency: thesis.score_internal_consistency,
    counter_case_robustness: thesis.score_counter_case_robustness,
    assumption_load: thesis.score_assumption_load,
    timing_clarity: thesis.score_timing_clarity,
    market_awareness: thesis.score_market_awareness,
    prediction_market_divergence: thesis.score_prediction_market_divergence,
    asset_reaction_gaps: thesis.score_asset_reaction_gaps,
    liquidity_sensitivity: thesis.score_liquidity_sensitivity,
    catalyst_clarity: thesis.score_catalyst_clarity,
  };

  // --- Market observations ---
  let marketContext = [];
  if (includeMarketObs) {
    marketContext = db.prepare(
      `SELECT observation_type, symbol, name, data, provider, source_attribution, fetched_at
       FROM market_observations
       WHERE thesis_id = ?
       ORDER BY fetched_at DESC
       LIMIT 20`
    ).all(thesisId).map(obs => ({
      ...obs,
      data: parseJson(obs.data),
    }));
  }

  // --- Prediction market context ---
  let predictionMarketContext = null;
  if (includePredictionMarkets) {
    const links = db.prepare(
      `SELECT tpl.*, pme.title as event_title, pme.description as event_description,
              pme.status as event_status, pme.category as event_category
       FROM thesis_prediction_links tpl
       JOIN prediction_market_events pme ON tpl.prediction_market_event_id = pme.id
       WHERE tpl.thesis_id = ?`
    ).all(thesisId);

    const latestAssessment = db.prepare(
      'SELECT * FROM prediction_market_assessments WHERE thesis_id = ? ORDER BY assessed_at DESC LIMIT 1'
    ).get(thesisId);

    if (links.length > 0 || latestAssessment) {
      predictionMarketContext = {
        linked_contracts: links.map(l => ({
          event_title: l.event_title,
          event_category: l.event_category,
          link_type: l.link_type,
          link_confidence: l.link_confidence,
          wording_match_score: l.wording_match_score,
          wording_mismatch: !!l.wording_mismatch_flag,
          rationale: l.rationale,
        })),
        latest_assessment: latestAssessment ? {
          assessed_at: latestAssessment.assessed_at,
          thesis_probability: { low: latestAssessment.thesis_probability_low, high: latestAssessment.thesis_probability_high },
          pm_implied_probability: latestAssessment.prediction_market_implied_probability,
          divergence_score: latestAssessment.divergence_score,
          consensus_state: latestAssessment.consensus_state,
          wording_warning: !!latestAssessment.wording_warning,
          liquidity_warning: !!latestAssessment.liquidity_warning,
        } : null,
      };
    }
  }

  // --- Playbook matches ---
  let playbookMatches = [];
  if (includePlaybook) {
    const entries = db.prepare(
      "SELECT id, title, category, pattern_description, trigger_conditions, typical_assets, success_rate_estimate FROM playbook_entries WHERE status = 'active'"
    ).all();

    // Simple keyword overlap for packet — full matching is done by engine
    const thesisWords = new Set(
      `${thesis.title} ${thesis.thesis_statement}`.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );
    const signalCategories = new Set(signals.map(s => s.category));

    for (const entry of entries) {
      const triggers = parseJson(entry.trigger_conditions) || [];
      const categoryMatch = signalCategories.has(entry.category);
      const patternWords = (entry.pattern_description || '').toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const overlap = patternWords.filter(w => thesisWords.has(w)).length;

      if (categoryMatch || overlap >= 3) {
        playbookMatches.push({
          title: entry.title,
          category: entry.category,
          pattern_description: entry.pattern_description,
          success_rate: entry.success_rate_estimate,
          match_reason: categoryMatch ? 'category match' : `keyword overlap (${overlap})`,
        });
      }
    }
  }

  // --- Assemble packet ---
  const packet = {
    packet_version: '1.0',
    generated_at: new Date().toISOString(),
    thesis: thesisData,
    signals: signals.map(s => ({
      title: s.title,
      description: s.description,
      category: s.category,
      source_type: s.source_type,
      source_attribution: s.source_attribution,
      novelty: s.novelty,
      reliability: s.reliability,
      signal_strength: s.signal_strength,
      created_at: s.created_at,
    })),
    deterministic_scores: deterministicScores,
    market_context: marketContext,
    prediction_market_context: predictionMarketContext,
    playbook_matches: playbookMatches,
    signal_count: signals.length,
    signal_source_types: [...new Set(signals.map(s => s.source_type))],
    signal_categories: [...new Set(signals.map(s => s.category))],
  };

  return packet;
}
