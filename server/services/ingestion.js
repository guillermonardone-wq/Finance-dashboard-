// ============================================================
// INGESTION SERVICE — Normalized market data ingestion
// ============================================================
// Fetches data through the provider registry, normalizes it,
// caches appropriately, and stores observations in the database.
// Source attribution is preserved at every step.

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { registry } from '../providers/registry.js';
import { cache } from './cache.js';

// TTL defaults from env or fallback
const TTL = {
  prices: parseInt(process.env.CACHE_TTL_PRICES) || 300,
  news: parseInt(process.env.CACHE_TTL_NEWS) || 600,
  macro: parseInt(process.env.CACHE_TTL_MACRO) || 3600,
};

export class IngestionService {
  // Store a market observation in the database
  _storeObservation(type, symbol, name, data, provider) {
    try {
      const db = getDb();
      const id = uuidv4();
      db.prepare(`
        INSERT INTO market_observations (id, provider, source_attribution, fetched_at, observation_type, symbol, name, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        provider || 'unknown',
        data.source_attribution || `${provider} - ${type}`,
        new Date().toISOString(),
        type,
        symbol || null,
        name || symbol || null,
        JSON.stringify(data)
      );
      return id;
    } catch {
      // Don't fail on storage errors
      return null;
    }
  }

  // ---- PRICES ----
  async fetchPrice(symbol) {
    const cacheKey = cache.makeKey('price', symbol);
    return cache.getOrFetch(cacheKey, 'prices', TTL.prices, async () => {
      const result = await registry.getPrice(symbol);
      if (result.success) {
        this._storeObservation('price', symbol, symbol, result.data, result.provider);
      }
      return result;
    });
  }

  async fetchCandles(symbol, interval = '1d', from, to) {
    const cacheKey = cache.makeKey('candles', symbol, interval, from, to);
    return cache.getOrFetch(cacheKey, 'prices', TTL.prices, async () => {
      const result = await registry.getCandles(symbol, interval, from, to);
      if (result.success) {
        this._storeObservation('candle', symbol, `${symbol} ${interval}`, { candles: result.data }, result.provider);
      }
      return result;
    });
  }

  // ---- MACRO DATA ----
  async fetchMacroSeries(seriesId) {
    const cacheKey = cache.makeKey('macro', seriesId);
    return cache.getOrFetch(cacheKey, 'macro', TTL.macro, async () => {
      const result = await registry.getMacroSeries(seriesId);
      if (result.success) {
        this._storeObservation('macro_series', seriesId, seriesId, { points: result.data }, result.provider);
      }
      return result;
    });
  }

  async fetchMacroCalendar(from, to) {
    const cacheKey = cache.makeKey('calendar', from, to);
    return cache.getOrFetch(cacheKey, 'macro', TTL.macro, async () => {
      const result = await registry.getMacroCalendar(from, to);
      if (result.success) {
        this._storeObservation('calendar_event', null, 'Macro Calendar', { events: result.data }, result.provider);
      }
      return result;
    });
  }

  // ---- NEWS ----
  async fetchNews(query) {
    const cacheKey = cache.makeKey('news', query || 'general');
    return cache.getOrFetch(cacheKey, 'news', TTL.news, async () => {
      const result = await registry.getNews(query);
      if (result.success && result.data) {
        for (const article of result.data.slice(0, 5)) {
          this._storeObservation('news', null, article.title, article, result.provider);
        }
      }
      return result;
    });
  }

  async fetchHeadlines(category) {
    const cacheKey = cache.makeKey('headlines', category || 'business');
    return cache.getOrFetch(cacheKey, 'news', TTL.news, async () => {
      const result = await registry.getTopHeadlines(category);
      return result;
    });
  }

  // ---- SENTIMENT ----
  async fetchSentiment(symbol) {
    const cacheKey = cache.makeKey('sentiment', symbol);
    return cache.getOrFetch(cacheKey, 'news', TTL.news, async () => {
      const result = await registry.getSentiment(symbol);
      if (result.success) {
        this._storeObservation('sentiment', symbol, `${symbol} Sentiment`, result.data, result.provider);
      }
      return result;
    });
  }

  // ---- BULK OPERATIONS ----
  async fetchWatchlistPrices(symbols) {
    const results = {};
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        const result = await this.fetchPrice(symbol);
        results[symbol] = result;
      })
    );
    return results;
  }
}

export const ingestion = new IngestionService();
