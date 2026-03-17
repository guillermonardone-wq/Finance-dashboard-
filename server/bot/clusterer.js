// ============================================================
// SIGNAL CLUSTERER — Groups related candidate signals
// ============================================================
// Groups by: shared entities, geography, category, temporal proximity,
// and market implications.
//
// Critical rule: repeated coverage of the same event must NOT
// artificially inflate cluster strength. Independence matters.
// Volume of coverage ≠ independent confirmation.
// ============================================================

import { validateSignalCluster, CLUSTER_STRENGTH_LEVELS } from "./types.js";

/**
 * Cluster candidate signals into coherent groups.
 * @param {Array} candidates - CandidateSignal objects from Scout
 * @param {Object} options - { timeWindowHours: 72, minSimilarity: 0.3 }
 * @returns {Array} SignalCluster objects
 */
export function clusterSignals(candidates, options = {}) {
  const { timeWindowHours = 72, minSimilarity = 0.3 } = options;

  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [buildCluster([candidates[0]])];
  }

  // Build similarity matrix
  const clusters = [];
  const assigned = new Set();

  // Sort by detected_at descending (newest first)
  const sorted = [...candidates].sort(
    (a, b) =>
      new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
  );

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue;

    const clusterMembers = [sorted[i]];
    assigned.add(i);

    for (let j = i + 1; j < sorted.length; j++) {
      if (assigned.has(j)) continue;

      const similarity = computeSimilarity(
        sorted[i],
        sorted[j],
        timeWindowHours,
      );
      if (similarity >= minSimilarity) {
        clusterMembers.push(sorted[j]);
        assigned.add(j);
      }
    }

    clusters.push(buildCluster(clusterMembers));
  }

  // Validate all clusters
  return clusters.map((c) => {
    const result = validateSignalCluster(c);
    return result.normalized;
  });
}

/**
 * Compute similarity between two candidate signals.
 * Returns 0-1 score based on shared attributes.
 */
function computeSimilarity(a, b, timeWindowHours) {
  let score = 0;
  let maxScore = 0;

  // Category overlap (weight: 0.3)
  maxScore += 0.3;
  const catOverlap = setOverlap(a.categories || [], b.categories || []);
  score += catOverlap * 0.3;

  // Geography overlap (weight: 0.25)
  maxScore += 0.25;
  const geoOverlap = setOverlap(a.geographies || [], b.geographies || []);
  score += geoOverlap * 0.25;

  // Entity overlap (weight: 0.2)
  maxScore += 0.2;
  const entityOverlap = setOverlap(a.entities || [], b.entities || []);
  score += entityOverlap * 0.2;

  // Market symbol overlap (weight: 0.15)
  maxScore += 0.15;
  const symbolOverlap = setOverlap(
    a.linked_market_symbols || [],
    b.linked_market_symbols || [],
  );
  score += symbolOverlap * 0.15;

  // Temporal proximity (weight: 0.1)
  maxScore += 0.1;
  const hoursDiff =
    Math.abs(
      new Date(a.detected_at).getTime() - new Date(b.detected_at).getTime(),
    ) /
    (1000 * 3600);
  if (hoursDiff <= timeWindowHours) {
    score += (1 - hoursDiff / timeWindowHours) * 0.1;
  }

  return maxScore > 0 ? score / maxScore : 0;
}

function setOverlap(a, b) {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(
    a.map((x) => (typeof x === "string" ? x : JSON.stringify(x)).toLowerCase()),
  );
  const setB = new Set(
    b.map((x) => (typeof x === "string" ? x : JSON.stringify(x)).toLowerCase()),
  );
  const intersection = [...setA].filter((x) => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.length / union.size : 0;
}

/**
 * Build a cluster from a set of candidate signals.
 * Assesses strength based on independence, not volume.
 */
function buildCluster(members) {
  // Determine independent source count (distinct source attributions)
  const sourceAttributions = new Set();
  const sourceTypes = new Set();
  for (const m of members) {
    for (const ref of m.source_refs || []) {
      if (ref.attribution)
        sourceAttributions.add(ref.attribution.toLowerCase());
      if (ref.type) sourceTypes.add(ref.type);
    }
  }
  const independentSourceCount = sourceAttributions.size;

  // Merge categories, geographies, entities, symbols
  const allCategories = [
    ...new Set(members.flatMap((m) => m.categories || [])),
  ];
  const allGeographies = [
    ...new Set(members.flatMap((m) => m.geographies || [])),
  ];
  const allEntities = [...new Set(members.flatMap((m) => m.entities || []))];
  const allSymbols = [
    ...new Set(members.flatMap((m) => m.linked_market_symbols || [])),
  ];

  // Determine cluster strength based on independence
  let strength = "weak";
  if (independentSourceCount >= 4 && sourceTypes.size >= 3)
    strength = "significant";
  else if (independentSourceCount >= 3 && sourceTypes.size >= 2)
    strength = "strong";
  else if (independentSourceCount >= 2) strength = "moderate";
  else if (members.length >= 3) strength = "emerging";

  // Check for duplicate inflation
  const duplicatePenalty =
    members.length > 2 && independentSourceCount < members.length * 0.4;

  // Compute novelty (max of members, penalized for duplicates)
  let novelty = Math.max(...members.map((m) => m.novelty_score || 0.5));
  if (duplicatePenalty) novelty = Math.max(0, novelty - 0.15);

  // Confidence range: widen as cluster grows but penalize duplicates
  const bestConfidence = members.reduce(
    (max, m) => Math.max(max, m.confidence_range?.best || 0.3),
    0,
  );
  const confidence_range = {
    low: Math.max(0.05, bestConfidence - 0.25),
    high: Math.min(0.9, bestConfidence + independentSourceCount * 0.05),
    best: duplicatePenalty ? bestConfidence * 0.8 : bestConfidence,
  };

  // Determine timestamps
  const timestamps = members.map((m) => new Date(m.detected_at).getTime());
  const firstDetected = new Date(Math.min(...timestamps)).toISOString();
  const latestUpdate = new Date(Math.max(...timestamps)).toISOString();

  // Build title from most common category + geography
  const primaryCategory = allCategories[0] || "signal";
  const primaryGeo = allGeographies[0] || "";
  const title = `${primaryCategory.replace(/_/g, " ")}${primaryGeo ? " — " + primaryGeo : ""} (${members.length} signals)`;

  // Build summary
  const summaryParts = members.slice(0, 3).map((m) => m.title);
  const summary =
    summaryParts.join(" | ") +
    (members.length > 3 ? ` (+${members.length - 3} more)` : "");

  return {
    title,
    summary,
    member_signal_ids: members.map((m) => m.id),
    primary_entities: allEntities,
    primary_geographies: allGeographies,
    categories: allCategories,
    cluster_strength: strength,
    cluster_novelty: novelty,
    first_detected_at: firstDetected,
    latest_update_at: latestUpdate,
    confidence_range,
    signal_count: members.length,
    independent_source_count: independentSourceCount,
    duplicate_penalty_applied: duplicatePenalty,
    notes: duplicatePenalty
      ? `Duplicate penalty applied: ${members.length} signals from only ${independentSourceCount} independent sources.`
      : "",
  };
}
