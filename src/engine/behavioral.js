// ============================================================
// BEHAVIORAL STOPGAPS — Anti-self-sabotage mechanisms
// ============================================================
// These are NOT suggestions. These are enforced behavioral rules.
// They exist because the user profile includes known vulnerabilities:
// - narrative attachment
// - premature conviction
// - overconfidence
// - insufficient disconfirmation
// - conflating excitement with edge
//
// The system challenges the user. It does not flatter them.
// ============================================================

/**
 * PRE-TRADE CHECKLIST — Must be answered before any execution gate
 */
export const PRE_TRADE_CHECKLIST = [
  {
    id: 'opposite_case',
    question: 'Have you written out the OPPOSITE case in full?',
    type: 'boolean',
    required: true,
    failMessage: 'You cannot act without articulating why you might be wrong.',
    category: 'disconfirmation',
  },
  {
    id: 'invalidation_defined',
    question: 'What specific, observable condition would INVALIDATE this thesis?',
    type: 'text',
    required: true,
    minLength: 20,
    failMessage: 'If you cannot define invalidation, you cannot define risk.',
    category: 'risk',
  },
  {
    id: 'timing_bounded',
    question: 'Is the thesis timeline bounded with a specific review/exit date?',
    type: 'boolean',
    required: true,
    failMessage: '"Eventually" is not a timeline. Set a date.',
    category: 'discipline',
  },
  {
    id: 'real_mispricing',
    question: 'Is there MEASURABLE market mispricing, or is this just a dramatic narrative?',
    type: 'select',
    options: [
      { value: 'measurable', label: 'Yes — I can point to specific mispricing' },
      { value: 'probable', label: 'Probable — indirect evidence of mispricing' },
      { value: 'narrative_only', label: 'Honestly, this is more narrative than evidence' },
    ],
    required: true,
    failValues: ['narrative_only'],
    failMessage: 'STOP. "Dramatic" ≠ "mispriced." Interesting stories lose money all the time.',
    category: 'asymmetry',
  },
  {
    id: 'clean_vehicle',
    question: 'Do you have a clean, liquid, efficient expression vehicle?',
    type: 'boolean',
    required: true,
    failMessage: 'No clean vehicle = no trade. Forcing a bad vehicle ruins asymmetry.',
    category: 'execution',
  },
  {
    id: 'risk_capped',
    question: 'Is your maximum loss pre-defined and acceptable BEFORE the trade?',
    type: 'boolean',
    required: true,
    failMessage: 'Define your worst case before you enter. Not after.',
    category: 'risk',
  },
  {
    id: 'independent_signals',
    question: 'How many INDEPENDENT confirming signals support this thesis?',
    type: 'number',
    required: true,
    min: 0,
    max: 20,
    warningThreshold: 3,
    warningMessage: 'Fewer than 3 independent signals. Thin evidence = thin conviction.',
    category: 'evidence',
  },
  {
    id: 'data_fresh',
    question: 'Is your supporting data fresh (< 24 hours for market data, < 48 hours for macro)?',
    type: 'boolean',
    required: true,
    failMessage: 'Stale data may mean the market has already moved. Refresh before acting.',
    category: 'evidence',
  },
  {
    id: 'process_not_excitement',
    question: 'Am I acting from disciplined process, or because this feels exciting?',
    type: 'select',
    options: [
      { value: 'process', label: 'Process — this is a systematic decision' },
      { value: 'mostly_process', label: 'Mostly process, some excitement' },
      { value: 'excitement', label: 'Honestly, this is exciting and I want to act' },
    ],
    required: true,
    failValues: ['excitement'],
    warnValues: ['mostly_process'],
    failMessage: 'QUARANTINE THIS. Excitement is not edge. Come back tomorrow.',
    warnMessage: 'Notice the excitement. Reduce position size by 50% as a guardrail.',
    category: 'behavioral',
  },
  {
    id: 'would_take_if_not_mine',
    question: 'Would you take this trade if someone ELSE brought it to you?',
    type: 'boolean',
    required: true,
    failMessage: 'OWNERSHIP BIAS. You are attached to THIS idea, not its quality. Step back.',
    category: 'behavioral',
  },
  {
    id: 'early_vs_right',
    question: 'What evidence would distinguish being EARLY from being WRONG?',
    type: 'text',
    required: true,
    minLength: 20,
    failMessage: '"Being early" is the most common excuse for being wrong. Define the difference.',
    category: 'disconfirmation',
  },
  {
    id: 'emotional_state',
    question: 'What is your current emotional state?',
    type: 'select',
    options: [
      { value: 'calm', label: 'Calm and clear-headed' },
      { value: 'focused', label: 'Focused and analytical' },
      { value: 'excited', label: 'Excited about this opportunity' },
      { value: 'anxious', label: 'Anxious about missing it' },
      { value: 'fearful', label: 'Fearful of loss' },
      { value: 'revenge', label: 'Trying to recover from a prior loss' },
      { value: 'fomo', label: 'Fear of missing out' },
      { value: 'bored', label: 'Bored and looking for action' },
    ],
    required: true,
    failValues: ['excited', 'revenge', 'fomo', 'bored'],
    warnValues: ['anxious'],
    failMessage: 'Your emotional state DISQUALIFIES action right now. Quarantine and revisit in 12+ hours.',
    warnMessage: 'Anxiety clouds judgment. Reduce position size and set tighter stops.',
    category: 'behavioral',
  },
];

