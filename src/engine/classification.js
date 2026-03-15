// ============================================================
// CLASSIFICATION ENGINE — Maps scores + gates to action states
// ============================================================
// Classification is the final output of the decision engine.
// It determines what you are ALLOWED to do with a thesis.
//
// Critical design: FORCED DOWNGRADES override score totals.
// A brilliant thesis with poor risk containment CANNOT be fully qualified.
// This is the system protecting you from yourself.
// ============================================================

export const CLASSIFICATIONS = {
  IGNORE:             { label: 'IGNORE',              color: 'slate',   minScore: 0,   maxScore: 34 },
  WATCH:              { label: 'WATCH',               color: 'blue',    minScore: 35,  maxScore: 49 },
  DEVELOP:            { label: 'DEVELOP THESIS',      color: 'amber',   minScore: 50,  maxScore: 64 },
  PAPER_TRADE:        { label: 'PAPER TRADE',         color: 'purple',  minScore: 65,  maxScore: 74 },
  SMALL_POSITION:     { label: 'SMALL POSITION',      color: 'cyan',    minScore: 75,  maxScore: 84 },
  FULLY_QUALIFIED:    { label: 'FULLY QUALIFIED',     color: 'emerald', minScore: 85,  maxScore: 100 },
  QUARANTINED:        { label: 'QUARANTINED',         color: 'red',     minScore: null, maxScore: null },
};

/**
 * Forced downgrades — dimension-level caps that override composite score.
 * Each rule: if dimension score < threshold, cap at max classification.
 */
const FORCED_DOWNGRADES = [
  {
    dimension: 'timing_precision',
    threshold: 4,
    maxClassification: 'WATCH',
    reason: 'Poor timing precision caps at WATCH. A good idea with no timing is not tradable.',
  },
  {
    dimension: 'disconfirmation_robustness',
    threshold: 4,
    maxClassification: 'DEVELOP',
    reason: 'Weak disconfirmation caps at DEVELOP. You have not done the work to prove yourself wrong.',
  },
  {
    dimension: 'risk_containment',
    threshold: 5,
    maxClassification: 'PAPER_TRADE',
    reason: 'Poor risk containment caps at PAPER TRADE. Real money requires real risk rules.',
  },
  {
    dimension: 'emotional_neutrality',
    threshold: 4,
    maxClassification: 'QUARANTINED',
    reason: 'Low emotional neutrality forces QUARANTINE. You are making this decision from a compromised state.',
  },
  {
    dimension: 'data_freshness',
    threshold: 4,
    maxClassification: 'DEVELOP',
    reason: 'Stale data caps at DEVELOP. Your evidence base may not reflect current reality.',
  },
  {
    dimension: 'signal_quality',
    threshold: 3,
    maxClassification: 'WATCH',
    reason: 'Very low signal quality caps at WATCH. The inputs are too unreliable for further action.',
  },
];

/**
 * Assumption overload rule: if key_assumptions > 5, cap at WATCH.
 */
function checkAssumptionOverload(thesis) {
  const assumptions = thesis.key_assumptions || [];
  if (assumptions.length > 7) {
    return { capped: true, maxClassification: 'WATCH', reason: `${assumptions.length} assumptions. Each is a failure mode. Simplify the thesis.` };
  }
  if (assumptions.length > 5) {
    return { capped: true, maxClassification: 'DEVELOP', reason: `${assumptions.length} assumptions. High dependency chain limits classification.` };
  }
  return { capped: false };
}

const CLASSIFICATION_ORDER = [
  'IGNORE', 'WATCH', 'DEVELOP', 'PAPER_TRADE', 'SMALL_POSITION', 'FULLY_QUALIFIED',
];

function classificationIndex(c) {
  return CLASSIFICATION_ORDER.indexOf(c);
}

function lowerClassification(a, b) {
  return classificationIndex(a) <= classificationIndex(b) ? a : b;
}

/**
 * Classify a thesis based on composite score, dimension scores, and gates.
 *
 * @param {number} compositeScore - 0-100
 * @param {Object} dimensionScores - { timing_precision: 5, ... }
 * @param {Object} gateResult - from runGates()
 * @param {Object} thesis - full thesis object
 * @returns {{ classification: string, reasons: string[], downgrades: Object[], overrideActive: boolean }}
 */
