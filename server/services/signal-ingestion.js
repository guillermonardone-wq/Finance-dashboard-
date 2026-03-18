// ============================================================
// SIGNAL INGESTION PIPELINE
// ============================================================
// Orchestrates: provider → normalizer → quality → dedup → DB
//
// Responsibilities:
// - Call providers for raw data
// - Normalize into standard signal format
// - Quality filter (drop weak / zero-change signals)
// - Score (strength + confidence)
// - Dedup by entity + category + direction within time window
// - Store in signals table
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";
import { registry } from "../providers/registry.js";
import {
  normalizeFredSignal,
  normalizeWorldBankSignal,
  normalizeMarketSignal,
  normalizeNewsSignal,
  normalizeGdeltSignal,
} from "./signal-normalizer.js";
import { qualityFilter, scoreSignal } from "./signal-quality.js";
import config from "../config.js";

// Dedup window: skip signals for same entity+category+direction within this many minutes
const DEDUP_WINDOW_MINUTES = 60;

/**
 * Check if a signal with the same raw_source already exists.
 * Also checks entity+category+direction within the dedup window.
 */
async function isDuplicate(knex, signal, userId) {
  // Exact dedup by raw_source
  if (signal.raw_source) {
    const existing = await knex("signals")
      .where({ raw_source: signal.raw_source, user_id: userId })
      .first();
    if (existing) return true;
  }

  // Window dedup: same entity + category + direction within window
  if (signal.entity && signal.category) {
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
    let query = knex("signals")
      .where({ entity: signal.entity, category: signal.category, user_id: userId })
      .where("created_at", ">", cutoff);
    if (signal.direction) {
      query = query.where("direction", signal.direction);
    }
    const recent = await query.first();
    if (recent) return true;
  }

  return false;
}

/**
 * Process a single normalized signal through the quality pipeline:
 * quality filter → score → dedup → store.
 *
 * @returns {"ingested"|"filtered"|"duplicate"}
 */
async function processSignal(knex, signal, userId) {
  // Quality gate
  const { pass, reason } = qualityFilter(signal);
  if (!pass) return "filtered";

  // Score the signal
  const { strength, confidence } = scoreSignal(signal);
  signal.signal_strength = Math.min(1, strength / 10);
  signal._strength = strength;
  signal._confidence = confidence;

  // Dedup
  if (await isDuplicate(knex, signal, userId)) return "duplicate";

  // Store
  await storeSignal(knex, signal, userId);
  return "ingested";
}

/**
 * Store a normalized signal in the DB.
 */
async function storeSignal(knex, signal, userId) {
  const id = uuidv4();
  const now = new Date().toISOString();

  await knex("signals").insert({
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    category: signal.category || "other",
    subcategory: signal.subcategory || null,
    title: signal.title,
    description: signal.summary || signal.description || signal.title,
    raw_source: signal.raw_source || null,
    source_type: signal.source_type || "market_data",
    source_provider: signal.source_provider || signal.source || null,
    source_url: signal.source_url || null,
    source_attribution: signal.source_attribution || null,
    novelty: signal.novelty || "new",
    reliability: signal.reliability || "unverified",
    signal_strength: signal.signal_strength != null ? signal.signal_strength : null,
    thesis_id: null,
    related_signal_ids: [],
    status: "inbox",
    tags: signal.tags || [],
    // Normalized fields
    entity: signal.entity || null,
    value: signal.value != null ? signal.value : null,
    previous_value: signal.previous_value != null ? signal.previous_value : null,
    change: signal.change != null ? signal.change : null,
    significance: signal.significance != null ? signal.significance : null,
    direction: signal.direction || null,
    summary: signal.summary || null,
  });

  return { id, title: signal.title, entity: signal.entity };
}

// ---- FRED INGESTION ----

const FRED_SERIES = [
  { id: "FEDERAL_FUNDS_RATE", label: "Fed Funds Rate", category: "central_bank_action", unit: "%" },
  { id: "US_CPI_YOY", label: "CPI Year-over-Year", category: "currency_instability", unit: "%" },
  { id: "US_GDP_GROWTH", label: "Real GDP Growth Rate", category: "policy_shock", unit: "%" },
  { id: "US_UNEMPLOYMENT", label: "Unemployment Rate", category: "policy_shock", unit: "%" },
  { id: "US_TREASURY_10Y", label: "10-Year Treasury Yield", category: "credit_stress", unit: "%" },
];

