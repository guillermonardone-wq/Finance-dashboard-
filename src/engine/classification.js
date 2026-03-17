// ============================================================
// CLASSIFICATION ENGINE — Maps scores + gates to action states
// ============================================================
// Classification is the final output of the decision engine.
// It determines what you are ALLOWED to do with a thesis.
//
// Three-layer scoring model:
//   Evidence (40%) + Structure (35%) + Market Edge (25%) = Composite
//
// Critical design: FORCED DOWNGRADES override score totals.
// A brilliant thesis with poor risk containment CANNOT be fully qualified.
// Layer-level minimums also enforce quality floors.
// ============================================================

export const CLASSIFICATIONS = {
  IGNORE: { label: "IGNORE", color: "slate", minScore: 0, maxScore: 34 },
  WATCH: { label: "WATCH", color: "blue", minScore: 35, maxScore: 49 },
  DEVELOP: {
    label: "DEVELOP THESIS",
    color: "amber",
    minScore: 50,
    maxScore: 64,
  },
  PAPER_TRADE: {
    label: "PAPER TRADE",
    color: "purple",
    minScore: 65,
    maxScore: 74,
  },
  SMALL_POSITION: {
    label: "SMALL POSITION",
    color: "cyan",
    minScore: 75,
    maxScore: 84,
  },
  FULLY_QUALIFIED: {
    label: "FULLY QUALIFIED",
    color: "emerald",
    minScore: 85,
    maxScore: 100,
  },
  QUARANTINED: {
    label: "QUARANTINED",
    color: "red",
    minScore: null,
    maxScore: null,
  },
};

/**
 * Forced downgrades — factor-level caps that override composite score.
 * Updated for three-layer model.
 */
const FORCED_DOWNGRADES = [
  // Evidence layer
  {
    factor: "signal_quality",
    threshold: 3,
    maxClassification: "WATCH",
    reason:
      "Very low signal quality caps at WATCH. The inputs are too unreliable for further action.",
  },
  {
    factor: "signal_independence",
    threshold: 3,
    maxClassification: "WATCH",
    reason:
      "Signal independence too low. All evidence may be from the same source. Diversify before acting.",
  },
  {
    factor: "evidence_freshness",
    threshold: 3,
    maxClassification: "DEVELOP",
    reason:
      "Stale evidence caps at DEVELOP. Your data may not reflect current reality.",
  },
  // Structure layer
  {
    factor: "causal_chain_clarity",
    threshold: 3,
    maxClassification: "WATCH",
    reason:
      "Causal chain unclear. You cannot act on a thesis you cannot explain step-by-step.",
  },
  {
    factor: "counter_case_robustness",
    threshold: 4,
    maxClassification: "DEVELOP",
    reason:
      "Weak counter-case caps at DEVELOP. You have not done the work to prove yourself wrong.",
  },
  {
    factor: "timing_clarity",
    threshold: 4,
    maxClassification: "WATCH",
    reason:
      "Poor timing clarity caps at WATCH. A good idea with no timing is not tradable.",
  },
  {
    factor: "assumption_load",
    threshold: 3,
    maxClassification: "DEVELOP",
    reason:
      "Too many assumptions. Each is a failure mode. Simplify the thesis.",
  },
  // Market Edge layer
  {
    factor: "catalyst_clarity",
    threshold: 3,
    maxClassification: "DEVELOP",
    reason: "No clear catalyst. Without a trigger, timing is guesswork.",
  },
];

/**
 * Layer-level minimum scores. If any layer is below its floor,
 * classification is capped regardless of composite.
 */
const LAYER_MINIMUMS = [
  {
    layer: "evidence",
    threshold: 3,
    maxClassification: "WATCH",
    reason:
      "Evidence layer score too low. You need better data before proceeding.",
  },
  {
    layer: "structure",
    threshold: 3,
    maxClassification: "WATCH",
    reason: "Structural logic too weak. The thesis reasoning needs more work.",
  },
  {
    layer: "evidence",
    threshold: 5,
    maxClassification: "DEVELOP",
    reason: "Evidence layer below threshold for action. Keep gathering data.",
  },
  {
    layer: "structure",
    threshold: 5,
    maxClassification: "DEVELOP",
    reason:
      "Structural logic below threshold for action. Strengthen the reasoning.",
  },
];

/**
 * Assumption overload rule
 */
function checkAssumptionOverload(thesis) {
  const assumptions = thesis.key_assumptions || [];
  if (assumptions.length > 7) {
    return {
      capped: true,
      maxClassification: "WATCH",
      reason: `${assumptions.length} assumptions. Each is a failure mode. Simplify the thesis.`,
    };
  }
  if (assumptions.length > 5) {
    return {
      capped: true,
      maxClassification: "DEVELOP",
      reason: `${assumptions.length} assumptions. High dependency chain limits classification.`,
    };
  }
  return { capped: false };
}

const CLASSIFICATION_ORDER = [
  "IGNORE",
  "WATCH",
  "DEVELOP",
  "PAPER_TRADE",
  "SMALL_POSITION",
  "FULLY_QUALIFIED",
];

function classificationIndex(c) {
  return CLASSIFICATION_ORDER.indexOf(c);
}

function lowerClassification(a, b) {
  return classificationIndex(a) <= classificationIndex(b) ? a : b;
}

