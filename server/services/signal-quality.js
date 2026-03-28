// ============================================================
// SIGNAL QUALITY — Filter, score, and consolidate signals
// ============================================================
// Deterministic quality gate. No AI.
//
// Pipeline position: normalizer → quality filter → dedup → DB
// ============================================================

// ---- CATEGORY IMPORTANCE WEIGHTS ----
// Higher = more important to track. Used in scoring.
const CATEGORY_WEIGHT = {
  military_mobilization: 9,
  geopolitical_escalation: 9,
  shipping_disruption: 8,
  energy_bottleneck: 8,
  sanctions_risk: 7,
  central_bank_action: 7,
  currency_instability: 6,
  credit_stress: 6,
  policy_shock: 5,
  commodity_chokepoint: 5,
  market_complacency: 4,
  supply_chain: 4,
  election_political: 3,
  market_data: 3,
  other: 2,
};

// ---- QUALITY FILTER ----

/**
 * Determine if a normalized signal passes the quality gate.
 *
 * @param {object} signal - normalized signal
 * @param {object} [options]
 * @param {number} [options.minSignificance=2] - minimum significance to pass
 * @returns {{ pass: boolean, reason?: string }}
 */
export function qualityFilter(signal, { minSignificance = 2 } = {}) {
  if (!signal) return { pass: false, reason: "null_signal" };

  // Must have a title
  if (!signal.title || !signal.title.trim()) {
    return { pass: false, reason: "missing_title" };
  }

  // Significance gate (numeric signals only — news gets a pass at sig=2)
  if (signal.significance != null && signal.significance < minSignificance) {
    return { pass: false, reason: "low_significance" };
  }

  // Zero-change gate: skip numeric signals with no meaningful change
  if (signal.value != null && signal.change != null && signal.change === 0 && signal.direction === "neutral") {
    return { pass: false, reason: "zero_change_neutral" };
  }

  return { pass: true };
}

// ---- SIGNAL SCORING ----

/**
 * Compute strength (1–10) and confidence (1–10) for a signal.
 * Deterministic, based on magnitude, category importance, and data quality.
 *
 * @param {object} signal - normalized signal
 * @returns {{ strength: number, confidence: number }}
 */
export function scoreSignal(signal) {
  const catWeight = CATEGORY_WEIGHT[signal.category] || CATEGORY_WEIGHT.other;

  // --- Strength: how big is the move / how important is the event ---
  // Base from significance (1-5 → 2-10 range)
  const sigBase = (signal.significance || 1) * 2;

  // Category boost: high-importance categories get up to +2
  const catBoost = catWeight >= 7 ? 2 : catWeight >= 5 ? 1 : 0;

  // Change magnitude boost for numeric signals
  let changeBoost = 0;
  if (signal.change != null && signal.previous_value != null && signal.previous_value !== 0) {
    const pctChange = Math.abs(signal.change / signal.previous_value) * 100;
    if (pctChange >= 10) changeBoost = 2;
    else if (pctChange >= 5) changeBoost = 1;
  }

  const strength = Math.min(10, Math.max(1, sigBase + catBoost + changeBoost));

  // --- Confidence: how trustworthy is this data ---
  let confidence = 5; // baseline

  // Verified sources get a boost
  if (signal.reliability === "verified") confidence += 2;
  else if (signal.reliability === "likely") confidence += 1;
  else if (signal.reliability === "disputed") confidence -= 2;

  // Numeric signals with both value and previous_value are more concrete
  if (signal.value != null && signal.previous_value != null) confidence += 1;

  // Known providers get a boost
  if (["fred", "worldbank", "finnhub", "alpha_vantage"].includes(signal.source)) confidence += 1;

  // GDELT spike confidence scales with ratio
  if (signal.source === "gdelt" && signal.value != null && signal.previous_value != null) {
    const ratio = signal.previous_value > 0 ? signal.value / signal.previous_value : 1;
    if (ratio >= 3) confidence += 1;
  }

  confidence = Math.min(10, Math.max(1, confidence));

  return { strength, confidence };
}

// ---- SIGNAL CONSOLIDATION ----

/**
 * Consolidate an array of signals: merge same-category + same-direction
 * signals within a time window into a single higher-confidence signal.
 *
 * @param {object[]} signals - array of normalized signals
 * @param {object} [options]
 * @param {number} [options.windowMinutes=30] - merge window in minutes
 * @returns {object[]} consolidated signals (fewer or same count)
 */
export function consolidateSignals(signals, { windowMinutes = 30 } = {}) {
  if (!signals || signals.length <= 1) return signals || [];

  const windowMs = windowMinutes * 60 * 1000;
  const groups = new Map();

  for (const signal of signals) {
    const key = `${signal.category}::${signal.direction || "neutral"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(signal);
  }

  const result = [];

  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Sort by timestamp descending (newest first)
    group.sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

    // Cluster within time window
    const clusters = [];
    let currentCluster = [group[0]];

    for (let i = 1; i < group.length; i++) {
      const prevTime = new Date(currentCluster[0].timestamp || 0).getTime();
      const currTime = new Date(group[i].timestamp || 0).getTime();

      if (Math.abs(prevTime - currTime) <= windowMs) {
        currentCluster.push(group[i]);
      } else {
        clusters.push(currentCluster);
        currentCluster = [group[i]];
      }
    }
    clusters.push(currentCluster);

    // Merge each cluster
    for (const cluster of clusters) {
      if (cluster.length === 1) {
        result.push(cluster[0]);
        continue;
      }

      // Pick the highest-significance signal as the base
      cluster.sort((a, b) => (b.significance || 0) - (a.significance || 0));
      const base = { ...cluster[0] };

      // Boost significance by 1 for having corroborating signals (cap at 5)
      base.significance = Math.min(5, (base.significance || 1) + 1);

      // Append merge note to summary
      const otherSources = cluster
        .slice(1)
        .map((s) => s.source || s.source_provider)
        .filter(Boolean);
      const uniqueSources = [...new Set(otherSources)];
      if (uniqueSources.length > 0) {
        base.summary = `${base.summary || base.title} [Corroborated by ${cluster.length - 1} similar signal${cluster.length > 2 ? "s" : ""} from ${uniqueSources.join(", ")}]`;
      }

      // Mark as consolidated
      base.tags = [...(base.tags || []), "consolidated"];
      base.signal_strength = Math.min(1, (base.signal_strength || 0.5) + 0.1 * (cluster.length - 1));

      result.push(base);
    }
  }

  return result;
}
