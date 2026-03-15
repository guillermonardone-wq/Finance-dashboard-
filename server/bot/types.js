// ============================================================
// BOT LAYER — Type Definitions & Runtime Validators
// ============================================================
// These are the canonical shapes for all bot-layer output objects.
// Every agent in the pipeline produces one of these types.
// Source attribution, confidence ranges, and downgrade reasons
// are MANDATORY on all output objects — not optional decorations.
// ============================================================

import { v4 as uuidv4 } from 'uuid';

/**
 * BOT STATES — The only states the bot layer can assign.
 * Action states (PAPER_TRADE, SMALL_POSITION, FULLY_QUALIFIED) are
 * user-side only. The bot CANNOT promote past ESCALATE.
 */
export const BOT_STATES = [
  'IGNORE',
  'LOG_ONLY',
  'WATCH',
  'DEVELOP_THESIS',
  'QUARANTINE',
  'ESCALATE',
];

export const SIGNAL_CATEGORIES = [
  'geopolitical_escalation', 'military_mobilization', 'commodity_chokepoint',
  'sanctions_risk', 'shipping_disruption', 'energy_bottleneck',
  'policy_shock', 'currency_instability', 'market_complacency',
  'central_bank_action', 'election_political', 'supply_chain',
  'technology_disruption', 'credit_stress', 'conflict_kinetic',
  'diplomatic_shift', 'regime_change', 'trade_war', 'other',
];

export const URGENCY_LEVELS = ['low', 'medium', 'high', 'critical'];

export const MARKET_REACTION_STATES = [
  'no_reaction',          // market hasn't moved
  'early_reaction',       // small moves, vol ticking up
  'partial_repricing',    // correlated assets moving, not fully priced
  'fully_repriced',       // market already moved, opportunity gone
  'overreaction',         // market may have overshot
  'unknown',              // insufficient data to judge
];

export const CLUSTER_STRENGTH_LEVELS = [
  'weak',       // 1-2 signals, single source
  'emerging',   // 3+ signals, limited independence
  'moderate',   // multi-source, some corroboration
  'strong',     // independent multi-source, pattern-consistent
  'significant', // overwhelming multi-domain confirmation
];

// ============================================================
// RUNTIME VALIDATORS
// ============================================================
// These validate and normalize bot output objects at runtime.
// Every field that matters for decision quality is checked.

function validateConfidenceRange(range) {
  if (!range || typeof range !== 'object') return { low: 0.1, high: 0.5, best: 0.3 };
  return {
    low: clamp(range.low ?? 0.1, 0, 1),
    high: clamp(range.high ?? 0.5, 0, 1),
    best: clamp(range.best ?? 0.3, 0, 1),
  };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function validateCandidateSignal(obj) {
  const errors = [];
  if (!obj.title || obj.title.length < 5) errors.push('title required (min 5 chars)');
  if (!obj.summary || obj.summary.length < 10) errors.push('summary required (min 10 chars)');
  if (!obj.source_refs || obj.source_refs.length === 0) errors.push('at least one source_ref required');
  if (!obj.categories || obj.categories.length === 0) errors.push('at least one category required');
  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      id: obj.id || uuidv4(),
      title: obj.title || '',
      summary: obj.summary || '',
      detected_at: obj.detected_at || new Date().toISOString(),
      source_refs: obj.source_refs || [],
      entities: obj.entities || [],
      geographies: obj.geographies || [],
      categories: (obj.categories || []).filter(c => SIGNAL_CATEGORIES.includes(c)),
      novelty_score: clamp(obj.novelty_score ?? 0.5, 0, 1),
      urgency_score: obj.urgency_score || 'medium',
      confidence_range: validateConfidenceRange(obj.confidence_range),
      linked_market_symbols: obj.linked_market_symbols || [],
      linked_macro_series: obj.linked_macro_series || [],
      notes: obj.notes || '',
      penalties: obj.penalties || [],
    },
  };
}

export function validateSignalCluster(obj) {
  const errors = [];
  if (!obj.title) errors.push('title required');
  if (!obj.member_signal_ids || obj.member_signal_ids.length === 0) errors.push('at least one member signal required');
  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      id: obj.id || uuidv4(),
      title: obj.title || '',
      summary: obj.summary || '',
      member_signal_ids: obj.member_signal_ids || [],
      primary_entities: obj.primary_entities || [],
      primary_geographies: obj.primary_geographies || [],
      categories: obj.categories || [],
      cluster_strength: CLUSTER_STRENGTH_LEVELS.includes(obj.cluster_strength) ? obj.cluster_strength : 'weak',
      cluster_novelty: clamp(obj.cluster_novelty ?? 0.5, 0, 1),
      first_detected_at: obj.first_detected_at || new Date().toISOString(),
      latest_update_at: obj.latest_update_at || new Date().toISOString(),
      confidence_range: validateConfidenceRange(obj.confidence_range),
      signal_count: obj.member_signal_ids?.length || 0,
      independent_source_count: obj.independent_source_count || 0,
      duplicate_penalty_applied: obj.duplicate_penalty_applied || false,
      notes: obj.notes || '',
    },
  };
}

