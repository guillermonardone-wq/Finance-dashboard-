// ============================================================
// PREDICTION MARKET ADAPTER — Polymarket-style provider
// ============================================================
// MVP adapter: supports manual entry and future API integration.
// Polymarket's CLOB API is the target for automated fetching.
// For MVP, this adapter normalizes manually-entered or
// API-fetched data into the standard snapshot format.
// ============================================================

import { STALE_THRESHOLD_HOURS, THIN_MARKET_LIQUIDITY, THIN_MARKET_VOLUME_24H } from './types.js';

export class PredictionMarketAdapter {
  constructor(config = {}) {
    this.name = config.name || 'polymarket';
    this.baseUrl = config.baseUrl || 'https://clob.polymarket.com';
    this.enabled = true;
  }

  /**
   * Check if a snapshot is stale based on observed_at timestamp.
   */
  isStale(observedAt) {
    const ageHours = (Date.now() - new Date(observedAt).getTime()) / (1000 * 3600);
    return ageHours > STALE_THRESHOLD_HOURS;
  }

  /**
   * Check if a market is thinly traded.
   */
  isThinMarket(snapshot) {
    const thinLiquidity = snapshot.liquidity != null && snapshot.liquidity < THIN_MARKET_LIQUIDITY;
    const thinVolume = snapshot.volume_24h != null && snapshot.volume_24h < THIN_MARKET_VOLUME_24H;
    return thinLiquidity || thinVolume;
  }

  /**
   * Compute thin market penalty (0 to 1, where 1 = fully discounted).
   */
  computeThinMarketPenalty(snapshot) {
    let penalty = 0;

    if (snapshot.liquidity != null && snapshot.liquidity < THIN_MARKET_LIQUIDITY) {
      penalty += (1 - snapshot.liquidity / THIN_MARKET_LIQUIDITY) * 0.5;
    }

    if (snapshot.volume_24h != null && snapshot.volume_24h < THIN_MARKET_VOLUME_24H) {
      penalty += (1 - snapshot.volume_24h / THIN_MARKET_VOLUME_24H) * 0.3;
    }

    if (snapshot.spread != null && snapshot.spread > 0.05) {
      penalty += Math.min(0.2, (snapshot.spread - 0.05) * 2);
    }

    return Math.min(1, Math.max(0, penalty));
  }

  /**
   * Normalize a raw event from external source into our domain shape.
   */
  normalizeEvent(raw) {
    return {
      external_market_id: raw.condition_id || raw.id || null,
      title: raw.question || raw.title || '',
      description: raw.description || '',
      url: raw.url || null,
      category: raw.category || null,
      status: raw.closed ? 'closed' : raw.resolved ? 'resolved' : 'open',
      open_time: raw.start_date || null,
      close_time: raw.end_date || null,
      resolution_time: raw.resolution_time || null,
      market_type: raw.market_type || 'binary',
      tags_json: JSON.stringify(raw.tags || []),
    };
  }

  /**
   * Normalize a raw price/snapshot into our domain shape.
   */
  normalizeSnapshot(raw, eventId) {
    const yesPrice = raw.yes_price ?? raw.outcomePrices?.[0] ?? raw.price ?? null;
    const noPrice = raw.no_price ?? raw.outcomePrices?.[1] ?? (yesPrice != null ? 1 - yesPrice : null);
    const impliedProbability = yesPrice ?? raw.implied_probability ?? 0.5;

    return {
      prediction_market_event_id: eventId,
      observed_at: raw.observed_at || new Date().toISOString(),
      yes_price: yesPrice,
      no_price: noPrice,
      implied_probability: impliedProbability,
      volume_24h: raw.volume_24h ?? raw.volume ?? null,
      liquidity: raw.liquidity ?? null,
      spread: raw.spread ?? (yesPrice != null && noPrice != null ? Math.abs(1 - yesPrice - noPrice) : null),
      source_attribution: `${this.name} - market snapshot`,
      raw_payload_ref: raw.raw_ref || null,
      is_stale: 0,
    };
  }

  getStats() {
    return {
      name: this.name,
      enabled: this.enabled,
      baseUrl: this.baseUrl,
    };
  }
}

export const predictionMarketAdapter = new PredictionMarketAdapter();
