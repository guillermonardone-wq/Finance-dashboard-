// Shared types used across client pages and components

export interface Market {
  id: string;
  externalId: string;
  source: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string | null;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  resolutionDate: string | null;
  dislocationScore: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  id: string;
  marketId: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  capturedAt: string;
}

export interface MarketDetail extends Market {
  snapshots: Snapshot[];
}

// ── Phase 2: Clusters ──

export interface Cluster {
  id: string;
  name: string;
  description: string;
  theme: string;
  avgProbability: number;
  probabilityDispersion: number;
  inconsistencyScore: number;
  divergenceScore: number;
  confidenceScore: number;
  // Phase 3
  rankingScore: number;
  classification: string;  // JSON string of ClassificationLabel[]
  explanation: string;
  expressions: string;     // JSON string of Expression[]
  createdAt: string;
  updatedAt: string;
  _count?: { markets: number; signals: number };
}

export interface ClusterSignal {
  id: string;
  clusterId: string;
  type: string;
  severity: string;
  message: string;
  data: string;
  createdAt: string;
}

export interface ClusterDetail extends Cluster {
  markets: { market: Market }[];
  signals: ClusterSignal[];
}

// ── Phase 3: Parsed types for UI ──

export interface Expression {
  type: "direct" | "conservative" | "convex" | "hedge";
  title: string;
  rationale: string;
  mainRisk: string;
  invalidation: string;
}
