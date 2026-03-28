// ============================================================
// SIGNAL INGESTION PIPELINE
// ============================================================
// Orchestrates:
//   providers → normalize → collect batch → consolidate →
//   quality filter → score → dedup → DB
//
// Responsibilities:
// - Call providers for raw data
// - Normalize into standard signal format
// - Collect all signals into a single batch
// - Consolidate cross-source signals (same category + direction)
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
  normalizeAcledSignal,
} from "./signal-normalizer.js";
import { qualityFilter, scoreSignal, consolidateSignals } from "./signal-quality.js";
import { fetchAcledEvents, aggregateByCountry, detectIntensitySpikes } from "../providers/acled.js";
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
 * Collect normalized signals from FRED (no DB writes).
 * @returns {{ source: string, signals: object[], errors: object[] }}
 */
export async function collectFredSignals() {
  const fredProvider = registry.getProvider("fred");
  if (!fredProvider?.enabled) {
    return { source: "fred", signals: [], errors: [] };
  }

  const thresholdMult = config.signals.fredThresholdMult;
  const signals = [];
  const errors = [];

  for (const series of FRED_SERIES) {
    try {
      const observations = await fredProvider.getMacroSeries(series.id);
      if (!observations || observations.length < 2) continue;

      const latest = observations[0];
      const previous = observations[1];
      const change = latest.value - previous.value;
      const absChange = Math.abs(change);

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

      signals.push(normalized);
    } catch (err) {
      errors.push({ series: series.id, error: err.message });
    }
  }

  return { source: "fred", signals, errors };
}

/**
 * Ingest signals from FRED provider (standalone mode with inline processing).
 */
export async function ingestFredSignals(userId = "default") {
  const { signals, errors } = await collectFredSignals();
  const knex = getKnex();
  const results = { source: "fred", ingested: 0, skipped: 0, filtered: 0, errors };

  for (const signal of signals) {
    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") {
      results.ingested++;
      console.log(`[Signal Ingestion] FRED: ${signal.title}`);
    } else if (outcome === "duplicate") {
      results.skipped++;
    } else {
      results.filtered++;
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
 * Collect normalized signals from World Bank (no DB writes).
 */
export async function collectWorldBankSignals() {
  const wbProvider = registry.getProvider("worldbank");
  if (!wbProvider?.enabled) {
    return { source: "worldbank", signals: [], errors: [] };
  }

  const signals = [];
  const errors = [];

  for (const indicator of WORLDBANK_INDICATORS) {
    try {
      const observations = await wbProvider.getMacroSeries(indicator.code);
      if (!observations || observations.length < 1) continue;

      for (const country of WORLDBANK_COUNTRIES) {
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

        if (!normalized) {
          console.warn(`[Signal Ingestion] Skipping invalid World Bank row: ${indicator.code} ${country}`);
          continue;
        }

        signals.push(normalized);
      }
    } catch (err) {
      errors.push({ indicator: indicator.code, error: err.message });
    }
  }

  return { source: "worldbank", signals, errors };
}

/**
 * Ingest signals from World Bank (standalone mode).
 */
export async function ingestWorldBankSignals(userId = "default") {
  const { signals, errors } = await collectWorldBankSignals();
  const knex = getKnex();
  const results = { source: "worldbank", ingested: 0, skipped: 0, filtered: 0, errors };

  for (const signal of signals) {
    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") results.ingested++;
    else if (outcome === "duplicate") results.skipped++;
    else results.filtered++;
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
 * Collect normalized market signals (no DB writes).
 */
export async function collectMarketSignals() {
  const signals = [];
  const errors = [];
  const MIN_CHANGE_PERCENT = 1.0;

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

      signals.push(normalized);
    } catch (err) {
      errors.push({ symbol: item.symbol, error: err.message });
    }
  }

  return { source: "market", signals, errors };
}

/**
 * Ingest market price signals (standalone mode).
 */
export async function ingestMarketSignals(userId = "default") {
  const { signals, errors } = await collectMarketSignals();
  const knex = getKnex();
  const results = { source: "market", ingested: 0, skipped: 0, filtered: 0, errors };

  for (const signal of signals) {
    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") {
      results.ingested++;
      console.log(`[Signal Ingestion] Market: ${signal.title}`);
    } else if (outcome === "duplicate") {
      results.skipped++;
    } else {
      results.filtered++;
    }
  }

  return results;
}

// ---- NEWS INGESTION ----

/**
 * Collect normalized news signals (no DB writes).
 */
export async function collectNewsSignals() {
  const signals = [];
  const errors = [];

  try {
    const result = await registry.getNews("geopolitics OR sanctions OR oil OR central bank OR inflation");
    if (!result.success || !result.data) return { source: "news", signals, errors };

    for (const article of result.data.slice(0, 15)) {
      const normalized = normalizeNewsSignal({
        title: article.title || article.headline,
        description: article.description || article.summary || "",
        url: article.url,
        source: article.source?.name || article.source || null,
        publishedAt: article.publishedAt || (article.datetime ? new Date(article.datetime * 1000).toISOString() : new Date().toISOString()),
        provider: result.provider,
      });

      signals.push(normalized);
    }
  } catch (err) {
    errors.push({ error: err.message });
  }

  return { source: "news", signals, errors };
}

/**
 * Ingest news articles as signals (standalone mode).
 */
export async function ingestNewsSignals(userId = "default") {
  const { signals, errors } = await collectNewsSignals();
  const knex = getKnex();
  const results = { source: "news", ingested: 0, skipped: 0, filtered: 0, errors };

  for (const signal of signals) {
    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") results.ingested++;
    else if (outcome === "duplicate") results.skipped++;
    else results.filtered++;
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
 * Collect normalized GDELT signals (no DB writes).
 */
export async function collectGdeltSignals() {
  const signals = [];
  const errors = [];

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

      if (normalized) signals.push(normalized);
    } catch (err) {
      console.warn(`[Signal Ingestion] GDELT failed for "${kw.query}": ${err.message}`);
      errors.push({ keyword: kw.query, error: err.message });
    }
  }

  return { source: "gdelt", signals, errors };
}

/**
 * Ingest GDELT signals (standalone mode).
 */
export async function ingestGdeltSignals(userId = "default") {
  const { signals, errors } = await collectGdeltSignals();
  const knex = getKnex();
  const results = { source: "gdelt", ingested: 0, skipped: 0, filtered: 0, errors };

  for (const signal of signals) {
    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") {
      results.ingested++;
      console.log(`[Signal Ingestion] GDELT: ${signal.title}`);
    } else if (outcome === "duplicate") {
      results.skipped++;
    } else {
      results.filtered++;
    }
  }

  return results;
}

