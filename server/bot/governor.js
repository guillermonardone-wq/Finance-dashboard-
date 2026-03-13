// ============================================================
// GOVERNOR — Final routing authority for the bot layer
// ============================================================
// The Governor is the behavioral immune system of the bot layer.
// It applies hard routing rules that CANNOT be overridden by
// pattern strength, narrative excitement, or apparent urgency.
//
// Design principle: the Governor's job is to prevent overpromotion.
// It will never upgrade a state. It can only cap or downgrade.
//
// The upstream agents (Scout, Clusterer, Pattern Matcher, Mispricing
// Checker, Red-Team) each propose an input. The Governor takes the
// composite picture and applies deterministic routing rules.
//
// WHY THIS DESIGN:
// The user's decision profile includes vulnerabilities to:
//   - narrative attachment (exciting story → premature conviction)
//   - overweighting dramatic events (dramatic ≠ mispriced)
//   - acting on thin evidence (one source ≠ confirmation)
//   - skipping disconfirmation (no bear case = no rigor)
//
// The Governor encodes these constraints as hard rules.
// A dramatic cluster with one source and no market confirmation
// CANNOT reach DEVELOP_THESIS no matter how compelling the narrative.
// ============================================================

import {
  BOT_STATES,
  validateBotRecommendation,
} from './types.js';

// ============================================================
// PENALTY DEFINITIONS
// ============================================================
// Each penalty has:
//   - id: unique identifier
//   - name: human readable
//   - check: function(inputs) → { applies: bool, severity: number, reason: string }
//   - effect: 'downgrade' | 'cap' | 'warn'
//   - cap_at: maximum state if penalty applies (for 'cap' type)