// Historical std dev computation
function computeStdDev(values) {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Ingest signals from FRED provider.
 * Fetches macro series, detects significant changes, normalizes, deduplicates, stores.
 */
export async function ingestFredSignals(userId = "default") {
  const fredProvider = registry.getProvider("fred");
  if (!fredProvider?.enabled) {
    return { source: "fred", ingested: 0, skipped: 0, errors: [] };
  }

  const knex = getKnex();
  const thresholdMult = config.signals.fredThresholdMult;
  const results = { source: "fred", ingested: 0, skipped: 0, errors: [] };

  for (const series of FRED_SERIES) {
    try {
      const observations = await fredProvider.getMacroSeries(series.id);
      if (!observations || observations.length < 2) continue;

      const latest = observations[0];
      const previous = observations[1];
      const change = latest.value - previous.value;
      const absChange = Math.abs(change);

      // Compute threshold from historical changes
      const changes = [];
      for (let i = 0; i < observations.length - 1; i++) {
        changes.push(observations[i].value - observations[i + 1].value);
      }
      const stdDev = computeStdDev(changes);
      const threshold = stdDev != null
        ? stdDev * thresholdMult
        : (series.defaultThreshold || 0.25) * thresholdMult;

      if (absChange < threshold) continue;

      const normalized = normalizeFredSignal({
        seriesId: series.id,
        label: series.label,
        category: series.category,
        unit: series.unit,
        value: latest.value,
        previousValue: previous.value,
        date: latest.date,
        stdDev,
      });

      const outcome = await processSignal(knex, normalized, userId);
      if (outcome === "ingested") {
        results.ingested++;
        console.log(`[Signal Ingestion] FRED: ${normalized.title}`);
      } else if (outcome === "duplicate") {
        results.skipped++;
      } else {
        results.filtered = (results.filtered || 0) + 1;
      }
    } catch (err) {
      results.errors.push({ series: series.id, error: err.message });
    }
  }

  return results;
}

// ---- WORLD BANK INGESTION ----

const WORLDBANK_INDICATORS = [
  { code: "NY.GDP.MKTP.KD.ZG", name: "GDP Growth (annual %)", category: "policy_shock" },
  { code: "FP.CPI.TOTL.ZG", name: "Inflation (CPI, annual %)", category: "currency_instability" },
  { code: "SL.UEM.TOTL.ZS", name: "Unemployment (% of labor force)", category: "policy_shock" },
];

const WORLDBANK_COUNTRIES = ["USA", "CHN", "JPN", "DEU", "GBR"];

/**
 * Ingest signals from World Bank provider.
 */
export async function ingestWorldBankSignals(userId = "default") {
  const wbProvider = registry.getProvider("worldbank");
  if (!wbProvider?.enabled) {
    return { source: "worldbank", ingested: 0, skipped: 0, errors: [] };
  }

  const knex = getKnex();
  const results = { source: "worldbank", ingested: 0, skipped: 0, errors: [] };

  for (const indicator of WORLDBANK_INDICATORS) {
    try {
      const observations = await wbProvider.getMacroSeries(indicator.code);
      if (!observations || observations.length < 1) continue;

      for (const country of WORLDBANK_COUNTRIES) {
        // World Bank returns all countries mixed. Filter per country.
        const countryObs = observations.filter((o) => o.country === country || o.ref_area === country);
        if (countryObs.length < 1) continue;

        const latest = countryObs[0];
        const previous = countryObs.length > 1 ? countryObs[1] : null;

        const normalized = normalizeWorldBankSignal({
          indicatorCode: indicator.code,
          indicatorName: indicator.name,
          category: indicator.category,
          country,
          value: latest.value,
          previousValue: previous?.value ?? null,
          date: latest.date || latest.TIME_PERIOD || new Date().toISOString(),
        });

        // normalizer returns null for invalid/missing data
        if (!normalized) {
          console.warn(`[Signal Ingestion] Skipping invalid World Bank row: ${indicator.code} ${country}`);
          continue;
        }

        const outcome = await processSignal(knex, normalized, userId);
        if (outcome === "ingested") results.ingested++;
        else if (outcome === "duplicate") results.skipped++;
        else results.filtered = (results.filtered || 0) + 1;
      }
    } catch (err) {
      results.errors.push({ indicator: indicator.code, error: err.message });
    }
  }

  return results;
}

// ---- MARKET DATA INGESTION ----

const WATCHLIST_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500 ETF", category: "market_data" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", category: "market_data" },
  { symbol: "TLT", name: "20+ Year Treasury ETF", category: "credit_stress" },
  { symbol: "GLD", name: "Gold ETF", category: "commodity_chokepoint" },
  { symbol: "USO", name: "Oil ETF", category: "energy_bottleneck" },
  { symbol: "UUP", name: "US Dollar ETF", category: "currency_instability" },
  { symbol: "VIX", name: "Volatility Index", category: "market_complacency" },
];

