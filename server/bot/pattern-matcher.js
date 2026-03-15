// ============================================================
// PATTERN MATCHER — Compares clusters against playbook patterns
// ============================================================
// Pattern match ≠ proof. Similarity to a known setup does NOT
// mean the setup will play out the same way.
//
// The matcher explicitly tracks:
// - what matched (precursors present)
// - what's missing (expected confirmations absent)
// - false positive overlap (known ways this pattern fails)
// ============================================================

import { validatePatternMatch } from './types.js';
import { getDb } from '../db/connection.js';

// Built-in archetype patterns (supplemented by playbook_entries DB table)
const ARCHETYPE_PATTERNS = [
  {
    id: 'energy_chokepoint_disruption',
    name: 'Energy Chokepoint Disruption',
    category: 'energy_bottleneck',
    precursors: [
      { description: 'Military activity near chokepoint', categories: ['military_mobilization', 'conflict_kinetic'] },
      { description: 'Shipping insurance rate increase', categories: ['shipping_disruption'] },
      { description: 'Geopolitical escalation in region', categories: ['geopolitical_escalation'] },
      { description: 'Oil/energy market complacency', categories: ['market_complacency', 'energy_bottleneck'] },
    ],
    expected_confirmations: [
      'Actual tanker rerouting or avoidance',
      'Physical crude spot premium over futures',
      'Government or military advisories for shipping lanes',
      'Insurance industry formal war-risk zone designation',
    ],
    common_false_positives: [
      'Routine military exercises presented as escalation',
      'Diplomatic rhetoric without operational follow-through',
      'Insurance rate increase driven by unrelated incidents',
      'Short-lived disruptions that resolve within 48 hours',
    ],
    typical_assets: ['CL', 'USO', 'XLE', 'NG', 'shipping stocks'],
    typical_timeline: '1-4 weeks from first signs to peak impact',
  },
  {
    id: 'central_bank_surprise',
    name: 'Central Bank Policy Surprise',
    category: 'central_bank_action',
    precursors: [
      { description: 'Inflation data above expectations', categories: ['central_bank_action', 'policy_shock'] },
      { description: 'Political pressure on central bank', categories: ['election_political', 'policy_shock'] },
      { description: 'Forward guidance language shift', categories: ['central_bank_action'] },
      { description: 'Currency weakness accelerating', categories: ['currency_instability'] },
    ],
    expected_confirmations: [
      'Central bank meeting minutes showing dissent',
      'Unofficial briefings suggesting accelerated timeline',
      'Rate market repricing (futures, swaps)',
      'Bond market volatility increase',
    ],
    common_false_positives: [
      'Dovish central bank culture overrides hawkish signals',
      'External shock reverses inflation trajectory',
      'Rate differential closes from the other side',
      'Markets price the shift before the event',
    ],
    typical_assets: ['FX pairs', 'bond futures', 'rate-sensitive equities'],
    typical_timeline: '2-8 weeks around meeting dates',
  },
  {
    id: 'sanctions_escalation',
    name: 'Sanctions Escalation Cycle',
    category: 'sanctions_risk',
    precursors: [
      { description: 'Diplomatic deterioration', categories: ['geopolitical_escalation', 'diplomatic_shift'] },
      { description: 'Initial sanctions or threats', categories: ['sanctions_risk'] },
      { description: 'Target country provocation', categories: ['military_mobilization', 'conflict_kinetic'] },
      { description: 'Allied coordination signals', categories: ['geopolitical_escalation'] },
    ],
    expected_confirmations: [
      'Draft sanctions package leaked or announced',
      'Secondary sanctions threatened',
      'Target country retaliatory measures',
      'Commodity supply chain rerouting',
    ],
    common_false_positives: [
      'Sanctions announced but with extensive carve-outs',
      'Enforcement is weak or delayed',
      'Target country finds alternative trade routes quickly',
      'Market has already priced worst-case scenario',
    ],
    typical_assets: ['affected commodities', 'target country FX/equities', 'shipping'],
    typical_timeline: '2-12 weeks from initial signals to implementation',
  },
  {
    id: 'geopolitical_crisis_escalation',
    name: 'Geopolitical Crisis Escalation',
    category: 'geopolitical_escalation',
    precursors: [
      { description: 'Diplomatic breakdown or recall of envoys', categories: ['geopolitical_escalation', 'diplomatic_shift'] },
      { description: 'Military mobilization or repositioning', categories: ['military_mobilization'] },
      { description: 'Intelligence community warnings', categories: ['geopolitical_escalation'] },
      { description: 'Civilian evacuation advisories', categories: ['geopolitical_escalation'] },
    ],
    expected_confirmations: [
      'Sustained military buildup (not just exercises)',
      'UN Security Council emergency sessions',
      'Allied military coordination',
      'Commercial aviation route changes',
    ],
    common_false_positives: [
      'Routine military exercises misinterpreted as mobilization',
      'Brinksmanship without intent to follow through',
      'Back-channel diplomacy resolving tension before escalation',
      'Media amplification beyond actual operational significance',
    ],
    typical_assets: ['safe havens (GC, CHF, JPY, UST)', 'regional equities', 'defense stocks', 'energy'],
    typical_timeline: '1-6 weeks for crisis arc',
  },
  {
    id: 'currency_crisis',
    name: 'Emerging Market Currency Crisis',
    category: 'currency_instability',
    precursors: [
      { description: 'Rapid FX depreciation', categories: ['currency_instability'] },
      { description: 'Capital outflow acceleration', categories: ['currency_instability', 'credit_stress'] },
      { description: 'Central bank reserves declining', categories: ['central_bank_action'] },
      { description: 'Political instability or policy misstep', categories: ['election_political', 'policy_shock'] },
    ],
    expected_confirmations: [
      'Emergency rate hike',
      'Capital controls imposed or discussed',
      'IMF involvement or discussion',
      'Contagion to neighboring currencies',
    ],
    common_false_positives: [
      'Orderly managed depreciation mistaken for crisis',
      'Central bank has sufficient reserves to defend',
      'External support package prevents collapse',
      'Currency weakness driven by global USD strength, not local crisis',
    ],
    typical_assets: ['target FX pair', 'EM sovereign bonds', 'EEM', 'contagion currencies'],
    typical_timeline: '1-8 weeks from first signs to resolution attempt',
  },
];