export const PENALTIES = [
  {
    id: 'one_source',
    name: 'Single Source Penalty',
    description: 'Only one source detected. Independent confirmation is missing.',
    check: (inputs) => {
      const independentSources = inputs.cluster?.independent_source_count || 0;
      return {
        applies: independentSources <= 1,
        severity: 0.3,
        reason: `Only ${independentSources} independent source(s). Single-source signals are unreliable.`,
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'duplicate_heavy',
    name: 'Duplicate Story Penalty',
    description: 'Cluster is inflated by duplicate coverage of the same event.',
    check: (inputs) => {
      const { cluster } = inputs;
      if (!cluster) return { applies: false };
      const dupeRatio = cluster.duplicate_penalty_applied ? 1 : 0;
      const signalCount = cluster.signal_count || 0;
      const independentCount = cluster.independent_source_count || 0;
      const inflated = signalCount > 2 && independentCount < signalCount * 0.4;
      return {
        applies: inflated || dupeRatio > 0,
        severity: 0.2,
        reason: `${signalCount} signals but only ${independentCount} independent sources. Volume ≠ confirmation.`,
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'dramatic_language',
    name: 'Dramatic Language Penalty',
    description: 'High dramatic intensity without corresponding concrete evidence.',
    check: (inputs) => {
      const { candidateSignals } = inputs;
      if (!candidateSignals || candidateSignals.length === 0) return { applies: false };
      // Check if signals were flagged for dramatic language during scouting
      const dramaticFlags = candidateSignals.filter(s =>
        (s.penalties || []).some(p => p.id === 'dramatic_language')
      );
      return {
        applies: dramaticFlags.length > candidateSignals.length * 0.5,
        severity: 0.15,
        reason: 'More than half of signals flagged for dramatic language without concrete operational content.',
      };
    },
    effect: 'warn',
    cap_at: null,
  },
  {
    id: 'stale_data',
    name: 'Stale Data Penalty',
    description: 'Supporting market data is stale or missing.',
    check: (inputs) => {
      const { mispricingAssessment } = inputs;
      if (!mispricingAssessment) return { applies: true, severity: 0.2, reason: 'No mispricing assessment available.' };
      return {
        applies: mispricingAssessment.stale_data_penalty_applied || mispricingAssessment.market_reaction_state === 'unknown',
        severity: 0.25,
        reason: mispricingAssessment.stale_data_penalty_applied
          ? `Market data is stale (${mispricingAssessment.data_freshness_hours || '?'} hours old). Decision quality degrades with stale inputs.`
          : 'Market reaction state unknown — insufficient data to evaluate mispricing.',
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'missing_market_check',
    name: 'Missing Market Check Penalty',
    description: 'No market confirmation check was performed.',
    check: (inputs) => {
      return {
        applies: !inputs.mispricingAssessment,
        severity: 0.2,
        reason: 'No market mispricing assessment performed. Cannot distinguish important from tradable.',
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'missing_disconfirmation',
    name: 'Missing Disconfirmation Penalty',
    description: 'No red-team counter case was generated.',
    check: (inputs) => {
      return {
        applies: !inputs.counterCase || !inputs.counterCase.strongest_opposing_case || inputs.counterCase.strongest_opposing_case.length < 20,
        severity: 0.3,
        reason: 'No substantive counter case generated. Proceeding without disconfirmation is confirmation bias in action.',
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'false_positive_overlap',
    name: 'False Positive Similarity Penalty',
    description: 'Pattern match has high overlap with known false positive patterns.',
    check: (inputs) => {
      const fp = inputs.patternMatch?.false_positive_overlap || 0;
      return {
        applies: fp > 0.5,
        severity: fp * 0.4,
        reason: `Pattern has ${(fp * 100).toFixed(0)}% overlap with known false positives. Proceed with extreme caution.`,
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'assumption_overload',
    name: 'Assumption Overload Penalty',
    description: 'Too many assumptions required for the thesis to work.',
    check: (inputs) => {
      const missingConfirmations = inputs.patternMatch?.missing_confirmations?.length || 0;
      return {
        applies: missingConfirmations > 4,
        severity: 0.2,
        reason: `${missingConfirmations} missing confirmations. Each is a way this falls apart.`,
      };
    },
    effect: 'cap',
    cap_at: 'WATCH',
  },
  {
    id: 'excitement_evidence_imbalance',
    name: 'Excitement-Evidence Imbalance',
    description: 'High drama, thin evidence. The most dangerous combination for this user profile.',
    check: (inputs) => {
      const { cluster, mispricingAssessment, counterCase } = inputs;
      if (!cluster) return { applies: false };
      const highNovelty = (cluster.cluster_novelty || 0) > 0.7;
      const weakEvidence = (cluster.independent_source_count || 0) < 3;
      const weakMispricing = !mispricingAssessment || (mispricingAssessment.implied_mispricing_likelihood || 0) < 0.4;
      const strongCounter = counterCase && (counterCase.reasoning_quality_score || 0) >= 6;
      return {
        applies: highNovelty && weakEvidence && (weakMispricing || strongCounter),
        severity: 0.35,
        reason: 'This looks exciting but evidence is thin and/or the counter case is strong. This is exactly the pattern where you historically over-commit.',
      };
    },
    effect: 'cap',
    cap_at: 'QUARANTINE',
  },
  {
    id: 'market_already_priced',
    name: 'Market Already Priced',
    description: 'Correlated assets have already moved substantially.',
    check: (inputs) => {
      const state = inputs.mispricingAssessment?.market_reaction_state;
      return {
        applies: state === 'fully_repriced' || state === 'overreaction',
        severity: 0.3,
        reason: state === 'fully_repriced'
          ? 'Market has already repriced. The opportunity window may be closed.'
          : 'Market may have overreacted. Different analysis needed.',
      };
    },
    effect: 'cap',
    cap_at: 'LOG_ONLY',
  },
  {
    id: 'missing_source_attribution',
    name: 'Missing Source Attribution',
    description: 'Key signals lack proper source attribution.',
    check: (inputs) => {
      const signals = inputs.candidateSignals || [];
      const missing = signals.filter(s => !s.source_refs || s.source_refs.length === 0);
      return {
        applies: missing.length > signals.length * 0.3,
        severity: 0.15,
        reason: `${missing.length}/${signals.length} signals lack source attribution. Unattributed signals cannot be verified.`,
      };
    },
    effect: 'cap',
    cap_at: 'LOG_ONLY',
  },
];

// ============================================================
// DETERMINISTIC ROUTING RULES
// ============================================================
// These rules map composite inputs to a recommended state.
// Rules are evaluated in priority order. First match wins.
// After rule-based routing, penalties are applied as caps/downgrades.

export const ROUTING_RULES = [
  {
    id: 'rule_A',
    name: 'Single source, no market confirmation, no pattern match',
    description: 'One source only AND no market confirmation AND no playbook match → LOG_ONLY or WATCH',
    check: (inputs) => {
      const singleSource = (inputs.cluster?.independent_source_count || 0) <= 1;
      const noMarket = !inputs.mispricingAssessment || inputs.mispricingAssessment.market_reaction_state === 'unknown';
      const noPattern = !inputs.patternMatch || (inputs.patternMatch.match_score || 0) < 0.3;
      return singleSource && noMarket && noPattern;
    },
    state: 'LOG_ONLY',
    why_not_higher: 'Single source with no market data and no pattern match. Insufficient basis for active monitoring.',
  },
  {
    id: 'rule_B',
    name: 'High cluster strength but duplicate-heavy and low mispricing',
    description: 'Cluster strength high BUT duplicate-heavy AND mispricing low → WATCH',
    check: (inputs) => {
      const strongCluster = ['moderate', 'strong', 'significant'].includes(inputs.cluster?.cluster_strength);
      const duplicateHeavy = (inputs.cluster?.independent_source_count || 0) < (inputs.cluster?.signal_count || 0) * 0.4;
      const lowMispricing = !inputs.mispricingAssessment || (inputs.mispricingAssessment.implied_mispricing_likelihood || 0) < 0.3;
      return strongCluster && duplicateHeavy && lowMispricing;
    },
    state: 'WATCH',
    why_not_higher: 'Cluster appears strong but is inflated by duplicate coverage, and market is not obviously mispricing. Volume of coverage ≠ independent confirmation.',
  },
  {
    id: 'rule_C',
    name: 'Pattern match strong but critical confirmations missing',
    description: 'Pattern match strong BUT critical confirmations missing → WATCH or QUARANTINE',
    check: (inputs) => {
      const strongPattern = inputs.patternMatch && (inputs.patternMatch.match_score || 0) >= 0.6;
      const missingCritical = (inputs.patternMatch?.missing_confirmations?.length || 0) >= 3;
      return strongPattern && missingCritical;
    },
    state: 'WATCH',
    why_not_higher: 'Pattern match is suggestive but too many expected confirmations are absent. The pattern is incomplete.',
  },
  {
    id: 'rule_D',
    name: 'Important event but market already repriced',
    description: 'Event importance high BUT market already repriced → LOG_ONLY',
    check: (inputs) => {
      const highNovelty = (inputs.cluster?.cluster_novelty || 0) > 0.6;
      const repriced = inputs.mispricingAssessment?.market_reaction_state === 'fully_repriced';
      return highNovelty && repriced;
    },
    state: 'LOG_ONLY',
    why_not_higher: 'Event is notable but market has already repriced. Important ≠ mispriced. The opportunity window appears closed.',
  },
  {
    id: 'rule_E',
    name: 'Dramatic intensity high, evidence low',
    description: 'Dramatic intensity high AND evidence low → QUARANTINE',
    check: (inputs) => {
      const highNovelty = (inputs.cluster?.cluster_novelty || 0) > 0.7;
      const lowEvidence = (inputs.cluster?.independent_source_count || 0) < 3;
      const lowConfidence = (inputs.cluster?.confidence_range?.best || 0) < 0.4;
      return highNovelty && lowEvidence && lowConfidence;
    },
    state: 'QUARANTINE',
    why_not_higher: 'This is exactly the trap: exciting, dramatic, but under-validated. Quarantined until evidence improves. Come back when you have independent confirmation.',
  },
  {
    id: 'rule_F',
    name: 'Multi-source, pattern match, plausible mispricing, red-team not dominant',
    description: 'Independent sources ≥ 3 AND pattern match strong AND mispricing plausible AND red-team not dominant → DEVELOP_THESIS',
    check: (inputs) => {
      const multiSource = (inputs.cluster?.independent_source_count || 0) >= 3;
      const strongPattern = inputs.patternMatch && (inputs.patternMatch.match_score || 0) >= 0.5;
      const mispricingPlausible = inputs.mispricingAssessment && (inputs.mispricingAssessment.implied_mispricing_likelihood || 0) >= 0.4;
      const redTeamNotDominant = !inputs.counterCase || (inputs.counterCase.reasoning_quality_score || 0) < 7;
      return multiSource && strongPattern && mispricingPlausible && redTeamNotDominant;
    },
    state: 'DEVELOP_THESIS',
    why_not_higher: 'Evidence supports structured thesis development. Action states require user-side gating — the bot layer does not approve trades.',
  },
  {
    id: 'rule_G',
    name: 'Source freshness poor',
    description: 'Data freshness poor → cap at WATCH',
    check: (inputs) => {
      const stale = inputs.mispricingAssessment?.stale_data_penalty_applied;
      const veryStale = (inputs.mispricingAssessment?.data_freshness_hours || 0) > 48;
      return stale || veryStale;
    },
    state: 'WATCH',
    why_not_higher: 'Supporting data is stale. Cannot make routing decisions on outdated market information.',
  },
];

// ============================================================
// ESCALATION RULES (separate from routing)
// ============================================================
// These determine when to flag for immediate user attention.

export const ESCALATION_RULES = [
  {
    id: 'rapid_cluster_growth',
    name: 'Rapid Cluster Growth',
    check: (inputs) => {
      const signalCount = inputs.cluster?.signal_count || 0;
      // If cluster grew significantly in the last hour
      const recentSignals = (inputs.candidateSignals || []).filter(s => {
        const age = (Date.now() - new Date(s.detected_at).getTime()) / (1000 * 3600);
        return age < 1;
      });
      return recentSignals.length >= 3 && signalCount >= 5;
    },
    reason: 'Cluster is growing rapidly — multiple new signals in the last hour.',
  },
  {
    id: 'high_urgency_multi_source',
    name: 'High Urgency + Multi-Source',
    check: (inputs) => {
      const urgentSignals = (inputs.candidateSignals || []).filter(s => s.urgency_score === 'critical' || s.urgency_score === 'high');
      const multiSource = (inputs.cluster?.independent_source_count || 0) >= 2;
      return urgentSignals.length >= 2 && multiSource;
    },
    reason: 'Multiple high-urgency signals from independent sources. May require immediate review.',
  },
  {
    id: 'strong_pattern_with_catalyst',
    name: 'Strong Pattern Match with Imminent Catalyst',
    check: (inputs) => {
      const strongPattern = inputs.patternMatch && (inputs.patternMatch.match_score || 0) >= 0.7;
      // Check if any signals mention imminent events
      const imminentSignals = (inputs.candidateSignals || []).filter(s => s.urgency_score === 'critical');
      return strongPattern && imminentSignals.length >= 1;
    },
    reason: 'Strong pattern match combined with imminent catalyst signal.',
  },
];

// ============================================================
// GOVERNOR MAIN FUNCTION
// ============================================================

/**
 * Run the Governor on assembled inputs from all upstream agents.
 *
 * @param {Object} inputs
 * @param {Object} inputs.cluster - SignalCluster
 * @param {Array} inputs.candidateSignals - CandidateSignal[]
 * @param {Object|null} inputs.patternMatch - PatternMatch
 * @param {Object|null} inputs.mispricingAssessment - MispricingAssessment
 * @param {Object|null} inputs.counterCase - CounterCase
 * @returns {Object} Validated BotRecommendation
 */
export function runGovernor(inputs) {
  const penalties_applied = [];
  const downgrade_reasons = [];
  const freshness_warnings = [];
  const governor_overrides = [];

  // Step 1: Determine base state from routing rules
  let recommended_state = 'LOG_ONLY'; // default: conservative
  let matched_rule = null;
  let base_why_not_higher = 'No routing rule matched. Defaulting to LOG_ONLY — insufficient signal quality.';

  for (const rule of ROUTING_RULES) {
    if (rule.check(inputs)) {
      recommended_state = rule.state;
      matched_rule = rule;
      base_why_not_higher = rule.why_not_higher;
      break;
    }
  }

  // Step 2: Apply penalties as caps/downgrades
  for (const penalty of PENALTIES) {
    const result = penalty.check(inputs);
    if (result.applies) {
      penalties_applied.push({
        id: penalty.id,
        name: penalty.name,
        severity: result.severity,
        reason: result.reason,
        effect: penalty.effect,
      });

      if (penalty.effect === 'cap' && penalty.cap_at) {
        const capIndex = BOT_STATES.indexOf(penalty.cap_at);
        const currentIndex = BOT_STATES.indexOf(recommended_state);
        if (currentIndex > capIndex) {
          governor_overrides.push({
            from: recommended_state,
            to: penalty.cap_at,
            reason: `${penalty.name}: ${result.reason}`,
          });
          recommended_state = penalty.cap_at;
        }
      }

      if (penalty.id === 'stale_data') {
        freshness_warnings.push(result.reason);
      }

      downgrade_reasons.push(`[${penalty.id}] ${result.reason}`);
    }
  }

  // Step 3: Red-team dominance check
  // If the counter case is stronger than the supporting evidence, downgrade
  if (inputs.counterCase) {
    const counterQuality = inputs.counterCase.reasoning_quality_score || 0;
    if (counterQuality >= 7 && BOT_STATES.indexOf(recommended_state) > BOT_STATES.indexOf('WATCH')) {
      governor_overrides.push({
        from: recommended_state,
        to: 'WATCH',
        reason: `Red-team counter case is strong (quality: ${counterQuality}/10). The opposing argument is more compelling than the supporting evidence.`,
      });
      recommended_state = 'WATCH';
      downgrade_reasons.push(`Red-team dominant: counter case quality ${counterQuality}/10`);
    }
  }

  // Step 4: Check escalation conditions
  let should_escalate = false;
  const escalation_reasons = [];
  for (const rule of ESCALATION_RULES) {
    if (rule.check(inputs)) {
      should_escalate = true;
      escalation_reasons.push(rule.reason);
    }
  }

  if (should_escalate && BOT_STATES.indexOf(recommended_state) >= BOT_STATES.indexOf('WATCH')) {
    // Escalation doesn't change the analytical state — it just flags for attention
    // The state stays where it is, but ESCALATE is added as a routing action
    recommended_state = 'ESCALATE';
  }

  // Step 5: Build required actions
  const required_next_confirmations = [];
  const required_user_actions = [];

  if (inputs.patternMatch?.missing_confirmations) {
    required_next_confirmations.push(...inputs.patternMatch.missing_confirmations.map(mc =>
      typeof mc === 'string' ? mc : mc.description || JSON.stringify(mc)
    ));
  }

  if (recommended_state === 'DEVELOP_THESIS') {
    required_user_actions.push('Create structured thesis with full disconfirmation case');
    required_user_actions.push('Define invalidation conditions');
    required_user_actions.push('Identify expression vehicle candidates');
  }
  if (recommended_state === 'QUARANTINE') {
    required_user_actions.push('Wait for additional independent confirmation');
    required_user_actions.push('Review after cooling-off period');
    required_user_actions.push('Do not act on this until evidence improves');
  }
  if (recommended_state === 'ESCALATE') {
    required_user_actions.push('Review escalated cluster immediately');
    required_user_actions.push(...escalation_reasons);
  }

  // Step 6: Build composite why_not_higher
  const why_not_higher_parts = [base_why_not_higher];
  if (governor_overrides.length > 0) {
    why_not_higher_parts.push(
      'Governor overrides applied: ' + governor_overrides.map(o => o.reason).join('; ')
    );
  }
  if (penalties_applied.length > 0) {
    const penaltyNames = penalties_applied.map(p => p.name).join(', ');
    why_not_higher_parts.push(`Penalties active: ${penaltyNames}`);
  }

  // Step 7: Build confidence range
  const clusterConf = inputs.cluster?.confidence_range || { low: 0.1, high: 0.5, best: 0.3 };
  // Governor always widens the range slightly to reflect its skepticism
  const confidence_range = {
    low: Math.max(0, clusterConf.low - 0.05),
    high: Math.min(1, clusterConf.high),
    best: clusterConf.best * (1 - penalties_applied.length * 0.05), // each penalty reduces best estimate
  };

  // Step 8: Build rationale
  const rationale = buildRationale(inputs, recommended_state, matched_rule, penalties_applied, governor_overrides);

  // Step 9: Validate and return
  const recommendation = validateBotRecommendation({
    cluster_id: inputs.cluster?.id || '',
    recommended_state,
    confidence_range,
    rationale,
    why_not_higher: why_not_higher_parts.join(' | '),
    required_next_confirmations,
    required_user_actions,
    downgrade_reasons,
    freshness_warnings,
    penalties_applied,
    linked_pattern_match_id: inputs.patternMatch?.id || null,
    linked_mispricing_assessment_id: inputs.mispricingAssessment?.id || null,
    linked_counter_case_id: inputs.counterCase?.id || null,
    governor_overrides,
  });

  return recommendation.normalized;
}

function buildRationale(inputs, state, matchedRule, penalties, overrides) {
  const parts = [];

  parts.push(`State: ${state}`);

  if (matchedRule) {
    parts.push(`Matched rule: ${matchedRule.name}`);
  }

  if (inputs.cluster) {
    parts.push(`Cluster: ${inputs.cluster.signal_count || 0} signals, ${inputs.cluster.independent_source_count || 0} independent sources, strength: ${inputs.cluster.cluster_strength}`);
  }

  if (inputs.patternMatch) {
    parts.push(`Pattern: ${inputs.patternMatch.pattern_name} (match: ${((inputs.patternMatch.match_score || 0) * 100).toFixed(0)}%)`);
  }

  if (inputs.mispricingAssessment) {
    parts.push(`Market: ${inputs.mispricingAssessment.market_reaction_state}, mispricing likelihood: ${((inputs.mispricingAssessment.implied_mispricing_likelihood || 0) * 100).toFixed(0)}%`);
  }

  if (inputs.counterCase) {
    parts.push(`Counter case quality: ${inputs.counterCase.reasoning_quality_score || 0}/10`);
  }

  if (penalties.length > 0) {
    parts.push(`Penalties: ${penalties.length} applied (${penalties.map(p => p.id).join(', ')})`);
  }

  if (overrides.length > 0) {
    parts.push(`Governor overrides: ${overrides.length}`);
  }

  return parts.join(' | ');
}

// ============================================================
// EXPLAIN GOVERNOR DECISION
// ============================================================

/**
 * Generate a human-readable explanation of a Governor decision.
 * Used in the "Why Not Higher?" UI panel.
 */
export function explainGovernorDecision(recommendation) {
  const lines = [];

  lines.push(`RECOMMENDED STATE: ${recommendation.recommended_state}`);
  lines.push('');

  if (recommendation.why_not_higher) {
    lines.push('WHY NOT HIGHER:');
    lines.push(recommendation.why_not_higher);
    lines.push('');
  }

  if (recommendation.governor_overrides?.length > 0) {
    lines.push('GOVERNOR OVERRIDES:');
    for (const override of recommendation.governor_overrides) {
      lines.push(`  ${override.from} → ${override.to}: ${override.reason}`);
    }
    lines.push('');
  }

  if (recommendation.penalties_applied?.length > 0) {
    lines.push('PENALTIES APPLIED:');
    for (const p of recommendation.penalties_applied) {
      lines.push(`  [${p.id}] ${p.name} — ${p.reason}`);
    }
    lines.push('');
  }

  if (recommendation.freshness_warnings?.length > 0) {
    lines.push('FRESHNESS WARNINGS:');
    for (const w of recommendation.freshness_warnings) {
      lines.push(`  ⚠ ${w}`);
    }
    lines.push('');
  }

  if (recommendation.required_next_confirmations?.length > 0) {
    lines.push('WHAT WOULD INCREASE CONVICTION:');
    for (const c of recommendation.required_next_confirmations) {
      lines.push(`  → ${c}`);
    }
    lines.push('');
  }

  if (recommendation.required_user_actions?.length > 0) {
    lines.push('REQUIRED USER ACTIONS:');
    for (const a of recommendation.required_user_actions) {
      lines.push(`  • ${a}`);
    }
  }

  return lines.join('\n');
}