/**
 * Ingest market price signals for watchlist symbols.
 * Only creates signals for moves above a minimum threshold.
 */
export async function ingestMarketSignals(userId = "default") {
  const knex = getKnex();
  const results = { source: "market", ingested: 0, skipped: 0, errors: [] };
  const MIN_CHANGE_PERCENT = 1.0; // Only signal moves > 1%

  for (const item of WATCHLIST_SYMBOLS) {
    try {
      const result = await registry.getPrice(item.symbol);
      if (!result.success || !result.data) continue;

      const price = result.data;
      const changePercent = price.changePercent || price.dp || 0;

      if (Math.abs(changePercent) < MIN_CHANGE_PERCENT) continue;

      const normalized = normalizeMarketSignal({
        symbol: item.symbol,
        name: item.name,
        category: item.category,
        value: price.price || price.c || 0,
        previousValue: price.previousClose || (price.price || price.c || 0) - (price.change || price.d || 0),
        changePercent,
        provider: result.provider,
        timestamp: new Date().toISOString(),
      });

      const outcome = await processSignal(knex, normalized, userId);
      if (outcome === "ingested") {
        results.ingested++;
        console.log(`[Signal Ingestion] Market: ${normalized.title}`);
      } else if (outcome === "duplicate") {
        results.skipped++;
      } else {
        results.filtered = (results.filtered || 0) + 1;
      }
    } catch (err) {
      results.errors.push({ symbol: item.symbol, error: err.message });
    }
  }

  return results;
}

// ---- NEWS INGESTION ----

/**
 * Ingest news articles as signals.
 */
export async function ingestNewsSignals(userId = "default") {
  const knex = getKnex();
  const results = { source: "news", ingested: 0, skipped: 0, errors: [] };

  try {
    const result = await registry.getNews("geopolitics OR sanctions OR oil OR central bank OR inflation");
    if (!result.success || !result.data) return results;

    for (const article of result.data.slice(0, 15)) {
      const normalized = normalizeNewsSignal({
        title: article.title || article.headline,
        description: article.description || article.summary || "",
        url: article.url,
        source: article.source?.name || article.source || null,
        publishedAt: article.publishedAt || (article.datetime ? new Date(article.datetime * 1000).toISOString() : new Date().toISOString()),
        provider: result.provider,
      });

      const outcome = await processSignal(knex, normalized, userId);
      if (outcome === "ingested") results.ingested++;
      else if (outcome === "duplicate") results.skipped++;
      else results.filtered = (results.filtered || 0) + 1;
    }
  } catch (err) {
    results.errors.push({ error: err.message });
  }

  return results;
}

// ---- GDELT INGESTION ----

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

const GDELT_KEYWORDS = [
  { query: "military escalation", category: "military_mobilization" },
  { query: "sanctions", category: "sanctions_risk" },
  { query: "central bank emergency", category: "central_bank_action" },
  { query: "oil supply disruption", category: "energy_bottleneck" },
  { query: "currency crisis", category: "currency_instability" },
  { query: "strait of hormuz", category: "shipping_disruption" },
  { query: "taiwan strait", category: "geopolitical_escalation" },
];

// In-memory rolling averages for spike detection (persists across runs)
const gdeltVolumeHistory = new Map();

/**
 * Fetch article count and top articles from GDELT DOC API.
 * Exported for testability.
 */
