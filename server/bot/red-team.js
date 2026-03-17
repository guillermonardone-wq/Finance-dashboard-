// ============================================================
// RED-TEAM PROSECUTOR — Generates strongest opposing case
// ============================================================
// This agent's job is to argue AGAINST the cluster interpretation.
// It must produce genuine, non-strawman objections.
//
// Rules:
// - Must not write weak or token objections
// - Must not simply negate the thesis
// - Must identify practical falsification paths
// - Must call out circular evidence chains
// - Must explain why user might be early rather than right
// ============================================================

import { validateCounterCase } from "./types.js";

// Common counter-arguments by category
const COUNTER_TEMPLATES = {
  geopolitical_escalation: {
    opposing_cases: [
      "Brinksmanship is the norm. Escalatory rhetoric rarely translates to operational action.",
      "Both sides have strong economic incentives to avoid full confrontation.",
      "Back-channel diplomacy often resolves tensions before they become visible to markets.",
      "Media amplification makes the situation appear more severe than operational reality suggests.",
    ],
    false_positive_paths: [
      "Routine posturing misread as genuine escalation",
      "Domestic political signaling intended for internal audience, not adversary",
      "Diplomatic resolution already in progress behind the scenes",
      "Third-party mediation prevents escalation",
    ],
    evidence_gaps: [
      "Is there operational follow-through beyond rhetoric?",
      "Are civilian/economic preparations visible (evacuation, reserves)?",
      "Is intelligence community assessment aligned with public narrative?",
      "Are allies responding with coordinated action or dismissal?",
    ],
  },
  military_mobilization: {
    opposing_cases: [
      "Military exercises are routine and should not be conflated with mobilization.",
      "Repositioning may be defensive or deterrent, not offensive preparation.",
      "Intelligence assessments often lag operational decisions.",
      "Public mobilization signals may be intended as deterrence, not operational planning.",
    ],
    false_positive_paths: [
      "Scheduled rotation/exercise misidentified as mobilization",
      "Defensive repositioning in response to other party's moves",
      "Deterrent signaling that achieves its objective and de-escalates",
    ],
    evidence_gaps: [
      "Is this above baseline activity levels?",
      "Are logistics (fuel, munitions, medical) being staged beyond normal?",
      "Are reserve units being called up?",
    ],
  },
  energy_bottleneck: {
    opposing_cases: [
      "Spare capacity exists to offset disruptions.",
      "Strategic petroleum reserves can buffer short-term supply shocks.",
      "Energy infrastructure is more resilient than dramatic narratives suggest.",
      "Previous supply disruptions have consistently been shorter and less severe than feared.",
    ],
    false_positive_paths: [
      "Transient disruption that resolves within days",
      "Alternate routing absorbs the impact with modest cost increase",
      "Diplomatic resolution prevents actual flow disruption",
    ],
    evidence_gaps: [
      "What is actual spare capacity vs. stated capacity?",
      "How quickly can alternative routes absorb redirected volume?",
      "Is this disruption to flow or merely to insurance costs?",
    ],
  },
  sanctions_risk: {
    opposing_cases: [
      "Sanctions are frequently announced with extensive carve-outs that reduce actual impact.",
      "Enforcement mechanisms are often weaker than the sanctions text implies.",
      "Target countries have proven adept at finding workarounds.",
      "Secondary sanctions are politically costly and may not materialize.",
    ],
    false_positive_paths: [
      "Sanctions announced but implementation delayed",
      "Carve-outs for critical commodities reduce actual supply impact",
      "Target country pre-positioned alternative trade channels",
    ],
    evidence_gaps: [
      "What is the actual text vs. leaked draft vs. speculation?",
      "Are enforcement mechanisms specified?",
      "What are the carve-outs and transition periods?",
    ],
  },
  central_bank_action: {
    opposing_cases: [
      "Central banks almost always move more slowly than hawks expect.",
      "Institutional inertia and consensus-building slow policy shifts.",
      "Data dependency means a single print rarely changes the trajectory.",
      "Forward guidance exists precisely to prevent surprises.",
    ],
    false_positive_paths: [
      "Hawkish rhetoric intended to jawbone markets without policy change",
      "Next data release reverses the trend",
      "Global conditions shift, removing the impetus for action",
    ],
    evidence_gaps: [
      "Are meeting minutes showing actual internal dissent, or just one dissenter?",
      "Is the data trend sustained (3+ months) or just one outlier?",
      "Has the central bank's preferred measure moved, or just headline?",
    ],
  },
  market_complacency: {
    opposing_cases: [
      'Markets being "complacent" has been the wrong call far more often than the right one.',
      "Low volatility may reflect genuine reduction in uncertainty, not ignorance.",
      "The market may be correctly pricing the event as low-probability.",
      '"The market is wrong" is the most common incorrect contrarian claim.',
    ],
    false_positive_paths: [
      "Market is correctly pricing the base case, you are overweighting the tail",
      "Volatility is low because hedging flows are efficient, not because risk is ignored",
      "Other market participants have the same information and a different assessment",
    ],
    evidence_gaps: [
      "Is implied vol genuinely low vs. historical context for this type of event?",
      "Are positioning data confirming complacency or showing hedging?",
      "Is there a specific catalyst that would reprice risk?",
    ],
  },
};

