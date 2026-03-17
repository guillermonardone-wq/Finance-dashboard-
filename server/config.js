// ============================================================
// CENTRALIZED CONFIGURATION
// ============================================================
// Single source of truth for all server configuration.
// Reads from environment variables with sensible defaults.
// ============================================================

import dotenv from "dotenv";
dotenv.config();

function envInt(key, defaultVal) {
  const v = process.env[key];
  return v != null ? parseInt(v, 10) : defaultVal;
}

function envFloat(key, defaultVal) {
  const v = process.env[key];
  return v != null ? parseFloat(v) : defaultVal;
}

function envStr(key, defaultVal = "") {
  return process.env[key] || defaultVal;
}

const config = {
  // Server
  port: envInt("PORT", 3002),

  // PostgreSQL
  db: {
    host: envStr("DB_HOST", "localhost"),
    port: envInt("DB_PORT", 5432),
    name: envStr("DB_NAME", "signalforge"),
    user: envStr("DB_USER", "signalforge"),
    password: envStr("DB_PASSWORD", "dev_password"),
  },

  // Legacy (kept for reference, no longer used)
  dbPath: envStr("DB_PATH", "./data/decision-engine.db"),

  // API Keys
  apiKeys: {
    alphaVantage: envStr("ALPHA_VANTAGE_API_KEY"),
    newsapi: envStr("NEWSAPI_API_KEY"),
    finnhub: envStr("FINNHUB_API_KEY"),
    unusualWhales: envStr("UNUSUAL_WHALES_API_KEY"),
    fred: envStr("FRED_API_KEY"),
    polygon: envStr("POLYGON_API_KEY"),
    anthropic: envStr("ANTHROPIC_API_KEY"),
    openai: envStr("OPENAI_API_KEY"),
  },

  // Cache TTLs (seconds)
  cache: {
    ttlPrices: envInt("CACHE_TTL_PRICES", 300),
    ttlNews: envInt("CACHE_TTL_NEWS", 600),
    ttlMacro: envInt("CACHE_TTL_MACRO", 3600),
  },

  // Refresh intervals (seconds)
  refresh: {
    prices: envInt("REFRESH_INTERVAL_PRICES", 300),
    news: envInt("REFRESH_INTERVAL_NEWS", 900),
    macro: envInt("REFRESH_INTERVAL_MACRO", 3600),
    fredSignals: envInt("REFRESH_INTERVAL_FRED_SIGNALS", 86400),
    gdeltSignals: envInt("REFRESH_INTERVAL_GDELT_SIGNALS", 1800),
  },

  // Signal generation thresholds
  signals: {
    fredThresholdMult: envFloat("FRED_SIGNAL_THRESHOLD_MULT", 1.0),
    gdeltSpikeMultiplier: envFloat("GDELT_SPIKE_MULTIPLIER", 2.0),
  },

  // LLM Advisory
  llm: {
    provider: envStr("LLM_PROVIDER", "anthropic"),
    model: envStr("LLM_MODEL", "claude-sonnet-4-6"),
  },
};

export default config;
