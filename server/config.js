// ============================================================
// CENTRALIZED CONFIGURATION — Single source of truth
// ============================================================
// All server modules import config from here.
// No direct process.env usage outside this file.
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
  // Environment
  env: envStr("NODE_ENV", "development"),

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

  // API key for authenticating requests (empty = dev mode, no auth)
  apiKey: envStr("API_KEY"),

  // CORS
  corsOrigin: envStr("CORS_ORIGIN", "http://localhost:5173"),

  // Data provider API keys
  providers: {
    alphaVantage: envStr("ALPHA_VANTAGE_API_KEY"),
    finnhub: envStr("FINNHUB_API_KEY"),
    fred: envStr("FRED_API_KEY"),
    worldBank: envStr("WORLD_BANK_API_KEY"),
    newsApi: envStr("NEWSAPI_API_KEY"),
    unusualWhales: envStr("UNUSUAL_WHALES_API_KEY"),
    unusualWhalesBaseUrl: envStr(
      "UNUSUAL_WHALES_BASE_URL",
      "https://api.unusualwhales.com",
    ),
    polygon: envStr("POLYGON_API_KEY"),
    acledApiKey: envStr("ACLED_API_KEY"),
    acledEmail: envStr("ACLED_EMAIL"),
  },

  // LLM Advisory
  llm: {
    provider: envStr("LLM_PROVIDER", "anthropic"),
    model: envStr("LLM_MODEL", "claude-sonnet-4-6"),
    anthropicKey: envStr("ANTHROPIC_API_KEY"),
    openaiKey: envStr("OPENAI_API_KEY"),
  },

  // Notifications (placeholder for future sessions)
  notifications: {},

  // Cache TTLs (seconds)
  cache: {
    ttlPrices: envInt("CACHE_TTL_PRICES", 300),
    ttlNews: envInt("CACHE_TTL_NEWS", 600),
    ttlMacro: envInt("CACHE_TTL_MACRO", 3600),
  },

  // Ingestion mode: "live" (call real providers) or "mock" (skip provider calls)
  ingestionMode: envStr("INGESTION_MODE", "live"),

  // Refresh intervals (seconds)
  refresh: {
    ingestion: envInt("REFRESH_INTERVAL_INGESTION", 900),
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
};

/**
 * Validate critical config on startup. Warns but does not crash in dev.
 */
export function validateConfig() {
  const warnings = [];

  if (!config.db.host) warnings.push("DB_HOST is not set");
  if (!config.db.password || config.db.password === "dev_password") {
    warnings.push("DB_PASSWORD is using default — set a real password for production");
  }

  if (!config.apiKey && config.env === "production") {
    warnings.push("API_KEY is not set — all requests will be unauthenticated");
  }

  const hasAnyProvider =
    config.providers.alphaVantage ||
    config.providers.finnhub ||
    config.providers.fred ||
    config.providers.newsApi;
  if (!hasAnyProvider) {
    warnings.push("No data provider API keys configured — live data will be unavailable");
  }

  if (!config.llm.anthropicKey && !config.llm.openaiKey) {
    warnings.push("No LLM API key configured — advisory evaluations will fail");
  }

  if (warnings.length > 0) {
    console.warn("[Config] Warnings:");
    warnings.forEach((w) => console.warn(`  - ${w}`));
  } else {
    console.log("[Config] All critical configuration validated.");
  }

  return warnings;
}

export default config;
