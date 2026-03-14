// ──────────────────────────────────────────────
// Seed script – populates DB with realistic sample markets
// Run: npm run db:seed
// ──────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MARKETS = [
  {
    externalId: "fed-rate-cut-june-2026",
    title: "Will the Fed cut rates at the June 2026 meeting?",
    category: "economics",
    yesPrice: 0.62,
    noPrice: 0.40,
    spread: 0.02,
    volume24h: 840_000,
    liquidity: 2_100_000,
    resolutionDate: new Date("2026-06-18"),
  },
  {
    externalId: "trump-approval-50-july",
    title: "Will Trump approval rating exceed 50% by July 2026?",
    category: "politics",
    yesPrice: 0.28,
    noPrice: 0.74,
    spread: 0.02,
    volume24h: 320_000,
    liquidity: 1_400_000,
    resolutionDate: new Date("2026-07-01"),
  },
  {
    externalId: "btc-above-150k-2026",
    title: "Will Bitcoin be above $150K on Dec 31, 2026?",
    category: "crypto",
    yesPrice: 0.35,
    noPrice: 0.68,
    spread: 0.03,
    volume24h: 1_500_000,
    liquidity: 5_200_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "spacex-starship-orbit-q2",
    title: "Will SpaceX Starship reach orbit by Q2 2026?",
    category: "science",
    yesPrice: 0.78,
    noPrice: 0.24,
    spread: 0.02,
    volume24h: 210_000,
    liquidity: 890_000,
    resolutionDate: new Date("2026-06-30"),
  },
  {
    externalId: "us-recession-2026",
    title: "Will the US enter a recession in 2026?",
    category: "economics",
    yesPrice: 0.22,
    noPrice: 0.81,
    spread: 0.03,
    volume24h: 680_000,
    liquidity: 3_100_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "ai-passes-bar-exam-2026",
    title: "Will an AI system pass the bar exam with a top 1% score in 2026?",
    category: "technology",
    yesPrice: 0.55,
    noPrice: 0.48,
    spread: 0.03,
    volume24h: 430_000,
    liquidity: 1_800_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "world-cup-2026-brazil",
    title: "Will Brazil win the 2026 FIFA World Cup?",
    category: "sports",
    yesPrice: 0.18,
    noPrice: 0.84,
    spread: 0.02,
    volume24h: 950_000,
    liquidity: 4_300_000,
    resolutionDate: new Date("2026-07-19"),
  },
  {
    externalId: "eu-carbon-tax-60-2026",
    title: "Will EU carbon price exceed €60 by end of 2026?",
    category: "economics",
    yesPrice: 0.41,
    noPrice: 0.62,
    spread: 0.03,
    volume24h: 120_000,
    liquidity: 560_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "nvidia-stock-above-200",
    title: "Will NVIDIA stock close above $200 by March 2026?",
    category: "finance",
    yesPrice: 0.72,
    noPrice: 0.31,
    spread: 0.03,
    volume24h: 2_100_000,
    liquidity: 7_800_000,
    resolutionDate: new Date("2026-03-31"),
  },
  {
    externalId: "california-earthquake-6plus",
    title: "Will a 6.0+ earthquake hit California in 2026?",
    category: "science",
    yesPrice: 0.33,
    noPrice: 0.70,
    spread: 0.03,
    volume24h: 85_000,
    liquidity: 340_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "openai-ipo-2026",
    title: "Will OpenAI IPO in 2026?",
    category: "technology",
    yesPrice: 0.15,
    noPrice: 0.88,
    spread: 0.03,
    volume24h: 780_000,
    liquidity: 2_900_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "house-flips-2026-midterms",
    title: "Will the House flip in the 2026 midterms?",
    category: "politics",
    yesPrice: 0.52,
    noPrice: 0.51,
    spread: 0.03,
    volume24h: 1_300_000,
    liquidity: 6_100_000,
    resolutionDate: new Date("2026-11-03"),
  },
];

async function main() {
  console.log("Seeding Event Edge database...\n");

  // Clear existing data
  await prisma.snapshot.deleteMany();
  await prisma.market.deleteMany();

  for (const m of MARKETS) {
    const market = await prisma.market.create({ data: m });

    // Create 5 historical snapshots per market to give dislocation algo some data
    const now = Date.now();
    for (let i = 4; i >= 0; i--) {
      const drift = (Math.random() - 0.5) * 0.08;
      const yp = Math.max(0.01, Math.min(0.99, m.yesPrice + drift));
      const np = Math.max(0.01, Math.min(0.99, 1 - yp + (Math.random() - 0.5) * 0.04));
      await prisma.snapshot.create({
        data: {
          marketId: market.id,
          yesPrice: parseFloat(yp.toFixed(3)),
          noPrice: parseFloat(np.toFixed(3)),
          spread: parseFloat((Math.abs(yp - (1 - np))).toFixed(3)),
          volume24h: m.volume24h * (0.7 + Math.random() * 0.6),
          liquidity: m.liquidity * (0.8 + Math.random() * 0.4),
          capturedAt: new Date(now - i * 3_600_000), // 1 hour apart
        },
      });
    }

    console.log(`  ✓ ${market.title}`);
  }

  // Compute dislocation scores
  const allMarkets = await prisma.market.findMany({
    include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 2 } },
  });

  const avgVolume =
    allMarkets.reduce((s, m) => s + m.volume24h, 0) / allMarkets.length;
  const avgLiquidity =
    allMarkets.reduce((s, m) => s + m.liquidity, 0) / allMarkets.length;

  for (const mkt of allMarkets) {
    const prev = mkt.snapshots[1] ?? null;
    const changeScore = prev
      ? Math.min(Math.abs(mkt.yesPrice - prev.yesPrice) / 0.15, 1)
      : 0;
    const spreadScore = Math.min(mkt.spread / 0.1, 1);
    const liqScore =
      avgLiquidity > 0
        ? Math.max(0, Math.min(1, 1 - mkt.liquidity / avgLiquidity))
        : 0;
    let volScore =
      avgVolume > 0
        ? Math.min((mkt.volume24h / avgVolume - 1) / 3, 1)
        : 0;
    volScore = Math.max(0, volScore);

    const score = Math.round(
      changeScore * 30 + spreadScore * 25 + liqScore * 25 + volScore * 20
    );

    await prisma.market.update({
      where: { id: mkt.id },
      data: { dislocationScore: Math.min(100, Math.max(0, score)) },
    });
  }

  console.log(`\nSeeded ${MARKETS.length} markets with snapshots and scores.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