// ---- ACLED INGESTION ----

/**
 * Collect normalized ACLED signals (no DB writes).
 */
export async function collectAcledSignals() {
  const signals = [];
  const errors = [];

  try {
    const fetched = await fetchAcledEvents({ days: 7, limit: 200 });
    if (!fetched.success) {
      if (fetched.error && !fetched.error.includes("not configured")) {
        errors.push({ error: fetched.error });
      }
      return { source: "acled", signals, errors };
    }

    if (fetched.data.length === 0) return { source: "acled", signals, errors };

    const countryAggs = aggregateByCountry(fetched.data);
    const spikes = detectIntensitySpikes(countryAggs);

    for (const agg of spikes) {
      const normalized = normalizeAcledSignal(agg);
      if (normalized) signals.push(normalized);
    }
  } catch (err) {
    console.warn(`[Signal Ingestion] ACLED failed: ${err.message}`);
    errors.push({ error: err.message });
  }

  return { source: "acled", signals, errors };
}

/**
 * Ingest ACLED conflict signals (standalone mode).
 */
export async function ingestAcledSignals(userId = "default") {
  const { signals, errors } = await collectAcledSignals();
  const knex = getKnex();
  const results = { source: "acled", ingested: 0, skipped: 0, filtered: 0, errors };

  for (const signal of signals) {
    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") {
      results.ingested++;
      console.log(`[Signal Ingestion] ACLED: ${signal.title}`);
    } else if (outcome === "duplicate") {
      results.skipped++;
    } else {
      results.filtered++;
    }
  }

  return results;
}

// ---- GDELT COLD-START BASELINE ----

/**
 * Warm GDELT rolling averages from recent DB history on startup.
 * Prevents false spike claims on first run after restart.
 *
 * Queries recent GDELT signals from the DB and reconstructs
 * approximate rolling averages from their stored values.
 */
export async function warmGdeltBaseline() {
  try {
    const knex = getKnex();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const recentGdelt = await knex("signals")
      .where("source_provider", "gdelt")
      .where("created_at", ">", sevenDaysAgo)
      .select("entity", "value", "created_at")
      .orderBy("created_at", "asc");

    if (recentGdelt.length === 0) {
      console.log("[GDELT Baseline] No recent GDELT signals in DB — baseline warming skipped. First runs may produce false spikes.");
      return { warmed: false, reason: "no_history", keywords: 0 };
    }

    let keywordsWarmed = 0;

    for (const row of recentGdelt) {
      // Entity format: gdelt_keyword_here → extract keyword
      const keyword = (row.entity || "")
        .replace(/^gdelt_/, "")
        .replace(/_/g, " ");

      if (!keyword) continue;

      const count = row.value != null ? Number(row.value) : 0;
      if (!isFinite(count) || count === 0) continue;

      // Inject into rolling average as historical data point
      if (!gdeltVolumeHistory.has(keyword)) {
        gdeltVolumeHistory.set(keyword, []);
      }

      gdeltVolumeHistory.get(keyword).push({
        count,
        timestamp: new Date(row.created_at).getTime(),
      });
      keywordsWarmed++;
    }

    console.log(`[GDELT Baseline] Warmed ${keywordsWarmed} data points from DB history.`);
    return { warmed: true, reason: "db_history", keywords: keywordsWarmed };
  } catch (err) {
    console.warn(`[GDELT Baseline] Warmup failed (non-fatal): ${err.message}`);
    return { warmed: false, reason: "error", error: err.message };
  }
}

