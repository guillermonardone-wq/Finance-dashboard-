// ============================================================
// FRED SIGNAL GENERATOR — Creates signals from significant FRED data changes
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { registry } from "../providers/registry.js";
import { getKnex } from "../db/connection.js";
import config from "../config.js";

const FRED_SIGNAL_SERIES = [
  { id: "FEDERAL_FUNDS_RATE", label: "Fed Funds Rate", category: "central_bank_action", unit: "%", defaultThreshold: 0.25 },
  { id: "US_CPI_YOY", label: "CPI Year-over-Year", category: "currency_instability", unit: "%", defaultThreshold: 0.3 },
  { id: "US_GDP_GROWTH", label: "Real GDP Growth Rate", category: "policy_shock", unit: "%", defaultThreshold: 0.5 },
  { id: "US_UNEMPLOYMENT", label: "Unemployment Rate", category: "policy_shock", unit: "%", defaultThreshold: 0.2 },
  { id: "US_TREASURY_10Y", label: "10-Year Treasury Yield", category: "credit_stress", unit: "%", defaultThreshold: 0.15 },
];

const THRESHOLD_MULTIPLIER = config.signals.fredThresholdMult;

function computeStdDev(values) {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeChanges(observations) {
  const changes = [];
  for (let i = 0; i < observations.length - 1; i++) {
    changes.push(observations[i].value - observations[i + 1].value);
  }
  return changes;
}

export async function checkFredSignals() {
  const fredProvider = registry.getProvider("fred");
  if (!fredProvider?.enabled) {
    console.log("[FRED Signals] FRED provider not enabled, skipping.");
    return [];
  }

  const knex = getKnex();
  const created = [];

  for (const series of FRED_SIGNAL_SERIES) {
    try {
      const observations = await fredProvider.getMacroSeries(series.id);
      if (!observations || observations.length < 2) continue;

      const latest = observations[0];
      const previous = observations[1];
      const change = latest.value - previous.value;
      const absChange = Math.abs(change);

      const historicalChanges = computeChanges(observations);
      const stdDev = computeStdDev(historicalChanges);
      const threshold =
        stdDev != null
          ? stdDev * THRESHOLD_MULTIPLIER
          : series.defaultThreshold * THRESHOLD_MULTIPLIER;

      if (absChange < threshold) continue;

      // Check for dedup
      const dedupKey = `fred-${series.id}-${latest.date}`;
      const existing = await knex("signals")
        .where({ source_provider: "fred", raw_source: dedupKey })
        .first();
      if (existing) continue;

      const sigmas = stdDev ? (absChange / stdDev).toFixed(1) : null;
      const direction = change > 0 ? "rose" : "fell";
      const magnitude = sigmas
        ? `${sigmas}σ move`
        : `${absChange.toFixed(2)}${series.unit} change`;

      const title = `${series.label} ${direction} to ${latest.value.toFixed(2)}${series.unit} (${magnitude})`;
      const description = [
        `${series.label} ${direction} from ${previous.value.toFixed(2)}${series.unit} to ${latest.value.toFixed(2)}${series.unit}.`,
        `Change: ${change >= 0 ? "+" : ""}${change.toFixed(3)}${series.unit} (${magnitude}).`,
        `Release date: ${latest.date}.`,
        stdDev
          ? `Historical std dev of changes: ${stdDev.toFixed(3)}${series.unit} (${observations.length} observations).`
          : "",
        `Threshold: ${threshold.toFixed(3)}${series.unit}.`,
      ]
        .filter(Boolean)
        .join(" ");

      const id = uuidv4();
      const now = new Date().toISOString();

      await knex("signals").insert({
        id,
        user_id: "default",
        created_at: now,
        updated_at: now,
        category: series.category,
        subcategory: series.id,
        title,
        description,
        raw_source: dedupKey,
        source_type: "fred",
        source_provider: "fred",
        source_url: null,
        source_attribution: `FRED (Federal Reserve) — ${series.id}`,
        novelty: "new",
        reliability: "verified",
        signal_strength: Math.min(1, absChange / (threshold * 3)),
        thesis_id: null,
        related_signal_ids: [],
        status: "inbox",
        tags: ["auto", "fred", series.id.toLowerCase()],
      });

      created.push({ id, title, series: series.id });
      console.log(`[FRED Signals] Created: ${title}`);
    } catch (err) {
      console.warn(`[FRED Signals] Failed for ${series.id}: ${err.message}`);
    }
  }

  if (created.length === 0) {
    console.log("[FRED Signals] No significant changes detected.");
  }

  return created;
}
