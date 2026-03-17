// ============================================================
// GDELT SIGNAL GENERATOR — Creates signals from GDELT article volume spikes
// ============================================================
// Uses the GDELT DOC 2.0 API to monitor keyword article volumes.
// When volume for a keyword exceeds 2x the 7-day rolling average,
// auto-creates a signal with top article URLs.

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";

const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

// Keywords to monitor and their signal categories
const GDELT_KEYWORDS = [
  { query: "military escalation", category: "military_mobilization" },
  { query: "sanctions", category: "sanctions_risk" },
  { query: "central bank emergency", category: "central_bank_action" },
  { query: "oil supply disruption", category: "energy_bottleneck" },
  { query: "currency crisis", category: "currency_instability" },
  { query: "strait of hormuz", category: "shipping_disruption" },
  { query: "taiwan strait", category: "geopolitical_escalation" },
];

// Volume spike multiplier (env override)
const SPIKE_MULTIPLIER = parseFloat(process.env.GDELT_SPIKE_MULTIPLIER) || 2.0;

// In-memory rolling averages (persisted across checks within a server session)
const rollingAverages = new Map();

// Store for tracking article counts over time (7-day window)
const volumeHistory = new Map();

async function fetchGdeltArticleCount(query) {
  // GDELT DOC 2.0 API: fetch article list for last 24 hours
  const params = new URLSearchParams({
    query: query,
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
      date: a.seendate || "",
    })),
  };
}

function updateRollingAverage(keyword, currentCount) {
  const key = keyword;
  if (!volumeHistory.has(key)) {
    volumeHistory.set(key, []);
  }

  const history = volumeHistory.get(key);
  history.push({ count: currentCount, timestamp: Date.now() });

  // Keep only 7 days of data (assuming checks every 30 min = 336 data points)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h) => h.timestamp > sevenDaysAgo);
  volumeHistory.set(key, recent);

  if (recent.length < 2) {
    // Not enough history yet — store average and skip spike detection
    rollingAverages.set(key, currentCount);
    return { average: currentCount, isSpike: false };
  }

  // Compute average excluding the current data point
  const previousEntries = recent.slice(0, -1);
  const average =
    previousEntries.reduce((s, h) => s + h.count, 0) / previousEntries.length;
  rollingAverages.set(key, average);

  return {
    average,
    isSpike: average > 0 && currentCount >= average * SPIKE_MULTIPLIER,
  };
}

export async function checkGdeltSignals() {
  const db = getDb();
  const created = [];

  for (const kw of GDELT_KEYWORDS) {
    try {
      const result = await fetchGdeltArticleCount(kw.query);
      const { average, isSpike } = updateRollingAverage(kw.query, result.count);

      if (!isSpike) continue;
      if (result.count === 0) continue;

      // Dedup: don't create signal for same keyword within 6 hours
      const sixHoursAgo = new Date(
        Date.now() - 6 * 60 * 60 * 1000,
      ).toISOString();
      const existing = db
        .prepare(
          "SELECT id FROM signals WHERE source_provider = 'gdelt' AND subcategory = ? AND created_at > ?",
        )
        .get(kw.query, sixHoursAgo);
      if (existing) continue;

      const ratio = (result.count / average).toFixed(1);
      const topUrls = result.articles.map((a) => a.url).filter(Boolean);

      const title = `GDELT spike: "${kw.query}" — ${result.count} articles (${ratio}x avg)`;
      const description = [
        `Article volume for "${kw.query}" spiked to ${result.count} articles in the last 24h.`,
        `7-day rolling average: ${average.toFixed(0)} articles. Current: ${ratio}x average.`,
        result.articles.length > 0 ? `\nTop articles:` : "",
        ...result.articles.map((a, i) => `${i + 1}. ${a.title} (${a.source})`),
      ]
        .filter(Boolean)
        .join("\n");

      const rawSource = JSON.stringify({
        keyword: kw.query,
        count: result.count,
        average: Math.round(average),
        ratio: parseFloat(ratio),
        top_urls: topUrls,
        checked_at: new Date().toISOString(),
      });

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(
        `
        INSERT INTO signals (
          id, created_at, updated_at, category, subcategory,
          title, description, raw_source, source_type, source_provider,
          source_url, source_attribution, novelty, reliability, signal_strength,
          thesis_id, related_signal_ids, status, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        id,
        now,
        now,
        kw.category,
        kw.query,
        title,
        description,
        rawSource,
        "gdelt",
        "gdelt",
        topUrls[0] || null,
        "GDELT Project — DOC 2.0 API",
        "new",
        "likely",
        Math.min(1, parseFloat(ratio) / 5), // strength scales with spike magnitude
        null,
        JSON.stringify([]),
        "inbox",
        JSON.stringify(["auto", "gdelt", kw.query.replace(/\s+/g, "_")]),
      );

      created.push({ id, title, keyword: kw.query });
      console.log(`[GDELT Signals] Created: ${title}`);
    } catch (err) {
      console.warn(`[GDELT Signals] Failed for "${kw.query}": ${err.message}`);
    }
  }

  if (created.length === 0) {
    console.log("[GDELT Signals] No volume spikes detected.");
  }

  return created;
}