// ---- FULL PIPELINE ----

/**
 * Run the full signal ingestion pipeline across all sources.
 *
 * Flow: providers → normalize → collect batch → consolidate →
 *       quality filter → score → dedup → DB
 *
 * Returns summary of ingested, skipped, consolidated, and errors.
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
        { source: "acled", ingested: 0, skipped: 0, errors: [] },
      ],
      totalIngested: 0,
      totalSkipped: 0,
      totalFiltered: 0,
      totalConsolidated: 0,
      totalErrors: 0,
    };
  }

  console.log("[Signal Ingestion] Starting full pipeline...");

  // ---- Phase 1: Collect normalized signals from all providers in parallel ----
  const sourceNames = ["fred", "worldbank", "market", "news", "gdelt", "acled"];
  const settled = await Promise.allSettled([
    collectFredSignals(),
    collectWorldBankSignals(),
    collectMarketSignals(),
    collectNewsSignals(),
    collectGdeltSignals(),
    collectAcledSignals(),
  ]);

  const collections = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { source: sourceNames[i], signals: [], errors: [{ error: r.reason?.message }] },
  );

  // Merge all normalized signals into one batch
  const allSignals = [];
  const allErrors = {};
  for (const col of collections) {
    for (const sig of col.signals) {
      sig._source_provider_name = col.source; // track origin for per-source stats
      allSignals.push(sig);
    }
    allErrors[col.source] = col.errors;
  }

  const rawCount = allSignals.length;

  // ---- Phase 2: Cross-source consolidation ----
  const consolidated = consolidateSignals(allSignals, { windowMinutes: 30 });
  const consolidatedCount = rawCount - consolidated.length;

  if (consolidatedCount > 0) {
    console.log(`[Signal Ingestion] Consolidated: ${rawCount} raw → ${consolidated.length} signals (${consolidatedCount} merged).`);
  }

  // ---- Phase 3: Quality filter → score → dedup → store ----
  const knex = getKnex();
  const perSourceResults = {};
  for (const name of sourceNames) {
    perSourceResults[name] = { source: name, ingested: 0, skipped: 0, filtered: 0, consolidated: 0, errors: allErrors[name] || [] };
  }

  for (const signal of consolidated) {
    const sourceName = signal._source_provider_name || signal.source || "other";
    const stats = perSourceResults[sourceName] || perSourceResults.other || { ingested: 0, skipped: 0, filtered: 0 };

    const outcome = await processSignal(knex, signal, userId);
    if (outcome === "ingested") {
      stats.ingested++;
      console.log(`[Signal Ingestion] ${sourceName.toUpperCase()}: ${signal.title}`);
    } else if (outcome === "duplicate") {
      stats.skipped++;
    } else {
      stats.filtered++;
    }
  }

  // Mark consolidated counts based on reduction
  // Distribute consolidation proportionally by source
  if (consolidatedCount > 0) {
    for (const col of collections) {
      const sourceRawCount = col.signals.length;
      const sourceConsolidatedCount = consolidated.filter(
        (s) => (s._source_provider_name || s.source) === col.source,
      ).length;
      perSourceResults[col.source].consolidated = Math.max(0, sourceRawCount - sourceConsolidatedCount);
    }
  }

  const sources = sourceNames.map((name) => perSourceResults[name]);
  const totalIngested = sources.reduce((s, r) => s + r.ingested, 0);
  const totalSkipped = sources.reduce((s, r) => s + r.skipped, 0);
  const totalFiltered = sources.reduce((s, r) => s + r.filtered, 0);
  const totalErrors = sources.reduce((s, r) => s + r.errors.length, 0);

  console.log(`[Signal Ingestion] Complete: ${totalIngested} ingested, ${totalSkipped} deduped, ${totalFiltered} filtered, ${consolidatedCount} consolidated, ${totalErrors} errors.`);

  return { sources, totalIngested, totalSkipped, totalFiltered, totalConsolidated: consolidatedCount, totalErrors };
}
