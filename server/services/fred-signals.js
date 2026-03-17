// ============================================================
// FRED SIGNAL GENERATOR — Creates signals from significant FRED data changes
// ============================================================
// Monitors 5 market-moving FRED series. When the latest release
// deviates from the previous value by more than a configurable
// threshold (default: 1 standard deviation of historical changes),
// auto-creates a signal.

import { v4 as uuidv4 } from 'uuid';
import { registry } from '../providers/registry.js';
import { getDb } from '../db/connection.js';

// The 5 most market-moving FRED series
const FRED_SIGNAL_SERIES = [
  {
    id: 'FEDERAL_FUNDS_RATE',
    label: 'Fed Funds Rate',
    category: 'central_bank_action',
    unit: '%',
    // Default threshold: absolute change that counts as significant
    // Will be overridden by computed std dev if enough history exists
    defaultThreshold: 0.25,
  },
  {
    id: 'US_CPI_YOY',
    label: 'CPI Year-over-Year',
    category: 'currency_instability',
    unit: '%',
    defaultThreshold: 0.3,
  },
  {
    id: 'US_GDP_GROWTH',
    label: 'Real GDP Growth Rate',
    category: 'policy_shock',
    unit: '%',
    defaultThreshold: 0.5,
  },
  {
    id: 'US_UNEMPLOYMENT',
    label: 'Unemployment Rate',
    category: 'policy_shock',
    unit: '%',
    defaultThreshold: 0.2,
  },
  {
    id: 'US_TREASURY_10Y',
    label: '10-Year Treasury Yield',
    category: 'credit_stress',
    unit: '%',
    defaultThreshold: 0.15,
  },
];

// Configurable multiplier for threshold (env override)
const THRESHOLD_MULTIPLIER = parseFloat(process.env.FRED_SIGNAL_THRESHOLD_MULT) || 1.0;

function computeStdDev(values) {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
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
  const fredProvider = registry.getProvider('fred');
  if (!fredProvider?.enabled) {
    console.log('[FRED Signals] FRED provider not enabled, skipping.');
    return [];
  }

  const db = getDb();
  const created = [];

  for (const series of FRED_SIGNAL_SERIES) {
    try {
      // Fetch recent observations (sorted desc by date)
      const observations = await fredProvider.getMacroSeries(series.id);
      if (!observations || observations.length < 2) continue;

      const latest = observations[0];
      const previous = observations[1];
      const change = latest.value - previous.value;
      const absChange = Math.abs(change);

      // Compute threshold from historical standard deviation of changes
      const historicalChanges = computeChanges(observations);
      const stdDev = computeStdDev(historicalChanges);
      const threshold = stdDev != null
        ? stdDev * THRESHOLD_MULTIPLIER
        : series.defaultThreshold * THRESHOLD_MULTIPLIER;

      // Skip if change is below threshold
      if (absChange < threshold) continue;

      // Check for dedup — don't create duplicate signal for same data point
      const dedupKey = `fred-${series.id}-${latest.date}`;
      const existing = db.prepare(
        "SELECT id FROM signals WHERE source_provider = 'fred' AND raw_source = ?"
      ).get(dedupKey);
      if (existing) continue;

      // Determine magnitude description
      const sigmas = stdDev ? (absChange / stdDev).toFixed(1) : null;
      const direction = change > 0 ? 'rose' : 'fell';
      const magnitude = sigmas
        ? `${sigmas}σ move`
        : `${absChange.toFixed(2)}${series.unit} change`;

      const title = `${series.label} ${direction} to ${latest.value.toFixed(2)}${series.unit} (${magnitude})`;
      const description = [
        `${series.label} ${direction} from ${previous.value.toFixed(2)}${series.unit} to ${latest.value.toFixed(2)}${series.unit}.`,
        `Change: ${change >= 0 ? '+' : ''}${change.toFixed(3)}${series.unit} (${magnitude}).`,
        `Release date: ${latest.date}.`,
        stdDev ? `Historical std dev of changes: ${stdDev.toFixed(3)}${series.unit} (${observations.length} observations).` : '',
        `Threshold: ${threshold.toFixed(3)}${series.unit}.`,
      ].filter(Boolean).join(' ');

      const id = uuidv4();
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO signals (
          id, created_at, updated_at, category, subcategory,
          title, description, raw_source, source_type, source_provider,
          source_url, source_attribution, novelty, reliability, signal_strength,
          thesis_id, related_signal_ids, status, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, now, now,
        series.category, series.id,
        title, description, dedupKey,
        'fred', 'fred',
        null, `FRED (Federal Reserve) — ${series.id}`,
        'new', 'verified',
        Math.min(1, absChange / (threshold * 3)), // strength scales with magnitude
        null, JSON.stringify([]),
        'inbox', JSON.stringify(['auto', 'fred', series.id.toLowerCase()])
      );

      created.push({ id, title, series: series.id });
      console.log(`[FRED Signals] Created: ${title}`);
    } catch (err) {
      console.warn(`[FRED Signals] Failed for ${series.id}: ${err.message}`);
    }
  }

  if (created.length === 0) {
    console.log('[FRED Signals] No significant changes detected.');
  }

  return created;
}
