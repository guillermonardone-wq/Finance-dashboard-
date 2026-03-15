// ============================================================
// SCHEDULER — Background data fetching from live providers
// ============================================================
// Runs on startup and at intervals to keep market data fresh.
// Converts live news into signals and triggers bot scans.

import { v4 as uuidv4 } from 'uuid';
import { ingestion } from './ingestion.js';
import { registry } from '../providers/registry.js';
import { getDb } from '../db/connection.js';

const WATCHLIST = ['SPY', 'QQQ', 'TLT', 'GLD', 'USO', 'UUP', 'EEM', 'IWM'];
const FRED_SERIES = ['CPI', 'GDP', 'UNRATE', 'FEDFUNDS', 'DGS10', 'DGS2'];
const NEWS_QUERIES = ['economy', 'oil prices', 'federal reserve', 'geopolitics'];

const INTERVALS = {
  prices: parseInt(process.env.REFRESH_INTERVAL_PRICES) || 300,
  news: parseInt(process.env.REFRESH_INTERVAL_NEWS) || 900,
  macro: parseInt(process.env.REFRESH_INTERVAL_MACRO) || 3600,
};

// Map news keywords to signal categories
function categorizeNews(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.match(/oil|crude|opec|energy|gas|lng/)) return 'energy_bottleneck';
  if (text.match(/fed|interest rate|monetary|central bank|boj|ecb/)) return 'central_bank_action';
  if (text.match(/tariff|sanctions|trade war|embargo/)) return 'sanctions_risk';
  if (text.match(/war|military|missile|drone|conflict|attack/)) return 'geopolitical_escalation';
  if (text.match(/cpi|inflation|deflation|prices/)) return 'currency_instability';
  if (text.match(/shipping|port|strait|suez|hormuz/)) return 'shipping_disruption';
  if (text.match(/gdp|recession|employment|unemployment|jobs/)) return 'policy_shock';
  if (text.match(/stock|market|rally|crash|sell.?off|volatility/)) return 'market_complacency';
  if (text.match(/election|vote|political|congress|parliament/)) return 'election_political';
  if (text.match(/supply chain|chip|semiconductor|shortage/)) return 'supply_chain';
  if (text.match(/credit|default|debt|bond|yield/)) return 'credit_stress';
  if (text.match(/diplomat|treaty|peace|ceasefire/)) return 'diplomatic_shift';
  if (text.match(/trade|export|import|quota/)) return 'trade_war';
  if (text.match(/tech|ai|cyber|hack/)) return 'technology_disruption';
  return 'other';
}

// Convert a live news article into a signal in the signals table
function newsToSignal(article, provider) {
  const db = getDb();
  const title = article.title || article.headline || '';
  const description = article.description || article.content || article.summary || '';

  // Skip if we already have a signal with same title (dedup)
  const existing = db.prepare('SELECT id FROM signals WHERE title = ?').get(title);
  if (existing) return null;

  const id = uuidv4();
  const now = new Date().toISOString();
  const category = categorizeNews(title, description);

  db.prepare(`
    INSERT INTO signals (
      id, created_at, updated_at, category, subcategory,
      title, description, raw_source, source_type, source_provider,
      source_url, source_attribution, novelty, reliability, signal_strength,
      thesis_id, related_signal_ids, status, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, now, now, category, null,
    title, description.slice(0, 500), null,
    'news_feed', provider,
    article.url || null, article.source || provider,
    'new', 'likely', 0.5,
    null, JSON.stringify([]),
    'inbox', JSON.stringify([])
  );

  return id;
}

// Extract articles array from potentially nested response
function extractArticles(result) {
  if (!result) return [];
  // Direct array
  if (Array.isArray(result)) return result;
  // { data: [...] }
  if (Array.isArray(result.data)) return result.data;
  // { data: { data: [...] } } (cache-wrapped)
  if (result.data?.data && Array.isArray(result.data.data)) return result.data.data;
  // { data: { success, data: [...] } }
  if (result.data?.success && Array.isArray(result.data?.data)) return result.data.data;
  return [];
}

function extractProvider(result) {
  return result?.provider || result?.data?.provider || 'news';
}

async function fetchPrices() {
  if (!registry.hasAnyLiveProvider()) return;
  try {
    console.log('[Scheduler] Fetching watchlist prices...');
    await ingestion.fetchWatchlistPrices(WATCHLIST);
    console.log('[Scheduler] Prices updated.');
  } catch (err) {
    console.warn('[Scheduler] Price fetch failed:', err.message);
  }
}

async function fetchNews() {
  try {
    const newsProviders = registry.getProvidersFor('news');
    if (newsProviders.length === 0) return;
    console.log('[Scheduler] Fetching news...');

    let newSignalCount = 0;

    // Fetch from each query
    for (const q of NEWS_QUERIES) {
      const result = await ingestion.fetchNews(q);
      const articles = extractArticles(result);
      for (const article of articles.slice(0, 5)) {
        const signalId = newsToSignal(article, extractProvider(result));
        if (signalId) newSignalCount++;
      }
    }

    // Fetch headlines
    const headlines = await ingestion.fetchHeadlines('business');
    const headlineArticles = extractArticles(headlines);
    for (const article of headlineArticles.slice(0, 5)) {
      const signalId = newsToSignal(article, extractProvider(headlines));
      if (signalId) newSignalCount++;
    }

    console.log(`[Scheduler] News updated — ${newSignalCount} new signals created.`);
  } catch (err) {
    console.warn('[Scheduler] News fetch failed:', err.message);
  }
}

async function fetchMacro() {
  try {
    const fredProvider = registry.getProvider('fred');
    if (fredProvider?.enabled) {
      console.log('[Scheduler] Fetching FRED macro data...');
      for (const series of FRED_SERIES) {
        await ingestion.fetchMacroSeries(series);
      }
      console.log('[Scheduler] FRED data updated.');
    }
  } catch (err) {
    console.warn('[Scheduler] Macro fetch failed:', err.message);
  }
}

export async function startScheduler() {
  // Initial fetch after a short delay to let providers finish initializing
  setTimeout(async () => {
    console.log('[Scheduler] Running initial data fetch...');
    await Promise.allSettled([fetchPrices(), fetchNews(), fetchMacro()]);
    console.log('[Scheduler] Initial fetch complete.');
  }, 3000);

  // Schedule recurring fetches
  setInterval(fetchPrices, INTERVALS.prices * 1000);
  setInterval(fetchNews, INTERVALS.news * 1000);
  setInterval(fetchMacro, INTERVALS.macro * 1000);

  console.log(`[Scheduler] Started — prices every ${INTERVALS.prices}s, news every ${INTERVALS.news}s, macro every ${INTERVALS.macro}s`);
}