// Default template for uncovered categories
const DEFAULT_COUNTER = {
  opposing_cases: [
    "Events of this type are more common than dramatic narratives suggest. Most do not lead to sustained market impact.",
    "The base case remains unchanged until evidence proves otherwise.",
    "Historical pattern: initial alarm → media amplification → gradual resolution → market recovery.",
  ],
  false_positive_paths: [
    "Media cycle amplifies then moves on",
    "Event resolves without the feared second-order effects",
    "Market has already discounted this scenario",
  ],
  evidence_gaps: [
    "Is there operational follow-through beyond announcements?",
    "Are affected parties actually changing behavior?",
    "Is there market confirmation of the feared scenario?",
  ],
};

/**
 * Generate red-team counter case for a signal cluster.
 * @param {Object} cluster - Validated SignalCluster
 * @param {Object|null} patternMatch - PatternMatch if available
 * @param {Object|null} mispricingAssessment - MispricingAssessment if available
 * @returns {Object} Validated CounterCase
 */
export function generateCounterCase(
  cluster,
  patternMatch = null,
  mispricingAssessment = null,
) {
  const primaryCategory = (cluster.categories || [])[0] || "other";
  const template = COUNTER_TEMPLATES[primaryCategory] || DEFAULT_COUNTER;

  // Build strongest opposing case
  const opposingParts = [];

  // Category-specific objections
  opposingParts.push(...template.opposing_cases.slice(0, 2));

  // Pattern-specific objections
  if (patternMatch) {
    const fpCount = (patternMatch.common_false_positives || []).length;
    if (fpCount > 0) {
      opposingParts.push(
        `This pattern (${patternMatch.pattern_name}) has ${fpCount} known false positive paths: ${patternMatch.common_false_positives.slice(0, 2).join("; ")}.`,
      );
    }
    const missingCount = (patternMatch.missing_confirmations || []).length;
    if (missingCount > 2) {
      opposingParts.push(
        `${missingCount} expected confirmations are still missing. The pattern is incomplete.`,
      );
    }
  }

  // Market pricing objection
  if (mispricingAssessment) {
    const state = mispricingAssessment.market_reaction_state;
    if (state === "fully_repriced" || state === "partial_repricing") {
      opposingParts.push(
        `Market has already ${state === "fully_repriced" ? "fully" : "partially"} repriced this scenario. The asymmetry may be gone.`,
      );
    }
    if (state === "no_reaction") {
      opposingParts.push(
        "Market has not reacted. This could mean mispricing — or it could mean the market correctly assesses this as low-probability. Do not assume the market is wrong without strong evidence.",
      );
    }
  }

  // Cluster weakness objections
  if (cluster.duplicate_penalty_applied) {
    opposingParts.push(
      "Cluster volume is inflated by duplicate coverage. Multiple articles about the same event are not independent confirmation.",
    );
  }
  if ((cluster.independent_source_count || 0) < 3) {
    opposingParts.push(
      `Only ${cluster.independent_source_count || 0} independent source(s). Thin evidence base. Confirmation from additional independent channels is needed.`,
    );
  }

  const strongest_opposing_case = opposingParts.join(" ");

  // Alternative explanations
  const alternative_explanations = [
    "The event may be routine/cyclical rather than a genuine shift.",
    "Media coverage may be amplifying significance beyond operational reality.",
    ...template.opposing_cases.slice(2),
  ];

  // Evidence gaps
  const evidence_gaps = [
    ...template.evidence_gaps,
    ...(patternMatch?.missing_confirmations?.slice(0, 3) || []),
  ];

  // False positive paths
  const likely_false_positive_paths = [
    ...template.false_positive_paths,
    ...(patternMatch?.common_false_positives?.slice(0, 2) || []),
  ];

  // Invalidation triggers
  const invalidation_triggers = [
    "Diplomatic resolution announced",
    "Key actors de-escalate publicly",
    "Market begins pricing the scenario (reducing asymmetry)",
    "Alternative data contradicts the thesis",
  ];

  // Check for circular logic
  const circular =
    (cluster.independent_source_count || 0) <= 1 &&
    (cluster.signal_count || 0) > 2;

  // Reasoning quality score: how strong is this counter case?
  let quality = 5; // base
  if (template !== DEFAULT_COUNTER) quality += 1; // category-specific
  if (patternMatch?.common_false_positives?.length > 2) quality += 1;
  if (mispricingAssessment?.market_reaction_state === "fully_repriced")
    quality += 1;
  if (circular) quality += 1;
  if ((cluster.independent_source_count || 0) < 2) quality += 1;
  quality = Math.min(10, quality);

  const validated = validateCounterCase({
    cluster_id: cluster.id,
    strongest_opposing_case,
    alternative_explanations,
    pricing_already_reflects_story:
      mispricingAssessment?.market_reaction_state === "fully_repriced" ||
      mispricingAssessment?.market_reaction_state === "partial_repricing",
    evidence_gaps,
    likely_false_positive_paths,
    invalidation_triggers,
    circular_logic_detected: circular,
    reasoning_quality_score: quality,
    notes: circular
      ? "CIRCULAR LOGIC DETECTED: cluster contains multiple signals from single source. Volume ≠ confirmation."
      : "",
  });

  return validated.normalized;
}
