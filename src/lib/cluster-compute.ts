// ──────────────────────────────────────────────
// Cluster Compute (Phase 3)
// ──────────────────────────────────────────────
// Runs the full Phase 2 + Phase 3 pipeline for a cluster:
//   analytics → signals → ranking → classification → expressions
// Returns everything needed to update the DB.
// Used by both seed.ts and the cron route.
// ──────────────────────────────────────────────

import { computeClusterAnalytics } from "./cluster-analytics";
import { detectClusterSignals, type Signal } from "./cluster-signals";
import { computeRanking } from "./cluster-ranking";
import { classifyCluster } from "./cluster-classification";
import { generateExpressions } from "./cluster-expressions";

interface MemberMarket {
  title: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  dislocationScore: number;
}

export interface ClusterComputeResult {
  // Phase 2
  avgProbability: number;
  probabilityDispersion: number;
  inconsistencyScore: number;
  divergenceScore: number;
  confidenceScore: number;
  // Phase 3
  rankingScore: number;
  classification: string;  // JSON
  explanation: string;
  expressions: string;     // JSON
  // Signals to store
  signals: Signal[];
}

export function computeCluster(
  clusterName: string,
  theme: string,
  members: MemberMarket[]
): ClusterComputeResult {
  // Phase 2: analytics + signals
  const analytics = computeClusterAnalytics(members);
  const signals = detectClusterSignals(members, analytics.avgProbability, analytics.probabilityDispersion);

  // Phase 3: ranking
  const avgLiquidity = members.length > 0
    ? members.reduce((s, m) => s + m.liquidity, 0) / members.length
    : 0;
  const maxDislocation = members.length > 0
    ? Math.max(...members.map((m) => m.dislocationScore))
    : 0;

  const { rankingScore } = computeRanking({
    divergenceScore: analytics.divergenceScore,
    confidenceScore: analytics.confidenceScore,
    inconsistencyScore: analytics.inconsistencyScore,
    avgLiquidity,
    maxDislocation,
    signalCount: signals.length,
    memberCount: members.length,
  });

  // Phase 3: classification + explanation
  const signalTypes = signals.map((s) => s.type);
  const { labels, explanation } = classifyCluster({
    clusterName,
    theme,
    inconsistencyScore: analytics.inconsistencyScore,
    divergenceScore: analytics.divergenceScore,
    confidenceScore: analytics.confidenceScore,
    probabilityDispersion: analytics.probabilityDispersion,
    avgProbability: analytics.avgProbability,
    members,
    signalTypes,
  });

  // Phase 3: research expressions
  const expressionList = generateExpressions({
    clusterName,
    theme,
    labels,
    avgProbability: analytics.avgProbability,
    probabilityDispersion: analytics.probabilityDispersion,
    members,
  });

  return {
    ...analytics,
    rankingScore,
    classification: JSON.stringify(labels),
    explanation,
    expressions: JSON.stringify(expressionList),
    signals,
  };
}
