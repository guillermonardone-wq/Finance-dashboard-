// ============================================================
// PREDICTION MARKET ADAPTER — Polymarket-style provider
// ============================================================
// MVP adapter: supports manual entry and future API integration.
// Polymarket's CLOB API is the target for automated fetching.
// For MVP, this adapter normalizes manually-entered or
// API-fetched data into the standard snapshot format.
// ============================================================

import {
  STALE_THRESHOLD_HOURS,
  VERY_STALE_THRESHOLD_HOURS,
  EXCLUDED_THRESHOLD_HOURS,
  THIN_MARKET_LIQUIDITY,
  THIN_MARKET_VOLUME_24H,
} from './types.js';

export class PredictionMarketAdapter {
  constructor(config = {}) {
    this.name = config.name || 'polymarket';
    this.baseUrl = config.baseUrl || 'https://clob.polymarket.com';
    this.enabled = true;
  }

  /**
   * Get snapshot age in hours.
   */
  ageHours(observedAt) {
    return (Date.now() - new Date(observedAt).getTime()) / (1000 * 3600);
  }

  /**
   * Check if a snapshot is stale based on observed_at timestamp.
   */
  isStale(observedAt) {
    return this.ageHours(observedAt) > STALE_THRESHOLD_HOURS;
  }

  /**
   * Check if a snapshot is beyond the hard exclusion cutoff (>48h).
   */
  isExcluded(observedAt) {
    return this.ageHours(observedAt) > EXCLUDED_THRESHOLD_HOURS;
  }

  /**
   * Graduated freshness factor: fresh=1.0, stale=0.5, very_stale=0.3, excluded=0.
   */
  freshnessFactor(observedAt) {
    const age = this.ageHours(observedAt);
    if (age > EXCLUDED_THRESHOLD_HOURS) return 0;
    if (age > VERY_STALE_THRESHOLD_HOURS) return 0.3;
    if (age > STALE_THRESHOLD_HOURS) return 0.5;
    return 1.0;
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