/**
 * Classify a thesis based on composite score, factor scores, layer scores, and gates.
 *
 * @param {number} compositeScore - 0-100
 * @param {Object} factorScores - { signal_quality: 7, timing_clarity: 5, ... }
 * @param {Object} gateResult - from runGates()
 * @param {Object} thesis - full thesis object
 * @param {Object} layerScores - { evidence: { score }, structure: { score }, market_edge: { score } }
 * @returns {{ classification, scoreClassification, composite, reasons, downgrades, overrideActive, meta }}
 */
export function classifyThesis(
  compositeScore,
  factorScores,
  gateResult,
  thesis,
  layerScores = null,
) {
  const reasons = [];
  const downgrades = [];
  let effectiveClassification = null;

  // Step 1: Score-based classification
  if (compositeScore >= 85) effectiveClassification = "FULLY_QUALIFIED";
  else if (compositeScore >= 75) effectiveClassification = "SMALL_POSITION";
  else if (compositeScore >= 65) effectiveClassification = "PAPER_TRADE";
  else if (compositeScore >= 50) effectiveClassification = "DEVELOP";
  else if (compositeScore >= 35) effectiveClassification = "WATCH";
  else effectiveClassification = "IGNORE";

  const scoreClassification = effectiveClassification;
  reasons.push(
    `Score-based: ${scoreClassification} (composite: ${compositeScore})`,
  );

  // Step 2: Hard gate failures
  if (gateResult && !gateResult.passed) {
    if (
      classificationIndex(effectiveClassification) >
      classificationIndex("DEVELOP")
    ) {
      effectiveClassification = "DEVELOP";
      downgrades.push({
        from: scoreClassification,
        to: "DEVELOP",
        reason: `Hard gate failures: ${gateResult.hardFails.map((f) => f.name).join(", ")}`,
      });
    }
  }

  // Step 3: Layer-level minimums
  if (layerScores) {
    for (const rule of LAYER_MINIMUMS) {
      const layerData = layerScores[rule.layer];
      if (
        layerData &&
        layerData.score != null &&
        layerData.score < rule.threshold
      ) {
        const target = rule.maxClassification;
        if (
          classificationIndex(effectiveClassification) >
          classificationIndex(target)
        ) {
          const previous = effectiveClassification;
          effectiveClassification = lowerClassification(
            effectiveClassification,
            target,
          );
          if (previous !== effectiveClassification) {
            downgrades.push({
              from: previous,
              to: effectiveClassification,
              layer: rule.layer,
              score: layerData.score,
              threshold: rule.threshold,
              reason: rule.reason,
            });
          }
        }
      }
    }
  }

  // Step 4: Forced downgrades based on individual factor scores
  for (const rule of FORCED_DOWNGRADES) {
    const score = factorScores[rule.factor];
    if (score != null && score < rule.threshold) {
      const target = rule.maxClassification;
      if (
        target === "QUARANTINED" ||
        classificationIndex(effectiveClassification) >
          classificationIndex(target)
      ) {
        const previous = effectiveClassification;
        effectiveClassification =
          target === "QUARANTINED"
            ? "QUARANTINED"
            : lowerClassification(effectiveClassification, target);
        if (previous !== effectiveClassification) {
          downgrades.push({
            from: previous,
            to: effectiveClassification,
            factor: rule.factor,
            score,
            threshold: rule.threshold,
            reason: rule.reason,
          });
        }
      }
    }
  }

  // Step 5: Assumption overload check
  const assumptionCheck = checkAssumptionOverload(thesis);
  if (assumptionCheck.capped) {
    const target = assumptionCheck.maxClassification;
    if (
      classificationIndex(effectiveClassification) > classificationIndex(target)
    ) {
      downgrades.push({
        from: effectiveClassification,
        to: target,
        reason: assumptionCheck.reason,
      });
      effectiveClassification = target;
    }
  }

  // Step 6: Soft gate penalty — downgrade by one level for each 2 soft failures
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

  // Step 7: Penalty-driven downgrade — if total penalties > 15, cap at DEVELOP
  // This catches heavily penalized theses that might still have decent raw scores
  if (factorScores._penaltyTotal != null && factorScores._penaltyTotal > 15) {
    if (
      classificationIndex(effectiveClassification) >
      classificationIndex("DEVELOP")
    ) {
      downgrades.push({
        from: effectiveClassification,
        to: "DEVELOP",
        reason: `High penalty total (${factorScores._penaltyTotal}) limits classification. Address penalties before acting.`,
      });
      effectiveClassification = "DEVELOP";
    }
  }

  return {
    classification: effectiveClassification,
    scoreClassification,
    composite: compositeScore,
    reasons,
    downgrades,
    overrideActive: downgrades.length > 0,
    meta:
      effectiveClassification === "QUARANTINED"
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
    lines.push("");
    lines.push("FORCED DOWNGRADES ACTIVE:");
    lines.push(`Score alone would classify as: ${result.scoreClassification}`);
    for (const d of result.downgrades) {
      lines.push(`  ${d.from} → ${d.to}: ${d.reason}`);
    }
  }

  if (result.classification === "QUARANTINED") {
    lines.push("");
    lines.push("THIS THESIS IS QUARANTINED.");
    lines.push(
      "You are in a compromised decision state. Do not act. Review after cooling off.",
    );
  }

  return lines.join("\n");
}
