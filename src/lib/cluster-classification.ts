// ──────────────────────────────────────────────
// Signal Classification & Explanation (Phase 3)
// ──────────────────────────────────────────────
// Classifies each cluster into one or more labels,
// then generates a short human-readable explanation.
// ──────────────────────────────────────────────

export type ClassificationLabel =
  | "internal_inconsistency"
  | "lagging_repricing"
  | "thin_liquidity_trap"
  | "unusual_volatility"
  | "high_dispersion";

export interface ClassificationInput {
  clusterName: string;
  theme: string;
  inconsistencyScore: number;
  divergenceScore: number;
  confidenceScore: number;
  probabilityDispersion: number;
  avgProbability: number;
  members: {
    title: string;
    yesPrice: number;
    liquidity: number;
    dislocationScore: number;
    spread: number;
  }[];
  signalTypes: string[];  // types from ClusterSignal rows
}

export interface ClassificationResult {
  labels: ClassificationLabel[];
  explanation: string;
}

export function classifyCluster(input: ClassificationInput): ClassificationResult {
  const {
    clusterName,
    inconsistencyScore,
    divergenceScore,
    probabilityDispersion,
    avgProbability,
    members,
    signalTypes,
  } = input;

  const labels: ClassificationLabel[] = [];
  const reasons: string[] = [];

  if (members.length === 0) {
    return { labels: [], explanation: "" };
  }

  const prices = members.map((m) => m.yesPrice);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const highMkt = members.find((m) => m.yesPrice === maxPrice)!;
  const lowMkt = members.find((m) => m.yesPrice === minPrice)!;

  const dislocations = members.map((m) => m.dislocationScore);
  const maxDis = Math.max(...dislocations);
  const avgDis = dislocations.reduce((s, d) => s + d, 0) / dislocations.length;
  const fastMover = members.find((m) => m.dislocationScore === maxDis)!;

  const thinMembers = members.filter((m) => m.liquidity < 500_000);
  const avgLiquidity = members.reduce((s, m) => s + m.liquidity, 0) / members.length;

  // ── Internal Inconsistency ──
  if (inconsistencyScore >= 50 || signalTypes.includes("disagreement")) {
    labels.push("internal_inconsistency");
    reasons.push(
      `Related markets disagree significantly: "${highMkt.title}" implies ${(maxPrice * 100).toFixed(0)}% while "${lowMkt.title}" implies ${(minPrice * 100).toFixed(0)}%.`
    );
  }

  // ── Lagging Repricing ──
  if (signalTypes.includes("reprice_lag") || (maxDis >= 30 && maxDis - avgDis >= 15)) {
    labels.push("lagging_repricing");
    reasons.push(
      `"${fastMover.title}" has repriced (dislocation ${maxDis}) but the rest of the cluster averages ${avgDis.toFixed(0)} — some markets may be slow to adjust.`
    );
  }

  // ── Thin Liquidity Trap ──
  if (thinMembers.length > 0 || signalTypes.includes("thin_liquidity")) {
    labels.push("thin_liquidity_trap");
    const names = thinMembers.map((m) => `"${m.title}"`).join(", ");
    reasons.push(
      `${thinMembers.length} market(s) have thin liquidity (${names || "flagged by signal"}) — price signals may be noise rather than information.`
    );
  }

  // ── Unusual Volatility ──
  if (signalTypes.includes("unusual_activity") || divergenceScore >= 40) {
    labels.push("unusual_volatility");
    reasons.push(
      `Cluster shows elevated activity with a divergence score of ${divergenceScore} — volume and price moves are above normal.`
    );
  }

  // ── High Dispersion ──
  if (probabilityDispersion >= 0.15) {
    labels.push("high_dispersion");
    reasons.push(
      `Probability spread across the cluster is wide (${(probabilityDispersion * 100).toFixed(1)}¢ std dev around ${(avgProbability * 100).toFixed(0)}% avg) — the market has no consensus.`
    );
  }

  // Build explanation
  let explanation = `${clusterName} contains ${members.length} related markets.`;

  if (reasons.length > 0) {
    explanation += " " + reasons.join(" ");
  } else {
    explanation += " No notable dislocations detected at this time.";
  }

  if (labels.length > 0 && avgLiquidity < 1_000_000) {
    explanation += " Note: average cluster liquidity is modest — signals should be interpreted cautiously.";
  }

  return { labels, explanation };
}
