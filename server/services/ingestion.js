// ============================================================
// INGESTION SERVICE — Normalized market data ingestion
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";
import { registry } from "../providers/registry.js";
import { cache } from "./cache.js";
import config from "../config.js";

const TTL = {
  prices: config.cache.ttlPrices,
  news: config.cache.ttlNews,
  macro: config.cache.ttlMacro,
};

export class IngestionService {
  // Store a market observation in the database
  async _storeObservation(type, symbol, name, data, provider) {
    try {
      const knex = getKnex();
      const id = uuidv4();
      await knex("market_observations").insert({
        id,
        provider: provider || "unknown",
        source_attribution: data.source_attribution || `${provider} - ${type}`,
        fetched_at: new Date().toISOString(),
        observation_type: type,
        symbol: symbol || null,
        name: name || symbol || null,
        data: data,
      });
      return id;
    } catch {
      return null;
    }
  }

  // ---- PRICES ----
  async fetchPrice(symbol) {
    const cacheKey = cache.makeKey("price", symbol);
    return cache.getOrFetch(cacheKey, "prices", TTL.prices, async () => {
      const result = await registry.getPrice(symbol);
      if (result.success) {
        await this._storeObservation(
          "price",
          symbol,
          symbol,
          result.data,
          result.provider,
        );
      }
      return result;
    });
  }

  async fetchCandles(symbol, interval = "1d", from, to) {
    const cacheKey = cache.makeKey("candles", symbol, interval, from, to);
    return cache.getOrFetch(cacheKey, "prices", TTL.prices, async () => {
      const result = await registry.getCandles(symbol, interval, from, to);
      if (result.success) {
        await this._storeObservation(
          "candle",
          symbol,
          `${symbol} ${interval}`,
          { candles: result.data },
          result.provider,
        );
      }
      return result;
    });
  }

  // ---- MACRO DATA ----
  async fetchMacroSeries(seriesId) {
    const cacheKey = cache.makeKey("macro", seriesId);
    return cache.getOrFetch(cacheKey, "macro", TTL.macro, async () => {
      const result = await registry.getMacroSeries(seriesId);
      if (result.success) {
        await this._storeObservation(
          "macro_series",
          seriesId,
          seriesId,
          { points: result.data },
          result.provider,
        );
      }
      return result;
    });
  }

  async fetchMacroCalendar(from, to) {
    const cacheKey = cache.makeKey("calendar", from, to);
    return cache.getOrFetch(cacheKey, "macro", TTL.macro, async () => {
      const result = await registry.getMacroCalendar(from, to);
      if (result.success) {
        await this._storeObservation(
          "calendar_event",
          null,
          "Macro Calendar",
          { events: result.data },
          result.provider,
        );
      }
      return result;
    });
  }

  // ---- NEWS ----
  async fetchNews(query) {
    const cacheKey = cache.makeKey("news", query || "general");
    return cache.getOrFetch(cacheKey, "news", TTL.news, async () => {
      const result = await registry.getNews(query);
      if (result.success && result.data) {
        for (const article of result.data.slice(0, 5)) {
          await this._storeObservation(
            "news",
            null,
            article.title,
            article,
            result.provider,
          );
        }
      }
      return result;
    });
  }

  async fetchHeadlines(category) {
    const cacheKey = cache.makeKey("headlines", category || "business");
    return cache.getOrFetch(cacheKey, "news", TTL.news, async () => {
      const result = await registry.getTopHeadlines(category);
      return result;
    });
  }

  // ---- SENTIMENT ----
  async fetchSentiment(symbol) {
    const cacheKey = cache.makeKey("sentiment", symbol);
    return cache.getOrFetch(cacheKey, "news", TTL.news, async () => {
      const result = await registry.getSentiment(symbol);
      if (result.success) {
        await this._storeObservation(
          "sentiment",
          symbol,
          `${symbol} Sentiment`,
          result.data,
          result.provider,
        );
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
      }),
    );
    return results;
  }
}

export const ingestion = new IngestionService();