export async function fetchGdeltArticleCount(query) {
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    maxrecords: "75",
    timespan: "24h",
    format: "json",
    sort: "DateDesc",
  });

  const url = `${GDELT_DOC_API}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GDELT API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const articles = data.articles || [];

  return {
    count: articles.length,
    articles: articles.slice(0, 3).map((a) => ({
      title: a.title || "",
      url: a.url || "",
      source: a.domain || a.source || "",
    })),
  };
}

/**
 * Update in-memory rolling average for a keyword.
 * Returns { average, isSpike }.
 */
export function updateGdeltRollingAverage(keyword, currentCount) {
  if (!gdeltVolumeHistory.has(keyword)) {
    gdeltVolumeHistory.set(keyword, []);
  }

  const history = gdeltVolumeHistory.get(keyword);
  history.push({ count: currentCount, timestamp: Date.now() });

  // Keep only last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h) => h.timestamp > sevenDaysAgo);
  gdeltVolumeHistory.set(keyword, recent);

  if (recent.length < 2) {
    return { average: currentCount, isSpike: false };
  }

  const previousEntries = recent.slice(0, -1);
  const average = previousEntries.reduce((s, h) => s + h.count, 0) / previousEntries.length;
  const spikeMultiplier = config.signals.gdeltSpikeMultiplier;

  return {
    average,
    isSpike: average > 0 && currentCount >= average * spikeMultiplier,
  };
}

/**
 * Ingest signals from GDELT volume spike detection.
 * Fetches article counts, detects spikes vs rolling average,
 * normalizes into standard signal format, deduplicates, stores.
 */
export async function ingestGdeltSignals(userId = "default") {
  const knex = getKnex();
  const results = { source: "gdelt", ingested: 0, skipped: 0, errors: [] };

  for (const kw of GDELT_KEYWORDS) {
    try {
      const fetched = await fetchGdeltArticleCount(kw.query);
      const { average, isSpike } = updateGdeltRollingAverage(kw.query, fetched.count);

      if (!isSpike) continue;

      const ratio = average > 0 ? fetched.count / average : 1;

      const normalized = normalizeGdeltSignal({
        keyword: kw.query,
        category: kw.category,
        count: fetched.count,
        average,
        ratio,
        topArticles: fetched.articles,
      });

      if (!normalized) continue;

      const outcome = await processSignal(knex, normalized, userId);
      if (outcome === "ingested") {
        results.ingested++;
        console.log(`[Signal Ingestion] GDELT: ${normalized.title}`);
      } else if (outcome === "duplicate") {
        results.skipped++;
      } else {
        results.filtered = (results.filtered || 0) + 1;
      }
    } catch (err) {
      console.warn(`[Signal Ingestion] GDELT failed for "${kw.query}": ${err.message}`);
      results.errors.push({ keyword: kw.query, error: err.message });
    }
  }

  return results;
}

// ---- FULL PIPELINE ----

/**
 * Run the full signal ingestion pipeline across all sources.
 * Returns summary of ingested, skipped, and errors per source.
 * Respects INGESTION_MODE: "mock" skips all provider calls.
 */
export async function runIngestionPipeline(userId = "default") {
  if (config.ingestionMode === "mock") {
    console.log("[Signal Ingestion] Mock mode — skipping provider calls.");
    return {
      sources: [
        { source: "fred", ingested: 0, skipped: 0, errors: [] },
        { source: "worldbank", ingested: 0, skipped: 0, errors: [] },
        { source: "market", ingested: 0, skipped: 0, errors: [] },
        { source: "news", ingested: 0, skipped: 0, errors: [] },
        { source: "gdelt", ingested: 0, skipped: 0, errors: [] },
      ],
      totalIngested: 0,
      totalSkipped: 0,
      totalErrors: 0,
    };
  }

  console.log("[Signal Ingestion] Starting full pipeline...");

  const [fred, worldbank, market, news, gdelt] = await Promise.allSettled([
    ingestFredSignals(userId),
    ingestWorldBankSignals(userId),
    ingestMarketSignals(userId),
    ingestNewsSignals(userId),
    ingestGdeltSignals(userId),
  ]);

  const settled = [fred, worldbank, market, news, gdelt];
  const sourceNames = ["fred", "worldbank", "market", "news", "gdelt"];
  const sources = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { source: sourceNames[i], ingested: 0, skipped: 0, errors: [{ error: r.reason?.message }] },
  );

  const totalIngested = sources.reduce((s, r) => s + r.ingested, 0);
  const totalSkipped = sources.reduce((s, r) => s + r.skipped, 0);
  const totalFiltered = sources.reduce((s, r) => s + (r.filtered || 0), 0);
  const totalErrors = sources.reduce((s, r) => s + r.errors.length, 0);

  console.log(`[Signal Ingestion] Complete: ${totalIngested} ingested, ${totalSkipped} deduped, ${totalFiltered} filtered, ${totalErrors} errors.`);

  return { sources, totalIngested, totalSkipped, totalFiltered, totalErrors };
}