export function classifyThesis(compositeScore, dimensionScores, gateResult, thesis) {
  const reasons = [];
  const downgrades = [];
  let effectiveClassification = null;

  // Step 1: Score-based classification
  if (compositeScore >= 85) effectiveClassification = 'FULLY_QUALIFIED';
  else if (compositeScore >= 75) effectiveClassification = 'SMALL_POSITION';
  else if (compositeScore >= 65) effectiveClassification = 'PAPER_TRADE';
  else if (compositeScore >= 50) effectiveClassification = 'DEVELOP';
  else if (compositeScore >= 35) effectiveClassification = 'WATCH';
  else effectiveClassification = 'IGNORE';

  const scoreClassification = effectiveClassification;
  reasons.push(`Score-based: ${scoreClassification} (composite: ${compositeScore})`);

  // Step 2: Hard gate failures
  if (gateResult && !gateResult.passed) {
    // Hard gate failures cap at DEVELOP (you can think about it, but not act)
    if (classificationIndex(effectiveClassification) > classificationIndex('DEVELOP')) {
      effectiveClassification = 'DEVELOP';
      downgrades.push({
        from: scoreClassification,
        to: 'DEVELOP',
        reason: `Hard gate failures: ${gateResult.hardFails.map(f => f.name).join(', ')}`,
      });
    }
  }

  // Step 3: Forced downgrades based on dimension scores
  for (const rule of FORCED_DOWNGRADES) {
    const score = dimensionScores[rule.dimension];
    if (score != null && score < rule.threshold) {
      const target = rule.maxClassification;
      if (target === 'QUARANTINED' || classificationIndex(effectiveClassification) > classificationIndex(target)) {
        const previous = effectiveClassification;
        effectiveClassification = target === 'QUARANTINED' ? 'QUARANTINED' : lowerClassification(effectiveClassification, target);
        if (previous !== effectiveClassification) {
          downgrades.push({
            from: previous,
            to: effectiveClassification,
            dimension: rule.dimension,
            score,
            threshold: rule.threshold,
            reason: rule.reason,
          });
        }
      }
    }
  }

  // Step 4: Assumption overload check
  const assumptionCheck = checkAssumptionOverload(thesis);
  if (assumptionCheck.capped) {
    const target = assumptionCheck.maxClassification;
    if (classificationIndex(effectiveClassification) > classificationIndex(target)) {
      downgrades.push({
        from: effectiveClassification,
        to: target,
        reason: assumptionCheck.reason,
      });
      effectiveClassification = target;
    }
  }

  // Step 5: Soft gate penalty — downgrade by one level for each 2 soft failures
  if (gateResult && gateResult.softFails.length >= 2) {
    const levels = Math.floor(gateResult.softFails.length / 2);
    const idx = classificationIndex(effectiveClassification);
    const newIdx = Math.max(0, idx - levels);
    const newClass = CLASSIFICATION_ORDER[newIdx];
    if (newClass !== effectiveClassification) {
      downgrades.push({
        from: effectiveClassification,
        to: newClass,
        reason: `${gateResult.softFails.length} soft gate failures → downgrade ${levels} level(s)`,
      });
      effectiveClassification = newClass;
    }
  }

  return {
    classification: effectiveClassification,
    scoreClassification, // what score alone would say
    composite: compositeScore,
    reasons,
    downgrades,
    overrideActive: downgrades.length > 0,
    meta: effectiveClassification === 'QUARANTINED'
      ? CLASSIFICATIONS.QUARANTINED
      : CLASSIFICATIONS[effectiveClassification] || CLASSIFICATIONS.IGNORE,
  };
}

/**
 * Generate a human-readable classification explanation.
 */
export function explainClassification(result) {
  const lines = [];
  lines.push(`CLASSIFICATION: ${result.classification}`);
  lines.push(`Composite Score: ${result.composite}/100`);

  if (result.overrideActive) {
    lines.push('');
    lines.push('⚠ FORCED DOWNGRADES ACTIVE:');
    lines.push(`Score alone would classify as: ${result.scoreClassification}`);
    for (const d of result.downgrades) {
      lines.push(`  ${d.from} → ${d.to}: ${d.reason}`);
    }
  }

  if (result.classification === 'QUARANTINED') {
    lines.push('');
    lines.push('THIS THESIS IS QUARANTINED.');
    lines.push('You are in a compromised decision state. Do not act. Review after cooling off.');
  }

  return lines.join('\n');
}
