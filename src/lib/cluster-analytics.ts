// ──────────────────────────────────────────────
// Cluster Analytics (Phase 2)
// ──────────────────────────────────────────────
// Given a set of markets in a cluster, compute:
//   - avgProbability:       mean of yesPrices
//   - probabilityDispersion: std dev of yesPrices
//   - inconsistencyScore:   0–100, how much members disagree
//   - divergenceScore:      0–100, cross-market dislocation
//   - confidenceScore:      0–100, how trustworthy the cluster signal is
// ──────────────────────────────────────────────

export interface ClusterMember {
  yesPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  dislocationScore: number;
}

export interface ClusterAnalytics {
  avgProbability: number;
  probabilityDispersion: number;
  inconsistencyScore: number;
  divergenceScore: number;
  confidenceScore: number;
}

export function computeClusterAnalytics(members: ClusterMember[]): ClusterAnalytics {
  if (members.length === 0) {
    return { avgProbability: 0, probabilityDispersion: 0, inconsistencyScore: 0, divergenceScore: 0, confidenceScore: 0 };
  }

  const prices = members.map((m) => m.yesPrice);

  // Average implied probability
  const avgProbability = prices.reduce((s, p) => s + p, 0) / prices.length;

  // Standard deviation of yesPrices
  const variance = prices.reduce((s, p) => s + (p - avgProbability) ** 2, 0) / prices.length;
  const probabilityDispersion = Math.sqrt(variance);

  // ── Inconsistency Score (0–100) ──
  // High when members strongly disagree (high dispersion relative to what's possible)
  // Max possible std dev for [0,1] values is 0.5 (all at 0 or 1)
  // A dispersion of 0.25 = very high disagreement
  const inconsistencyScore = Math.round(Math.min(100, (probabilityDispersion / 0.25) * 100));

  // ── Divergence Score (0–100) ──
  // Combines: avg dislocation of members + spread between fastest and slowest movers
  const avgDislocation = members.reduce((s, m) => s + m.dislocationScore, 0) / members.length;
  const maxDislocation = Math.max(...members.map((m) => m.dislocationScore));
  const minDislocation = Math.min(...members.map((m) => m.dislocationScore));
  const dislocationSpread = maxDislocation - minDislocation;

  // Weighted: 60% avg dislocation (are markets moving?), 40% spread (are they moving unevenly?)
  const divergenceScore = Math.round(
    Math.min(100, avgDislocation * 0.6 + dislocationSpread * 0.4)
  );

  // ── Confidence Score (0–100) ──
  // Higher when: more members, deeper liquidity, tighter spreads
  // Lower when: few members, thin liquidity, wide spreads
  const memberCountFactor = Math.min(1, members.length / 4); // 4+ members = full score
  const avgLiquidity = members.reduce((s, m) => s + m.liquidity, 0) / members.length;
  const liquidityFactor = Math.min(1, avgLiquidity / 2_000_000); // $2M avg = full score
  const avgSpread = members.reduce((s, m) => s + m.spread, 0) / members.length;
  const spreadFactor = Math.max(0, 1 - avgSpread / 0.05); // 5¢ avg spread = zero confidence

  const confidenceScore = Math.round(
    (memberCountFactor * 30 + liquidityFactor * 40 + spreadFactor * 30)
  );

  return {
    avgProbability: parseFloat(avgProbability.toFixed(4)),
    probabilityDispersion: parseFloat(probabilityDispersion.toFixed(4)),
    inconsistencyScore,
    divergenceScore,
    confidenceScore,
  };
}
