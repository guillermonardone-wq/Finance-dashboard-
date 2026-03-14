// ──────────────────────────────────────────────
// Cluster Signal Engine (Phase 2)
// ──────────────────────────────────────────────
// Rules-based detection of interesting patterns.
// Each rule checks a condition and emits a signal
// with type, severity, and human-readable message.
// ──────────────────────────────────────────────

export interface SignalMember {
  title: string;
  yesPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  dislocationScore: number;
}

export interface Signal {
  type: "disagreement" | "reprice_lag" | "thin_liquidity" | "unusual_activity";
  severity: "low" | "medium" | "high";
  message: string;
  data: Record<string, unknown>;
}

export function detectClusterSignals(
  members: SignalMember[],
  avgProbability: number,
  probabilityDispersion: number
): Signal[] {
  const signals: Signal[] = [];

  if (members.length < 2) return signals;

  // ── Rule 1: Disagreement ──
  // Markets in the same cluster have very different implied probabilities
  const prices = members.map((m) => m.yesPrice);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice;

  if (priceRange >= 0.30) {
    const high = members.find((m) => m.yesPrice === maxPrice)!;
    const low = members.find((m) => m.yesPrice === minPrice)!;
    signals.push({
      type: "disagreement",
      severity: priceRange >= 0.45 ? "high" : "medium",
      message: `Strong disagreement: "${high.title}" at ${(maxPrice * 100).toFixed(0)}% vs "${low.title}" at ${(minPrice * 100).toFixed(0)}% — ${(priceRange * 100).toFixed(0)}¢ spread across related markets.`,
      data: { maxPrice, minPrice, priceRange, highMarket: high.title, lowMarket: low.title },
    });
  } else if (probabilityDispersion >= 0.10) {
    signals.push({
      type: "disagreement",
      severity: "low",
      message: `Moderate dispersion across cluster: std dev ${(probabilityDispersion * 100).toFixed(1)}¢ around ${(avgProbability * 100).toFixed(0)}% average.`,
      data: { probabilityDispersion, avgProbability },
    });
  }

  // ── Rule 2: Reprice Lag ──
  // One market has repriced much faster (higher dislocation) than the others
  const dislocations = members.map((m) => m.dislocationScore);
  const maxDis = Math.max(...dislocations);
  const avgDis = dislocations.reduce((s, d) => s + d, 0) / dislocations.length;

  if (maxDis >= 40 && maxDis - avgDis >= 20) {
    const laggard = members.find((m) => m.dislocationScore === maxDis)!;
    signals.push({
      type: "reprice_lag",
      severity: maxDis >= 60 ? "high" : "medium",
      message: `"${laggard.title}" is repricing fast (score ${maxDis}) while cluster average is ${avgDis.toFixed(0)} — other related markets may follow.`,
      data: { fastMover: laggard.title, fastScore: maxDis, avgScore: avgDis },
    });
  }

  // ── Rule 3: Thin Liquidity ──
  // One or more members have very low liquidity, making prices unreliable
  const thinMembers = members.filter((m) => m.liquidity < 500_000);
  if (thinMembers.length > 0) {
    const names = thinMembers.map((m) => m.title);
    const minLiq = Math.min(...thinMembers.map((m) => m.liquidity));
    signals.push({
      type: "thin_liquidity",
      severity: minLiq < 200_000 ? "high" : thinMembers.length > 1 ? "medium" : "low",
      message: `${thinMembers.length} market(s) in this cluster have thin liquidity (< $500K) — prices may not be reliable.`,
      data: { thinCount: thinMembers.length, markets: names, minLiquidity: minLiq },
    });
  }

  // ── Rule 4: Unusual Activity ──
  // Cluster-wide volume spike: avg volume is high relative to avg liquidity
  const avgVolume = members.reduce((s, m) => s + m.volume24h, 0) / members.length;
  const avgLiquidity = members.reduce((s, m) => s + m.liquidity, 0) / members.length;
  const turnover = avgLiquidity > 0 ? avgVolume / avgLiquidity : 0;

  if (turnover >= 0.3) {
    signals.push({
      type: "unusual_activity",
      severity: turnover >= 0.5 ? "high" : "medium",
      message: `High cluster turnover: average 24h volume is ${(turnover * 100).toFixed(0)}% of average liquidity — unusual activity across related markets.`,
      data: { avgVolume, avgLiquidity, turnover },
    });
  }

  return signals;
}
