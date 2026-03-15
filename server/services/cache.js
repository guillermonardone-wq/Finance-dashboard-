// ============================================================
// CACHE SERVICE — Rate-limit-friendly provider cache
// ============================================================
// Uses SQLite provider_cache table for persistence.
// Prevents redundant API calls within TTL windows.

import { getDb } from '../db/connection.js';

const DEFAULT_TTL = 300; // 5 minutes

export class CacheService {
  constructor() {
    this.memCache = new Map(); // in-memory L1 for hot data
  }

  _getDb() {
    return getDb();
  }

  // Generate a deterministic cache key
  makeKey(provider, method, ...args) {
    return `${provider}:${method}:${args.join(':')}`;
  }

  // Get from cache (L1 memory, then L2 SQLite)
  get(key) {
    // L1 check
    if (this.memCache.has(key)) {
      const entry = this.memCache.get(key);
      if (new Date(entry.expires_at) > new Date()) {
        return JSON.parse(entry.data);
      }
      this.memCache.delete(key);
    }

    // L2 check
    try {
      const db = this._getDb();
      const row = db.prepare(
        'SELECT data, expires_at FROM provider_cache WHERE cache_key = ? AND expires_at > datetime(?)'
      ).get(key, new Date().toISOString());

      if (row) {
        // Promote to L1
        this.memCache.set(key, row);
        db.prepare('UPDATE provider_cache SET hit_count = hit_count + 1 WHERE cache_key = ?').run(key);
        return JSON.parse(row.data);
      }
    } catch {
      // DB not ready, continue without cache
    }

    return null;
  }

  // Set cache entry
  set(key, data, provider, ttlSeconds = DEFAULT_TTL) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const serialized = JSON.stringify(data);

    // L1
    this.memCache.set(key, { data: serialized, expires_at: expiresAt });

    // L2
    try {
      const db = this._getDb();
      db.prepare(`
        INSERT OR REPLACE INTO provider_cache (cache_key, provider, data, fetched_at, expires_at, hit_count)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(key, provider, serialized, now.toISOString(), expiresAt);
    } catch {
      // DB not ready, memory cache still works
    }
  }

  // Get-or-fetch pattern
  async getOrFetch(key, provider, ttlSeconds, fetchFn) {
    const cached = this.get(key);
    if (cached) return { data: cached, fromCache: true };

    const data = await fetchFn();
    this.set(key, data, provider, ttlSeconds);
    return { data, fromCache: false };
  }

  // Cleanup expired entries
  cleanup() {
    // L1
    for (const [key, entry] of this.memCache) {
      if (new Date(entry.expires_at) <= new Date()) {
        this.memCache.delete(key);
      }
    }
    // L2
    try {
      const db = this._getDb();
      db.prepare('DELETE FROM provider_cache WHERE expires_at < datetime(?)').run(new Date().toISOString());
    } catch {
      // ignore
    }
  }
}

export const cache = new CacheService();
