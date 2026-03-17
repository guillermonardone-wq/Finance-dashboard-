// ============================================================
// GDELT SIGNAL GENERATOR — Creates signals from GDELT article volume spikes
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";
import config from "../config.js";

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

const SPIKE_MULTIPLIER = config.signals.gdeltSpikeMultiplier;

const rollingAverages = new Map();
const volumeHistory = new Map();

async function fetchGdeltArticleCount(query) {
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

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((h) => h.timestamp > sevenDaysAgo);
  volumeHistory.set(key, recent);

  if (recent.length < 2) {
    rollingAverages.set(key, currentCount);
    return { average: currentCount, isSpike: false };
  }

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
  const knex = getKnex();
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
      const existing = await knex("signals")
        .where({ source_provider: "gdelt", subcategory: kw.query })
        .where("created_at", ">", sixHoursAgo)
        .first();
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

      await knex("signals").insert({
        id,
        user_id: "default",
        created_at: now,
        updated_at: now,
        category: kw.category,
        subcategory: kw.query,
        title,
        description,
        raw_source: rawSource,
        source_type: "gdelt",
        source_provider: "gdelt",
        source_url: topUrls[0] || null,
        source_attribution: "GDELT Project — DOC 2.0 API",
        novelty: "new",
        reliability: "likely",
        signal_strength: Math.min(1, parseFloat(ratio) / 5),
        thesis_id: null,
        related_signal_ids: [],
        status: "inbox",
        tags: ["auto", "gdelt", kw.query.replace(/\s+/g, "_")],
      });

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
