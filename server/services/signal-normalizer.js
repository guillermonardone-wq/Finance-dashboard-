// ============================================================
// SIGNAL NORMALIZER — Converts raw provider data into
// standardized signal format for the ingestion pipeline.
// ============================================================
// Input: raw provider responses (FRED, World Bank, market data)
// Output: normalized signal objects ready for DB insertion
// ============================================================

import { computeDirection, computeSignificance } from "./signal-rules.js";

/**
 * Normalize a FRED macro observation into a signal.
 *
 * @param {object} params
 * @param {string} params.seriesId   - e.g. "FEDERAL_FUNDS_RATE"
 * @param {string} params.label      - e.g. "Fed Funds Rate"
 * @param {string} params.category   - e.g. "central_bank_action"
 * @param {string} params.unit       - e.g. "%"
 * @param {number} params.value      - latest observation value
 * @param {number} params.previousValue - previous observation value
 * @param {string} params.date       - observation date
 * @param {number|null} params.stdDev - historical std dev of changes
 * @returns {object} normalized signal
 */
export function normalizeFredSignal({ seriesId, label, category, unit, value, previousValue, date, stdDev }) {
  const change = value - previousValue;
  const absChange = Math.abs(change);
  const sigmas = stdDev ? absChange / stdDev : null;
  const direction = computeDirection(category, seriesId, change);
  const significance = computeSignificance(absChange, stdDev, sigmas);
  const changeDir = change > 0 ? "rose" : "fell";
  const magnitude = sigmas
    ? `${sigmas.toFixed(1)}\u03C3 move`
    : `${absChange.toFixed(2)}${unit} change`;

  return {
    source: "fred",
    category,
    entity: seriesId,
    value,
    previous_value: previousValue,
    change,
    timestamp: date,
    significance,
    direction,
    summary: `${label} ${changeDir} from ${previousValue.toFixed(2)}${unit} to ${value.toFixed(2)}${unit} (${magnitude}).`,
    // Additional fields for signal storage
    title: `${label} ${changeDir} to ${value.toFixed(2)}${unit} (${magnitude})`,
    source_type: "fred",
    source_provider: "fred",
    source_attribution: `FRED (Federal Reserve) \u2014 ${seriesId}`,
    raw_source: `fred-${seriesId}-${date}`,
    novelty: "new",
    reliability: "verified",
    signal_strength: Math.min(1, absChange / ((stdDev || absChange) * 3)),
    tags: ["auto", "fred", seriesId.toLowerCase()],
  };
}

/**
 * Normalize a World Bank macro indicator into a signal.
 * Guards against missing/invalid data — returns null if unusable.
 */
export function normalizeWorldBankSignal({ indicatorCode, indicatorName, category, country, value, previousValue, date }) {
  // Guard: skip rows with missing critical data
  if (value == null || !isFinite(value)) return null;
  if (!indicatorCode || !country) return null;

  const safeValue = Number(value);
  if (isNaN(safeValue)) return null;

  const safePrev = previousValue != null && isFinite(previousValue) ? Number(previousValue) : null;
  const change = safePrev != null ? safeValue - safePrev : 0;
  const entity = `${indicatorCode}_${country}`;
  const direction = computeDirection(category, indicatorCode, change);
  const significance = computeSignificance(Math.abs(change), null, null);

  const changeStr = safePrev != null
    ? ` (change: ${change >= 0 ? "+" : ""}${change.toFixed(2)})`
    : "";

  return {
    source: "worldbank",
    category,
    entity,
    value: safeValue,
    previous_value: safePrev,
    change,
    timestamp: date || new Date().toISOString(),
    significance,
    direction,
    summary: `${indicatorName || indicatorCode} for ${country}: ${safeValue.toFixed(2)}${changeStr}.`,
    title: `${indicatorName || indicatorCode} (${country}): ${safeValue.toFixed(2)}${changeStr}`,
    source_type: "market_data",
    source_provider: "worldbank",
    source_attribution: `World Bank Data360 \u2014 ${indicatorCode}`,
    raw_source: `worldbank-${indicatorCode}-${country}-${date}`,
    novelty: "new",
    reliability: "verified",
    signal_strength: Math.min(1, Math.abs(change) / (Math.abs(value) * 0.1 || 1)),
    tags: ["auto", "worldbank", indicatorCode.toLowerCase(), country.toLowerCase()],
  };
}

