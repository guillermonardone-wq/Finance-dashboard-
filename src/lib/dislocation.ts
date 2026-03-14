// ──────────────────────────────────────────────
// Dislocation Score (0–100)
// ──────────────────────────────────────────────
// Combines four signals into a weighted composite:
//   1. Rapid probability change  (weight 30)
//   2. Wide spread               (weight 25)
//   3. Thin liquidity            (weight 25)
//   4. Unusual volume            (weight 20)
// Each sub-score is 0–1, then combined and scaled to 0–100.
// ──────────────────────────────────────────────

export interface DislocationInput {
  currentYes: number;
  previousYes: number | null; // null if no prior snapshot
  spread: number;             // absolute spread
  liquidity: number;          // USD
  volume24h: number;          // USD
  avgVolume: number;          // rolling average volume across all markets
  avgLiquidity: number;       // rolling average liquidity across all markets
}

export function calculateDislocation(input: DislocationInput): number {
  const {
    currentYes,
    previousYes,
    spread,
    liquidity,
    volume24h,
    avgVolume,
    avgLiquidity,
  } = input;

  // 1. Rapid probability change — big move = higher score
  let changeScore = 0;
  if (previousYes !== null) {
    const delta = Math.abs(currentYes - previousYes);
    changeScore = Math.min(delta / 0.15, 1); // 15-cent move = max
  }

  // 2. Wide spread — wider = higher score
  const spreadScore = Math.min(spread / 0.10, 1); // 10-cent spread = max

  // 3. Thin liquidity — lower relative to average = higher score
  let liquidityScore = 0;
  if (avgLiquidity > 0) {
    const ratio = liquidity / avgLiquidity;
    liquidityScore = Math.max(0, Math.min(1, 1 - ratio)); // below avg → high
  }

  // 4. Unusual volume — higher relative to average = higher score
  let volumeScore = 0;
  if (avgVolume > 0) {
    const ratio = volume24h / avgVolume;
    volumeScore = Math.min((ratio - 1) / 3, 1); // 4× average = max
    volumeScore = Math.max(0, volumeScore);
  }

  const weighted =
    changeScore * 30 +
    spreadScore * 25 +
    liquidityScore * 25 +
    volumeScore * 20;

  return Math.round(Math.min(100, Math.max(0, weighted)));
}
