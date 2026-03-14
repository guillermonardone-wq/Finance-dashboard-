// ──────────────────────────────────────────────
// Cluster Ranking (Phase 3)
// ──────────────────────────────────────────────
// Transparent composite score (0–100) that ranks
// how "interesting" a cluster is for research.
//
// Components:
//   divergence       (25) — are markets disagreeing?
//   confidence       (20) — is there enough liquidity to trust it?
//   liquidityQuality (15) — depth across the cluster
//   recency          (20) — has something moved recently?
//   confirmation     (20) — are multiple signals firing?
// ──────────────────────────────────────────────

export interface RankingInput {
  divergenceScore: number;      // 0–100
  confidenceScore: number;      // 0–100
  inconsistencyScore: number;   // 0–100
  avgLiquidity: number;         // USD
  maxDislocation: number;       // highest single-market dislocation in cluster
  signalCount: number;          // how many signals fired
  memberCount: number;          // how many markets in cluster
}

export interface RankingResult {
  rankingScore: number;
  breakdown: {
    divergence: number;
    confidence: number;
    liquidityQuality: number;
    recency: number;
    confirmation: number;
  };
}

export function computeRanking(input: RankingInput): RankingResult {
  const {
    divergenceScore,
    confidenceScore,
    avgLiquidity,
    maxDislocation,
    signalCount,
    memberCount,
  } = input;

  // Divergence (0–25): direct scale from Phase 2 score
  const divergence = (divergenceScore / 100) * 25;

  // Confidence (0–20): higher confidence = more interesting
  const confidence = (confidenceScore / 100) * 20;

  // Liquidity quality (0–15): deep liquidity = more tradeable signal
  const liqRatio = Math.min(1, avgLiquidity / 3_000_000);
  const liquidityQuality = liqRatio * 15;

  // Recency (0–20): at least one market moved recently (high dislocation)
  const recency = Math.min(1, maxDislocation / 50) * 20;

  // Confirmation (0–20): multiple signals + multiple members agreeing
  const sigFactor = Math.min(1, signalCount / 3);
  const memFactor = Math.min(1, memberCount / 4);
  const confirmation = ((sigFactor + memFactor) / 2) * 20;

  const rankingScore = Math.round(
    Math.min(100, divergence + confidence + liquidityQuality + recency + confirmation)
  );

  return {
    rankingScore,
    breakdown: {
      divergence: parseFloat(divergence.toFixed(1)),
      confidence: parseFloat(confidence.toFixed(1)),
      liquidityQuality: parseFloat(liquidityQuality.toFixed(1)),
      recency: parseFloat(recency.toFixed(1)),
      confirmation: parseFloat(confirmation.toFixed(1)),
    },
  };
}