/**
 * Run the pre-trade checklist against answers.
 * @param {Object} answers - { opposite_case: true, invalidation_defined: "...", ... }
 * @returns {{ passed: boolean, score: number, items: Array, blocks: Array, warnings: Array }}
 */
export function runChecklist(answers) {
  const items = [];
  const blocks = [];
  const warnings = [];
  let passedCount = 0;

  for (const item of PRE_TRADE_CHECKLIST) {
    const answer = answers[item.id];
    let status = 'pending';
    let message = null;

    if (answer === undefined || answer === null || answer === '') {
      status = 'unanswered';
      message = `Required: ${item.question}`;
      blocks.push({ id: item.id, message });
    } else if (item.type === 'boolean') {
      if (answer === true || answer === 'yes') {
        status = 'passed';
        passedCount++;
      } else {
        status = 'failed';
        message = item.failMessage;
        blocks.push({ id: item.id, message });
      }
    } else if (item.type === 'text') {
      if (typeof answer === 'string' && answer.length >= (item.minLength || 1)) {
        status = 'passed';
        passedCount++;
      } else {
        status = 'failed';
        message = item.failMessage;
        blocks.push({ id: item.id, message });
      }
    } else if (item.type === 'number') {
      const num = Number(answer);
      if (item.warningThreshold && num < item.warningThreshold) {
        status = 'warning';
        message = item.warningMessage;
        warnings.push({ id: item.id, message });
        passedCount++; // warnings don't block
      } else {
        status = 'passed';
        passedCount++;
      }
    } else if (item.type === 'select') {
      if (item.failValues && item.failValues.includes(answer)) {
        status = 'failed';
        message = item.failMessage;
        blocks.push({ id: item.id, message });
      } else if (item.warnValues && item.warnValues.includes(answer)) {
        status = 'warning';
        message = item.warnMessage;
        warnings.push({ id: item.id, message });
        passedCount++;
      } else {
        status = 'passed';
        passedCount++;
      }
    }

    items.push({
      id: item.id,
      question: item.question,
      category: item.category,
      answer,
      status,
      message,
    });
  }

  const total = PRE_TRADE_CHECKLIST.length;
  const score = Math.round((passedCount / total) * 100);

  return {
    passed: blocks.length === 0,
    score,
    total,
    passedCount,
    items,
    blocks,
    warnings,
    summary: blocks.length > 0
      ? `BLOCKED: ${blocks.length} checklist item(s) failed. Address these before proceeding.`
      : warnings.length > 0
        ? `CAUTION: ${warnings.length} warning(s). Proceed with reduced conviction and position size.`
        : 'All checklist items passed. You may proceed with discipline.',
  };
}

/**
 * BEHAVIORAL CHALLENGE PROMPTS — These appear during thesis creation and review.
 * Not gates, but friction-generators that force slower thinking.
 */
export const BEHAVIORAL_PROMPTS = {
  thesis_creation: [
    'Is this actually mispriced, or merely dramatic?',
    'What is the most boring explanation for what you are seeing?',
    'If this were a consensus view, would you still find it compelling?',
    'How many assumptions must be true simultaneously for this to work?',
  ],
  pre_action: [
    'What evidence would prove you are early, not right?',
    'If you had no position and saw this setup fresh, would you act?',
    'Are you sizing this based on evidence quality or on how much you believe the story?',
    'Would a disciplined risk manager approve this trade plan?',
  ],
  post_action: [
    'Did you follow your process, or did you improvise?',
    'Which signals actually mattered and which were noise?',
    'Were you right for the right reasons?',
    'What should change in your system based on this outcome?',
  ],
};

/**
 * POSITION SIZING RULES — Evidence-quality-linked size caps.
 * Prevents oversizing based on conviction when evidence is thin.
 */
export const POSITION_SIZING_RULES = {
  // classification → max percentage of risk capital
  FULLY_QUALIFIED: { maxRiskPercent: 5, description: 'Full evidence, full process. Up to 5% risk.' },
  SMALL_POSITION:  { maxRiskPercent: 2, description: 'Strong but not complete. Cap at 2% risk.' },
  PAPER_TRADE:     { maxRiskPercent: 0, description: 'Paper trade only. No real capital.' },
  DEVELOP:         { maxRiskPercent: 0, description: 'Still developing. No capital at risk.' },
  WATCH:           { maxRiskPercent: 0, description: 'Watch only. Not actionable.' },
  IGNORE:          { maxRiskPercent: 0, description: 'Noise. Move on.' },
  QUARANTINED:     { maxRiskPercent: 0, description: 'Quarantined. Absolutely no action.' },
};

/**
 * Get the maximum allowed position size for a classification.
 */
export function getMaxPositionSize(classification, riskCapital) {
  const rule = POSITION_SIZING_RULES[classification];
  if (!rule) return { maxDollars: 0, maxPercent: 0, description: 'Unknown classification' };
  return {
    maxDollars: Math.round(riskCapital * (rule.maxRiskPercent / 100)),
    maxPercent: rule.maxRiskPercent,
    description: rule.description,
  };
}
