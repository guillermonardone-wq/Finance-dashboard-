// ============================================================
// CACHE SERVICE — Rate-limit-friendly provider cache
// ============================================================
// Uses PostgreSQL provider_cache table for persistence.
// Prevents redundant API calls within TTL windows.

import { getKnex } from "../db/connection.js";

const DEFAULT_TTL = 300; // 5 minutes

export class CacheService {
  constructor() {
    this.memCache = new Map(); // in-memory L1 for hot data
  }

  // Generate a deterministic cache key
  makeKey(provider, method, ...args) {
    return `${provider}:${method}:${args.join(":")}`;
  }

  // Get from cache (L1 memory, then L2 PostgreSQL)
  get(key) {
    // L1 check
    if (this.memCache.has(key)) {
      const entry = this.memCache.get(key);
      if (new Date(entry.expires_at) > new Date()) {
        return typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data;
      }
      this.memCache.delete(key);
    }

    // L2 is async — can't use in sync get(). Use getAsync() or rely on L1.
    return null;
  }

  // Async L2 get
  async getAsync(key) {
    // L1 check first
    const l1 = this.get(key);
    if (l1) return l1;

    // L2 check
    try {
      const knex = getKnex();
      const row = await knex("provider_cache")
        .where("cache_key", key)
        .where("expires_at", ">", new Date().toISOString())
        .first();

      if (row) {
        // Promote to L1
        this.memCache.set(key, {
          data: row.data,
          expires_at: row.expires_at,
        });
        await knex("provider_cache")
          .where("cache_key", key)
          .increment("hit_count", 1);
        return typeof row.data === "string" ? JSON.parse(row.data) : row.data;
      }
    } catch {
      // DB not ready, continue without cache
    }

    return null;
  }

  // Set cache entry
  async set(key, data, provider, ttlSeconds = DEFAULT_TTL) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    // L1
    this.memCache.set(key, { data, expires_at: expiresAt });

    // L2
    try {
      const knex = getKnex();
      await knex("provider_cache")
        .insert({
          cache_key: key,
          provider: provider,
          data: data,
          fetched_at: now.toISOString(),
          expires_at: expiresAt,
          hit_count: 0,
        })
        .onConflict("cache_key")
        .merge();
    } catch {
      // DB not ready, memory cache still works
    }
  }

  // Get-or-fetch pattern
  async getOrFetch(key, provider, ttlSeconds, fetchFn) {
    const cached = await this.getAsync(key);
    if (cached) return { data: cached, fromCache: true };

    const data = await fetchFn();
    await this.set(key, data, provider, ttlSeconds);
    return { data, fromCache: false };
  }

  // Cleanup expired entries
  async cleanup() {
    // L1
    for (const [key, entry] of this.memCache) {
      if (new Date(entry.expires_at) <= new Date()) {
        this.memCache.delete(key);
      }
    }
    // L2
    try {
      const knex = getKnex();
      await knex("provider_cache")
        .where("expires_at", "<", new Date().toISOString())
        .del();
    } catch {
      // ignore
    }
  }
}

export const cache = new CacheService();
