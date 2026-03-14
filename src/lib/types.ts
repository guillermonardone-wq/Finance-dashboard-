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
