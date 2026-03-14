// ============================================================
// EXECUTION GATES — Hard stop barriers before any action
// ============================================================
// These gates CANNOT be bypassed by a high composite score.
// A thesis with score 95 and no invalidation condition is STILL BLOCKED.
//
// Gates encode the behavioral contract:
// "I will not act on vibes, no matter how compelling the narrative."
// ============================================================

export const GATE_DEFINITIONS = [
  {
    id: 'invalidation_defined',
    name: 'Invalidation Condition Defined',
    description: 'A specific, observable condition that would prove the thesis wrong.',
    severity: 'hard', // hard = absolute block, soft = warning + penalty
    check: (thesis) => {
      const inv = thesis.invalidating_indicators || [];
      const hasInv = inv.length > 0 || (thesis.invalidation_condition && thesis.invalidation_condition.length > 10);
      return {
        passed: hasInv,
        reason: hasInv
          ? `${inv.length} invalidating indicators defined`
          : 'NO INVALIDATION CONDITION. You cannot act on a thesis you cannot prove wrong.',
      };
    },
  },
  {
    id: 'disconfirming_case',
    name: 'Disconfirming Case Written',
    description: 'You must articulate why the thesis could be wrong.',
    severity: 'hard',
    check: (thesis) => {
      const has = (thesis.disconfirming_evidence || []).length > 0;
      return {
        passed: has,
        reason: has
          ? `${thesis.disconfirming_evidence.length} disconfirming items`
          : 'NO DISCONFIRMING EVIDENCE. This is confirmation bias in action.',
      };
    },
  },
  {
    id: 'bear_case_written',
    name: 'Strongest Bear Case Written',
    description: 'What is the most compelling argument AGAINST your thesis?',
    severity: 'hard',
    check: (thesis) => {
      const has = thesis.strongest_bear_case && thesis.strongest_bear_case.length > 20;
      return {
        passed: has,
        reason: has
          ? 'Bear case documented'
          : 'BEAR CASE MISSING or too short. If you cannot articulate the bear case, you do not understand the trade.',
      };
    },
  },
  {
    id: 'time_horizon',
    name: 'Time Horizon Bounded',
    description: 'When should this play out? Unbounded theses are undisciplined.',
    severity: 'hard',
    check: (thesis) => {
      const tl = thesis.expected_timeline || {};
      const has = tl.end || tl.start;
      return {
        passed: !!has,
        reason: has
          ? `Timeline: ${tl.start || '?'} → ${tl.end || '?'}`
          : 'NO TIME HORIZON. "Eventually" is not a timeline.',
      };
    },
  },
  {
    id: 'max_risk_defined',
    name: 'Maximum Risk Defined',
    description: 'How much can you lose? No answer = no position.',
    severity: 'hard',
    check: (thesis, executionPlan) => {
      const has = executionPlan && (executionPlan.max_risk_dollars || executionPlan.max_risk_percent);
      return {
        passed: !!has,
        reason: has
          ? `Max risk: $${executionPlan.max_risk_dollars || '?'} / ${executionPlan.max_risk_percent || '?'}%`
          : 'NO RISK CAP DEFINED. This is the #1 way conviction kills accounts.',
      };
    },
  },
  {
    id: 'expression_vehicle',
    name: 'Expression Vehicle Defined',
    description: 'What specific instrument are you using?',
    severity: 'hard',
    check: (thesis, executionPlan) => {
      const has = executionPlan && executionPlan.expression_vehicle && executionPlan.expression_vehicle.length > 3;
      return {
        passed: !!has,
        reason: has
          ? `Vehicle: ${executionPlan.expression_vehicle}`
          : 'NO EXPRESSION VEHICLE. A thesis without a vehicle is an opinion, not a trade.',
      };
    },
  },
  {
    id: 'min_confirming_signals',
    name: 'Minimum Confirming Signals',
    description: 'At least 3 independent signals must support the thesis.',
    severity: 'soft',
    check: (thesis, _, signals) => {
      const linked = (signals || []).filter(s => s.thesis_id === thesis.id && s.status === 'linked');
      const passed = linked.length >= 3;
      return {
        passed,
        reason: passed
          ? `${linked.length} linked signals`
          : `Only ${linked.length} linked signals (minimum 3). Thin evidence = thin conviction.`,
      };
    },
  },
  {
    id: 'multi_source_evidence',
    name: 'Multi-Source Evidence',
    description: 'Evidence must come from more than one source type.',
    severity: 'soft',
    check: (thesis, _, signals) => {
      const linked = (signals || []).filter(s => s.thesis_id === thesis.id && s.status === 'linked');
      const sources = new Set(linked.map(s => s.source_type));
      const passed = sources.size >= 2;
      return {
        passed,
        reason: passed
          ? `${sources.size} distinct source types`
          : `Only ${sources.size} source type(s). Independent sources reduce confirmation bias.`,
      };
    },
  },
  {
    id: 'emotional_neutrality',
    name: 'Emotional Neutrality Check',
    description: 'Are you acting from process or from excitement?',
    severity: 'hard',
    check: (thesis, executionPlan, _, checklistAnswers) => {
      if (!checklistAnswers) return { passed: false, reason: 'Emotional state not assessed. Complete the checklist.' };
      const state = checklistAnswers.emotional_state;
      const dangerous = ['excited', 'fomo', 'revenge', 'bored'];
      const passed = state && !dangerous.includes(state);
      return {
        passed,
        reason: passed
          ? `Emotional state: ${state}`
          : `EMOTIONAL STATE: ${state || 'not assessed'}. Excited/FOMO/revenge/bored states BLOCK execution. Cool down first.`,
      };
    },
  },
  {
    id: 'sleep_on_it',
    name: 'Cooling-Off Period',
    description: 'Non-urgent theses require a minimum 12-hour delay.',
    severity: 'soft',
    check: (thesis) => {
      if (thesis.quarantine_until) {
        const until = new Date(thesis.quarantine_until);
        const now = new Date();
        if (now < until) {
          const hoursLeft = ((until - now) / (1000 * 3600)).toFixed(1);
          return { passed: false, reason: `COOLING OFF: ${hoursLeft} hours remaining. Forced delay to prevent impulsive action.` };
        }
        return { passed: true, reason: 'Cooling-off period completed.' };
      }
      // Check thesis age — at least 12 hours from creation
      const ageHours = (Date.now() - new Date(thesis.created_at).getTime()) / (1000 * 3600);
      const passed = ageHours >= 12;
      return {
        passed,
        reason: passed
          ? `Thesis age: ${ageHours.toFixed(1)} hours`
          : `Thesis only ${ageHours.toFixed(1)} hours old. Sleep on it. Urgency is usually an illusion.`,
      };
    },
  },
  {
    id: 'assumption_load',
    name: 'Assumption Load Check',
    description: 'Too many assumptions = too many ways to be wrong.',
    severity: 'soft',
    check: (thesis) => {
      const assumptions = thesis.key_assumptions || [];
      const passed = assumptions.length <= 5;
      return {
        passed,
        reason: passed
          ? `${assumptions.length} key assumptions (≤5 OK)`
          : `${assumptions.length} assumptions. Each is a failure point. Downgrade or reduce dependency chain.`,
      };
    },
  },
  {
    id: 'probability_honesty',
    name: 'Probability Range Honesty',
    description: 'Your range must be wide enough to reflect real uncertainty.',
    severity: 'soft',
    check: (thesis) => {
      const spread = (thesis.probability_high || 0) - (thesis.probability_low || 0);
      const passed = spread >= 0.15;
      return {
        passed,
        reason: passed
          ? `Probability range: ${thesis.probability_low}–${thesis.probability_high} (spread: ${(spread * 100).toFixed(0)}%)`
          : `Probability spread is only ${(spread * 100).toFixed(0)}%. A narrow range signals overconfidence. Widen to reflect honest uncertainty.`,
      };
    },
  },
  {
    id: 'would_take_if_not_mine',
    name: '"Would I take this if someone else brought it?"',
    description: 'Ownership bias check. Detach from the idea.',
    severity: 'soft',
    check: (thesis, _, __, checklistAnswers) => {
      if (!checklistAnswers) return { passed: false, reason: 'Not yet assessed.' };
      const answer = checklistAnswers.would_take_if_not_mine;
      return {
        passed: answer === true || answer === 'yes',
        reason: answer === true || answer === 'yes'
          ? 'Passed ownership bias check.'
          : 'OWNERSHIP BIAS: You would not take this idea if someone else brought it. That is a signal.',
      };
    },
  },
];

/**
 * Run all gates for a thesis.
 * @returns {{ passed: boolean, total: number, hardFails: Array, softFails: Array, results: Array }}
 */
export function runGates(thesis, executionPlan = null, signals = [], checklistAnswers = null) {
  const results = [];
  const hardFails = [];
  const softFails = [];

  for (const gate of GATE_DEFINITIONS) {
    const result = gate.check(thesis, executionPlan, signals, checklistAnswers);
    const entry = {
      id: gate.id,
      name: gate.name,
      severity: gate.severity,
      passed: result.passed,
      reason: result.reason,
    };
    results.push(entry);

    if (!result.passed) {
      if (gate.severity === 'hard') hardFails.push(entry);
      else softFails.push(entry);
    }
  }

  return {
    passed: hardFails.length === 0,
    total: results.length,
    totalPassed: results.filter(r => r.passed).length,
    totalFailed: results.filter(r => !r.passed).length,
    hardFails,
    softFails,
    results,
    summary: hardFails.length > 0
      ? `BLOCKED: ${hardFails.length} hard gate failure(s). No action permitted.`
      : softFails.length > 0
        ? `WARNING: ${softFails.length} soft gate failure(s). Proceed with caution and reduced sizing.`
        : 'All gates passed.',
  };
}
