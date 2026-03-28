// ============================================================
// SIGNAL RULES — Deterministic direction + significance logic
// ============================================================
// No AI. Pure rule-based inference from category, entity, and change.
// ============================================================

/**
 * Direction rules: entity + change → bullish / bearish / neutral.
 *
 * Rules are additive: first matching rule wins.
 * Falls back to change-sign heuristic.
 */
const DIRECTION_RULES = [
  // FRED series with clear directional implication
  { entity: /FEDERAL_FUNDS_RATE|FEDFUNDS/i, pos: "bearish", neg: "bullish", note: "Rate hikes → bearish equities" },
  { entity: /CPI|INFLATION/i,              pos: "bearish", neg: "bullish", note: "Rising inflation → bearish bonds/equities" },
  { entity: /GDP|GROWTH/i,                 pos: "bullish", neg: "bearish", note: "GDP growth → bullish" },
  { entity: /UNEMPLOYMENT|UNRATE/i,        pos: "bearish", neg: "bullish", note: "Rising unemployment → bearish" },
  { entity: /TREASURY_10Y|DGS10/i,         pos: "bearish", neg: "bullish", note: "Rising yields → bearish bonds" },
  { entity: /TREASURY_2Y|DGS2/i,           pos: "bearish", neg: "bullish", note: "Rising short yields → tightening" },

  // Market assets
  { entity: /^(SPY|QQQ|IWM|EEM)$/i,  pos: "bullish", neg: "bearish", note: "Equity index up → bullish" },
  { entity: /^(TLT|BND|AGG)$/i,      pos: "bullish", neg: "bearish", note: "Bond price up → bullish bonds" },
  { entity: /^(GLD|GC)$/i,           pos: "bullish", neg: "bearish", note: "Gold up → risk-off signal" },
  { entity: /^(CL|USO|XLE)$/i,       pos: "bullish", neg: "bearish", note: "Oil up → energy bullish" },
  { entity: /^(DX|UUP)$/i,           pos: "bearish", neg: "bullish", note: "Dollar up → bearish EM/commodities" },
  { entity: /^VIX$/i,                pos: "bearish", neg: "bullish", note: "VIX up → bearish risk sentiment" },

  // FX pairs
  { entity: /USD.?JPY/i, pos: "bearish", neg: "bullish", note: "Strong dollar vs yen" },
  { entity: /EUR.?USD/i, pos: "bullish", neg: "bearish", note: "Euro strength → bullish Europe" },

  // Category fallbacks
  { category: /central_bank_action/i, pos: "bearish", neg: "bullish", note: "Tightening actions default bearish" },
  { category: /credit_stress/i,       pos: "bearish", neg: "neutral", note: "Credit stress rising → bearish" },
  { category: /geopolitical/i,        pos: "bearish", neg: "neutral", note: "Geopolitical escalation default bearish" },
  { category: /energy_bottleneck/i,   pos: "bearish", neg: "neutral", note: "Energy disruption default bearish" },
  { category: /policy_shock/i,        pos: "neutral", neg: "bearish", note: "Policy shock direction ambiguous" },
];

/**
 * Determine direction from entity/category and change value.
 *
 * @param {string} category
 * @param {string} entity
 * @param {number} change
 * @returns {"bullish"|"bearish"|"neutral"}
 */
export function computeDirection(category, entity, change) {
  if (change == null || change === 0) return "neutral";

  for (const rule of DIRECTION_RULES) {
    const entityMatch = rule.entity ? rule.entity.test(entity || "") : false;
    const categoryMatch = rule.category ? rule.category.test(category || "") : false;

    if (entityMatch || categoryMatch) {
      return change > 0 ? rule.pos : rule.neg;
    }
  }

  // Fallback: positive change → bullish, negative → bearish
  return change > 0 ? "bullish" : "bearish";
}

/**
 * Compute significance on 1–5 scale.
 *
 * If stdDev and sigmas are available (e.g., FRED), use statistical significance.
 * Otherwise, use absolute change magnitude.
 *
 * @param {number} absChange
 * @param {number|null} stdDev
 * @param {number|null} sigmas
 * @returns {number} 1–5
 */
export function computeSignificance(absChange, stdDev, sigmas) {
  if (sigmas != null) {
    // Statistical significance based on standard deviations
    if (sigmas >= 3.0) return 5;
    if (sigmas >= 2.0) return 4;
    if (sigmas >= 1.5) return 3;
    if (sigmas >= 1.0) return 2;
    return 1;
  }

  // Heuristic: based on absolute change magnitude
  if (absChange === 0) return 1;
  if (absChange >= 5) return 5;
  if (absChange >= 2) return 4;
  if (absChange >= 1) return 3;
  if (absChange >= 0.5) return 2;
  return 1;
}