export function validatePatternMatch(obj) {
  return {
    valid: !!(obj.cluster_id && obj.pattern_name),
    normalized: {
      id: obj.id || uuidv4(),
      cluster_id: obj.cluster_id || '',
      playbook_pattern_id: obj.playbook_pattern_id || null,
      pattern_name: obj.pattern_name || 'Unknown pattern',
      match_score: clamp(obj.match_score ?? 0, 0, 1),
      matched_precursors: obj.matched_precursors || [],
      missing_confirmations: obj.missing_confirmations || [],
      common_false_positives: obj.common_false_positives || [],
      likely_affected_assets: obj.likely_affected_assets || [],
      false_positive_overlap: clamp(obj.false_positive_overlap ?? 0, 0, 1),
      notes: obj.notes || '',
    },
  };
}

export function validateMispricingAssessment(obj) {
  return {
    valid: !!(obj.cluster_id),
    normalized: {
      id: obj.id || uuidv4(),
      cluster_id: obj.cluster_id || '',
      assessed_at: obj.assessed_at || new Date().toISOString(),
      market_reaction_state: MARKET_REACTION_STATES.includes(obj.market_reaction_state)
        ? obj.market_reaction_state : 'unknown',
      correlated_assets_checked: obj.correlated_assets_checked || [],
      market_signals_found: obj.market_signals_found || [],
      implied_mispricing_likelihood: clamp(obj.implied_mispricing_likelihood ?? 0.3, 0, 1),
      reasoning: obj.reasoning || '',
      confidence_range: validateConfidenceRange(obj.confidence_range),
      stale_data_penalty_applied: obj.stale_data_penalty_applied || false,
      data_freshness_hours: obj.data_freshness_hours ?? null,
      notes: obj.notes || '',
    },
  };
}

export function validateCounterCase(obj) {
  const errors = [];
  if (!obj.strongest_opposing_case || obj.strongest_opposing_case.length < 20) {
    errors.push('strongest_opposing_case must be substantive (>20 chars). Weak objections defeat the purpose.');
  }
  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      id: obj.id || uuidv4(),
      cluster_id: obj.cluster_id || '',
      generated_at: obj.generated_at || new Date().toISOString(),
      strongest_opposing_case: obj.strongest_opposing_case || '',
      alternative_explanations: obj.alternative_explanations || [],
      pricing_already_reflects_story: obj.pricing_already_reflects_story || false,
      evidence_gaps: obj.evidence_gaps || [],
      likely_false_positive_paths: obj.likely_false_positive_paths || [],
      invalidation_triggers: obj.invalidation_triggers || [],
      circular_logic_detected: obj.circular_logic_detected || false,
      reasoning_quality_score: clamp(obj.reasoning_quality_score ?? 5, 0, 10),
      notes: obj.notes || '',
    },
  };
}

export function validateBotRecommendation(obj) {
  const errors = [];
  if (!obj.cluster_id) errors.push('cluster_id required');
  if (!BOT_STATES.includes(obj.recommended_state)) errors.push(`invalid state: ${obj.recommended_state}`);
  if (!obj.why_not_higher || obj.why_not_higher.length < 10) {
    errors.push('why_not_higher is MANDATORY and must be substantive');
  }
  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      id: obj.id || uuidv4(),
      cluster_id: obj.cluster_id || '',
      generated_at: obj.generated_at || new Date().toISOString(),
      recommended_state: BOT_STATES.includes(obj.recommended_state) ? obj.recommended_state : 'LOG_ONLY',
      confidence_range: validateConfidenceRange(obj.confidence_range),
      rationale: obj.rationale || '',
      why_not_higher: obj.why_not_higher || 'Not assessed',
      required_next_confirmations: obj.required_next_confirmations || [],
      required_user_actions: obj.required_user_actions || [],
      downgrade_reasons: obj.downgrade_reasons || [],
      freshness_warnings: obj.freshness_warnings || [],
      penalties_applied: obj.penalties_applied || [],
      linked_pattern_match_id: obj.linked_pattern_match_id || null,
      linked_mispricing_assessment_id: obj.linked_mispricing_assessment_id || null,
      linked_counter_case_id: obj.linked_counter_case_id || null,
      governor_overrides: obj.governor_overrides || [],
      notes: obj.notes || '',
    },
  };
}