/**
 * Match a signal cluster against known patterns.
 * @param {Object} cluster - Validated SignalCluster
 * @returns {Object|null} Best PatternMatch or null if no match
 */
export function matchPatterns(cluster) {
  const clusterCategories = new Set(cluster.categories || []);
  const matches = [];

  // Check against archetypes
  for (const pattern of ARCHETYPE_PATTERNS) {
    const result = scorePatternMatch(cluster, pattern, clusterCategories);
    if (result.match_score >= 0.2) {
      matches.push(result);
    }
  }

  // Check against DB playbook entries
  try {
    const db = getDb();
    const playbooks = db.prepare('SELECT * FROM playbook_entries WHERE status = ?').all('active');
    for (const pb of playbooks) {
      const triggers = JSON.parse(pb.trigger_conditions || '[]');
      const assets = JSON.parse(pb.typical_assets || '[]');
      const mistakes = JSON.parse(pb.common_mistakes || '[]');

      const syntheticPattern = {
        id: pb.id,
        name: pb.title,
        category: pb.category,
        precursors: triggers.map(t => ({ description: t, categories: [pb.category] })),
        expected_confirmations: [],
        common_false_positives: mistakes,
        typical_assets: assets,
      };

      const result = scorePatternMatch(cluster, syntheticPattern, clusterCategories);
      if (result.match_score >= 0.2) {
        matches.push(result);
      }
    }
  } catch {
    // DB not available, continue with archetypes only
  }

  if (matches.length === 0) return null;

  // Return best match
  matches.sort((a, b) => b.match_score - a.match_score);
  const best = matches[0];

  const validated = validatePatternMatch(best);
  return validated.normalized;
}

function scorePatternMatch(cluster, pattern, clusterCategories) {
  // Score precursor matches
  let precursorHits = 0;
  const matchedPrecursors = [];
  const missingPrecursors = [];

  for (const precursor of pattern.precursors) {
    const hit = precursor.categories.some(c => clusterCategories.has(c));
    if (hit) {
      precursorHits++;
      matchedPrecursors.push(precursor.description);
    } else {
      missingPrecursors.push(precursor.description);
    }
  }

  const precursorScore = pattern.precursors.length > 0
    ? precursorHits / pattern.precursors.length
    : 0;

  // Geography relevance boost
  const geoRelevant = cluster.primary_geographies?.length > 0 ? 0.1 : 0;

  // Cluster strength boost
  const strengthBoost = {
    weak: 0, emerging: 0.05, moderate: 0.1, strong: 0.15, significant: 0.2,
  }[cluster.cluster_strength] || 0;

  // False positive overlap
  const fpOverlap = pattern.common_false_positives.length > 0
    ? Math.min(1, missingPrecursors.length / pattern.common_false_positives.length)
    : 0;

  const match_score = Math.min(1, precursorScore * 0.6 + geoRelevant + strengthBoost);

  return {
    cluster_id: cluster.id,
    playbook_pattern_id: pattern.id,
    pattern_name: pattern.name,
    match_score: Math.round(match_score * 100) / 100,
    matched_precursors: matchedPrecursors,
    missing_confirmations: [
      ...missingPrecursors.map(p => `Precursor: ${p}`),
      ...(pattern.expected_confirmations || []).map(c => `Confirmation: ${c}`),
    ],
    common_false_positives: pattern.common_false_positives || [],
    likely_affected_assets: pattern.typical_assets || [],
    false_positive_overlap: Math.round(fpOverlap * 100) / 100,
    notes: `Matched ${precursorHits}/${pattern.precursors.length} precursors. Timeline: ${pattern.typical_timeline || 'unknown'}.`,
  };
}