/**
 * Normalize a market data point (price, FX) into a signal.
 */
export function normalizeMarketSignal({ symbol, name, category, value, previousValue, changePercent, provider, timestamp }) {
  const change = previousValue != null ? value - previousValue : 0;
  const direction = computeDirection(category || "market", symbol, change);
  const absChangePercent = Math.abs(changePercent || 0);
  const significance = absChangePercent >= 5 ? 5
    : absChangePercent >= 3 ? 4
    : absChangePercent >= 1.5 ? 3
    : absChangePercent >= 0.5 ? 2
    : 1;

  const dirStr = change >= 0 ? "up" : "down";

  return {
    source: provider || "market",
    category: category || "market_data",
    entity: symbol,
    value,
    previous_value: previousValue,
    change,
    timestamp: timestamp || new Date().toISOString(),
    significance,
    direction,
    summary: `${name || symbol} ${dirStr} ${absChangePercent.toFixed(2)}% to ${value.toFixed(2)}.`,
    title: `${name || symbol}: ${dirStr} ${absChangePercent.toFixed(2)}% to ${value.toFixed(2)}`,
    source_type: "market_data",
    source_provider: provider || "market",
    source_attribution: `${provider || "Market"} \u2014 ${symbol}`,
    raw_source: `market-${symbol}-${timestamp || new Date().toISOString().slice(0, 10)}`,
    novelty: "new",
    reliability: "verified",
    signal_strength: Math.min(1, absChangePercent / 10),
    tags: ["auto", "market", symbol.toLowerCase()],
  };
}

/**
 * Normalize a news article into a signal.
 */
export function normalizeNewsSignal({ title, description, url, source, publishedAt, provider, category: explicitCategory }) {
  const category = explicitCategory || inferCategoryFromText(`${title} ${description || ""}`);
  const direction = "neutral";
  const significance = 2;

  return {
    source: provider || "news",
    category,
    entity: null,
    value: null,
    previous_value: null,
    change: null,
    timestamp: publishedAt || new Date().toISOString(),
    significance,
    direction,
    summary: title,
    title: (title || "").slice(0, 200),
    description: description || title || "",
    source_type: "news_feed",
    source_provider: provider || "news",
    source_attribution: source || provider || "News",
    source_url: url || null,
    raw_source: `news-${(title || "").slice(0, 60).replace(/\W+/g, "_").toLowerCase()}`,
    novelty: "new",
    reliability: "likely",
    signal_strength: 0.5,
    tags: ["auto", "news"],
  };
}

// ---- Helpers ----

const CATEGORY_KEYWORDS = {
  energy_bottleneck: ["oil", "crude", "opec", "pipeline", "refinery", "gas", "lng", "energy"],
  geopolitical_escalation: ["war", "military", "invasion", "conflict", "nato", "tensions", "geopolit"],
  central_bank_action: ["fed", "fomc", "rate", "central bank", "boj", "ecb", "monetary", "interest rate"],
  currency_instability: ["currency", "forex", "dollar", "yen", "euro", "devaluation", "fx"],
  sanctions_risk: ["sanction", "embargo", "tariff", "trade war", "ban"],
  shipping_disruption: ["shipping", "port", "strait", "canal", "tanker", "freight"],
  commodity_chokepoint: ["commodity", "wheat", "copper", "lithium", "rare earth"],
  policy_shock: ["gdp", "growth", "recession", "employment", "unemployment", "inflation", "cpi"],
  credit_stress: ["credit", "default", "yield", "spread", "bond", "debt", "treasury"],
  market_complacency: ["vix", "volatility", "complacen", "risk", "overvalued"],
  supply_chain: ["supply chain", "semiconductor", "chip", "shortage"],
  election_political: ["election", "vote", "political", "congress", "parliament"],
};

function inferCategoryFromText(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "other";
}
