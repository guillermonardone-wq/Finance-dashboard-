// ──────────────────────────────────────────────
// Research Expression Recommendations (Phase 3)
// ──────────────────────────────────────────────
// For each flagged cluster, generate rules-based
// "possible expressions" — research ideas, NOT
// trading recommendations.
//
// Each expression has:
//   - type: direct / conservative / convex / hedge
//   - title: short label
//   - rationale: why this might work
//   - mainRisk: what could go wrong
//   - invalidation: what kills the thesis
// ──────────────────────────────────────────────

import type { ClassificationLabel } from "./cluster-classification";

export interface Expression {
  type: "direct" | "conservative" | "convex" | "hedge";
  title: string;
  rationale: string;
  mainRisk: string;
  invalidation: string;
}

export interface ExpressionInput {
  clusterName: string;
  theme: string;
  labels: ClassificationLabel[];
  avgProbability: number;
  probabilityDispersion: number;
  members: {
    title: string;
    yesPrice: number;
    liquidity: number;
    dislocationScore: number;
  }[];
}

export function generateExpressions(input: ExpressionInput): Expression[] {
  const { clusterName, labels, avgProbability, members } = input;

  if (members.length < 2 || labels.length === 0) return [];

  const expressions: Expression[] = [];

  const prices = members.map((m) => m.yesPrice);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const highMkt = members.find((m) => m.yesPrice === maxPrice)!;
  const lowMkt = members.find((m) => m.yesPrice === minPrice)!;

  const dislocations = members.map((m) => m.dislocationScore);
  const maxDis = Math.max(...dislocations);
  const fastMover = members.find((m) => m.dislocationScore === maxDis)!;

  const hasInconsistency = labels.includes("internal_inconsistency");
  const hasLag = labels.includes("lagging_repricing");
  const hasThinLiq = labels.includes("thin_liquidity_trap");
  const hasHighDisp = labels.includes("high_dispersion");

  // ── Direct Expression ──
  // If markets disagree, the simplest thesis: one side is wrong
  if (hasInconsistency || hasHighDisp) {
    const spread = maxPrice - minPrice;
    expressions.push({
      type: "direct",
      title: `Convergence trade within ${clusterName}`,
      rationale:
        `"${highMkt.title}" at ${pct(maxPrice)} and "${lowMkt.title}" at ${pct(minPrice)} are ${(spread * 100).toFixed(0)}¢ apart. ` +
        `If these markets reflect the same underlying thesis, one price is wrong. ` +
        `Research whether the high-confidence side has better information.`,
      mainRisk:
        `The markets may reflect genuinely different events despite being thematically related. ` +
        `Different resolution dates or conditions could justify the spread.`,
      invalidation:
        `The spread narrows to < 10¢ without any obvious catalyst, suggesting the gap was noise.`,
    });
  }

  // ── Conservative Expression ──
  // Favor the deeper-liquidity side
  if (members.length >= 2) {
    const sortedByLiq = [...members].sort((a, b) => b.liquidity - a.liquidity);
    const deepest = sortedByLiq[0];
    expressions.push({
      type: "conservative",
      title: `Follow the deepest liquidity in ${clusterName}`,
      rationale:
        `"${deepest.title}" has the most liquidity in this cluster. ` +
        `Deep markets tend to price-discover faster. ` +
        `If other members lag, they may converge toward the deep market's implied probability of ${pct(deepest.yesPrice)}.`,
      mainRisk:
        `Liquidity alone doesn't guarantee accuracy — a deep market can still be wrong if participants share the same bias.`,
      invalidation:
        `The deep market moves toward the thin markets rather than the other way around.`,
    });
  }

  // ── Convex Expression ──
  // If there's a lag, the lagging markets represent option-like upside
  if (hasLag) {
    expressions.push({
      type: "convex",
      title: `Catch-up play on lagging members of ${clusterName}`,
      rationale:
        `"${fastMover.title}" has already repriced (dislocation score ${maxDis}). ` +
        `If the catalyst driving that move also applies to the broader cluster, the lagging members may see outsized moves as they catch up. ` +
        `This creates convex payoff — small cost if wrong, large gain if the laggards adjust.`,
      mainRisk:
        `The fast mover may have repriced for market-specific reasons that don't apply to the rest of the cluster.`,
      invalidation:
        `The fast mover reverses its move, or the laggards show no reaction within 24-48 hours.`,
    });
  }

  // ── Hedge Expression ──
  // If thin liquidity is present, the signal is noisy — suggest hedging
  if (hasThinLiq || avgProbability > 0.4 && avgProbability < 0.6) {
    expressions.push({
      type: "hedge",
      title: `Hedged position across ${clusterName}`,
      rationale:
        hasThinLiq
          ? `Thin liquidity in parts of this cluster means prices can gap. ` +
            `If taking a position on any member, consider offsetting exposure in a higher-liquidity member ` +
            `to reduce the risk of being trapped in an illiquid market.`
          : `Cluster average probability is near 50% (${pct(avgProbability)}), meaning the outcome is genuinely uncertain. ` +
            `A hedged approach — long one member, short another — isolates the relative mispricing ` +
            `without taking a directional bet on the cluster thesis.`,
      mainRisk:
        `Hedging reduces both upside and downside. If the thesis is strong, a hedge limits profit.`,
      invalidation:
        `Correlation between cluster members breaks down — they stop moving together.`,
    });
  }

  return expressions;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}
