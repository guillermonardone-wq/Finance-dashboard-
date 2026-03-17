// ============================================================
// SCHEDULER — Background data fetching from live providers
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { ingestion } from "./ingestion.js";
import { registry } from "../providers/registry.js";
import { getKnex } from "../db/connection.js";
import { checkFredSignals } from "./fred-signals.js";
import { checkGdeltSignals } from "./gdelt-signals.js";
import config from "../config.js";
import { logFailure } from "./dead-letter.js";

const WATCHLIST = ["SPY", "QQQ", "TLT", "GLD", "USO", "UUP", "EEM", "IWM"];
const FRED_SERIES = ["CPI", "GDP", "UNRATE", "FEDFUNDS", "DGS10", "DGS2"];
const NEWS_QUERIES = [
  "economy",
  "oil prices",
  "federal reserve",
  "geopolitics",
];

const INTERVALS = config.refresh;

// Map news keywords to signal categories
function categorizeNews(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/oil|crude|opec|energy|gas|lng/)) return "energy_bottleneck";
  if (text.match(/fed|interest rate|monetary|central bank|boj|ecb/))
    return "central_bank_action";
  if (text.match(/tariff|sanctions|trade war|embargo/)) return "sanctions_risk";
  if (text.match(/war|military|missile|drone|conflict|attack/))
    return "geopolitical_escalation";
  if (text.match(/cpi|inflation|deflation|prices/))
    return "currency_instability";
  if (text.match(/shipping|port|strait|suez|hormuz/))
    return "shipping_disruption";
  if (text.match(/gdp|recession|employment|unemployment|jobs/))
    return "policy_shock";
  if (text.match(/stock|market|rally|crash|sell.?off|volatility/))
    return "market_complacency";
  if (text.match(/election|vote|political|congress|parliament/))
    return "election_political";
  if (text.match(/supply chain|chip|semiconductor|shortage/))
    return "supply_chain";
  if (text.match(/credit|default|debt|bond|yield/)) return "credit_stress";
  if (text.match(/diplomat|treaty|peace|ceasefire/)) return "diplomatic_shift";
  if (text.match(/trade|export|import|quota/)) return "trade_war";
  if (text.match(/tech|ai|cyber|hack/)) return "technology_disruption";
  return "other";
}

// Convert a live news article into a signal in the signals table
async function newsToSignal(article, provider) {
  const knex = getKnex();
  const title = article.title || article.headline || "";
  const description =
    article.description || article.content || article.summary || "";

  // Skip if we already have a signal with same title (dedup)
  const existing = await knex("signals").where("title", title).first();
  if (existing) return null;

  const id = uuidv4();
  const now = new Date().toISOString();
  const category = categorizeNews(title, description);

  await knex("signals").insert({
    id,
    user_id: "default",
    created_at: now,
    updated_at: now,
    category,
    subcategory: null,
    title,
    description: description.slice(0, 500),
    raw_source: null,
    source_type: "news_feed",
    source_provider: provider,
    source_url: article.url || null,
    source_attribution: article.source || provider,
    novelty: "new",
    reliability: "likely",
    signal_strength: 0.5,
    thesis_id: null,
    related_signal_ids: [],
    status: "inbox",
    tags: [],
  });

  return id;
}

// Extract articles array from potentially nested response
function extractArticles(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (result.data?.data && Array.isArray(result.data.data))
    return result.data.data;
  if (result.data?.success && Array.isArray(result.data?.data))
    return result.data.data;
  return [];
}

function extractProvider(result) {
  return result?.provider || result?.data?.provider || "news";
}

async function fetchPrices() {
  if (!registry.hasAnyLiveProvider()) return;
  try {
    console.log("[Scheduler] Fetching watchlist prices...");
    await ingestion.fetchWatchlistPrices(WATCHLIST);
    console.log("[Scheduler] Prices updated.");
  } catch (err) {
    console.warn("[Scheduler] Price fetch failed:", err.message);
    logFailure("price_fetch", { symbols: WATCHLIST }, err).catch(() => {});
  }
}

async function fetchNews() {
  try {
    const newsProviders = registry.getProvidersFor("news");
    if (newsProviders.length === 0) return;
    console.log("[Scheduler] Fetching news...");

    let newSignalCount = 0;

    for (const q of NEWS_QUERIES) {
      const result = await ingestion.fetchNews(q);
      const articles = extractArticles(result);
      for (const article of articles.slice(0, 5)) {
        const signalId = await newsToSignal(article, extractProvider(result));
        if (signalId) newSignalCount++;
      }
    }

    const headlines = await ingestion.fetchHeadlines("business");
    const headlineArticles = extractArticles(headlines);
    for (const article of headlineArticles.slice(0, 5)) {
      const signalId = await newsToSignal(article, extractProvider(headlines));
      if (signalId) newSignalCount++;
    }

    console.log(
      `[Scheduler] News updated — ${newSignalCount} new signals created.`,
    );
  } catch (err) {
    console.warn("[Scheduler] News fetch failed:", err.message);
    logFailure("news_fetch", { queries: NEWS_QUERIES }, err).catch(() => {});
  }
}

async function fetchMacro() {
  try {
    const fredProvider = registry.getProvider("fred");
    if (fredProvider?.enabled) {
      console.log("[Scheduler] Fetching FRED macro data...");
      for (const series of FRED_SERIES) {
        await ingestion.fetchMacroSeries(series);
      }
      console.log("[Scheduler] FRED data updated.");
    }
  } catch (err) {
    console.warn("[Scheduler] Macro fetch failed:", err.message);
    logFailure("macro_fetch", { series: FRED_SERIES }, err).catch(() => {});
  }
}

export async function startScheduler() {
  setTimeout(async () => {
    console.log("[Scheduler] Running initial data fetch...");
    await Promise.allSettled([fetchPrices(), fetchNews(), fetchMacro()]);
    console.log("[Scheduler] Initial fetch complete.");

    console.log("[Scheduler] Running initial FRED signal check...");
    await checkFredSignals().catch((err) =>
      console.warn("[Scheduler] FRED signal check failed:", err.message),
    );

    console.log("[Scheduler] Running initial GDELT check...");
    await checkGdeltSignals().catch((err) =>
      console.warn("[Scheduler] GDELT check failed:", err.message),
    );
  }, 3000);

  setInterval(fetchPrices, INTERVALS.prices * 1000);
  setInterval(fetchNews, INTERVALS.news * 1000);
  setInterval(fetchMacro, INTERVALS.macro * 1000);

  setInterval(() => {
    checkFredSignals().catch((err) =>
      console.warn("[Scheduler] FRED signal check failed:", err.message),
    );
  }, INTERVALS.fredSignals * 1000);

  setInterval(() => {
    checkGdeltSignals().catch((err) =>
      console.warn("[Scheduler] GDELT check failed:", err.message),
    );
  }, INTERVALS.gdeltSignals * 1000);

  console.log(
    `[Scheduler] Started — prices ${INTERVALS.prices}s, news ${INTERVALS.news}s, macro ${INTERVALS.macro}s, fred-signals ${INTERVALS.fredSignals}s, gdelt ${INTERVALS.gdeltSignals}s`,
  );
}
