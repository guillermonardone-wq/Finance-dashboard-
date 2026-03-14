// ──────────────────────────────────────────────
// Seed script – Phase 1 markets + Phase 2 clusters + Phase 3 signals
// Run: npm run db:seed
// ──────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { computeCluster } from "../src/lib/cluster-compute";

const prisma = new PrismaClient();

// ── Phase 1 Markets ──

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
  // ── Phase 2 additions: more markets to make clusters richer ──
  {
    externalId: "btc-above-120k-q2-2026",
    title: "Will Bitcoin be above $120K by Q2 2026?",
    category: "crypto",
    yesPrice: 0.58,
    noPrice: 0.45,
    spread: 0.03,
    volume24h: 980_000,
    liquidity: 3_400_000,
    resolutionDate: new Date("2026-06-30"),
  },
  {
    externalId: "btc-above-100k-march-2026",
    title: "Will Bitcoin stay above $100K through March 2026?",
    category: "crypto",
    yesPrice: 0.82,
    noPrice: 0.20,
    spread: 0.02,
    volume24h: 2_200_000,
    liquidity: 8_100_000,
    resolutionDate: new Date("2026-03-31"),
  },
  {
    externalId: "fed-rate-cut-sept-2026",
    title: "Will the Fed cut rates at the September 2026 meeting?",
    category: "economics",
    yesPrice: 0.48,
    noPrice: 0.55,
    spread: 0.03,
    volume24h: 520_000,
    liquidity: 1_700_000,
    resolutionDate: new Date("2026-09-17"),
  },
  {
    externalId: "fed-rates-below-4-eoy-2026",
    title: "Will the Fed funds rate be below 4% by end of 2026?",
    category: "economics",
    yesPrice: 0.30,
    noPrice: 0.73,
    spread: 0.03,
    volume24h: 410_000,
    liquidity: 1_500_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "oil-above-100-2026",
    title: "Will oil prices exceed $100/barrel in 2026?",
    category: "economics",
    yesPrice: 0.25,
    noPrice: 0.78,
    spread: 0.03,
    volume24h: 350_000,
    liquidity: 1_200_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "mideast-escalation-2026",
    title: "Will there be a major Middle East military escalation in 2026?",
    category: "politics",
    yesPrice: 0.38,
    noPrice: 0.65,
    spread: 0.03,
    volume24h: 290_000,
    liquidity: 980_000,
    resolutionDate: new Date("2026-12-31"),
  },
  {
    externalId: "senate-flips-2026",
    title: "Will the Senate flip in the 2026 midterms?",
    category: "politics",
    yesPrice: 0.35,
    noPrice: 0.68,
    spread: 0.03,
    volume24h: 870_000,
    liquidity: 4_500_000,
    resolutionDate: new Date("2026-11-03"),
  },
  {
    externalId: "gop-wins-both-chambers-2026",
    title: "Will the GOP control both chambers after 2026 midterms?",
    category: "politics",
    yesPrice: 0.42,
    noPrice: 0.61,
    spread: 0.03,
    volume24h: 650_000,
    liquidity: 3_200_000,
    resolutionDate: new Date("2026-11-03"),
  },
];

// ── Phase 2 Clusters ──
// Each cluster maps a name → array of market externalIds

const CLUSTERS = [
  {
    name: "Bitcoin Price Trajectory",
    description: "Markets related to Bitcoin price milestones at different timeframes",
    theme: "crypto",
    marketIds: ["btc-above-150k-2026", "btc-above-120k-q2-2026", "btc-above-100k-march-2026"],
  },
  {
    name: "Fed Rate Path",
    description: "Markets on whether and when the Fed will cut interest rates",
    theme: "rates",
    marketIds: ["fed-rate-cut-june-2026", "fed-rate-cut-sept-2026", "fed-rates-below-4-eoy-2026", "us-recession-2026"],
  },
  {
    name: "Geopolitics & Oil",
    description: "Geopolitical escalation markets and their commodity price implications",
    theme: "geopolitics",
    marketIds: ["mideast-escalation-2026", "oil-above-100-2026", "eu-carbon-tax-60-2026"],
  },
  {
    name: "2026 Midterm Elections",
    description: "Markets on the outcome of the 2026 US midterm elections",
    theme: "elections",
    marketIds: ["house-flips-2026-midterms", "senate-flips-2026", "gop-wins-both-chambers-2026", "trump-approval-50-july"],
  },
  {
    name: "AI & Tech Milestones",
    description: "Markets on major AI and technology events in 2026",
    theme: "technology",
    marketIds: ["ai-passes-bar-exam-2026", "openai-ipo-2026", "nvidia-stock-above-200"],
  },
];

async function main() {
  console.log("Seeding Event Edge database (Phase 1 + 2 + 3)...\n");

  // Clear everything (order matters for FK constraints)
  await prisma.clusterSignal.deleteMany();
  await prisma.clusterMarket.deleteMany();
  await prisma.cluster.deleteMany();
  await prisma.snapshot.deleteMany();
  await prisma.market.deleteMany();

  // ── Phase 1: Create markets + snapshots ──

  const marketMap = new Map<string, string>(); // externalId → id

  for (const m of MARKETS) {
    const market = await prisma.market.create({ data: m });
    marketMap.set(m.externalId, market.id);

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
          spread: parseFloat(Math.abs(yp - (1 - np)).toFixed(3)),
          volume24h: m.volume24h * (0.7 + Math.random() * 0.6),
          liquidity: m.liquidity * (0.8 + Math.random() * 0.4),
          capturedAt: new Date(now - i * 3_600_000),
        },
      });
    }
    console.log(`  ✓ Market: ${market.title}`);
  }

  // Compute dislocation scores
  const allMarkets = await prisma.market.findMany({
    include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 2 } },
  });

  const avgVolume = allMarkets.reduce((s, m) => s + m.volume24h, 0) / allMarkets.length;
  const avgLiquidity = allMarkets.reduce((s, m) => s + m.liquidity, 0) / allMarkets.length;

  for (const mkt of allMarkets) {
    const prev = mkt.snapshots[1] ?? null;
    const changeScore = prev ? Math.min(Math.abs(mkt.yesPrice - prev.yesPrice) / 0.15, 1) : 0;
    const spreadScore = Math.min(mkt.spread / 0.1, 1);
    const liqScore = avgLiquidity > 0 ? Math.max(0, Math.min(1, 1 - mkt.liquidity / avgLiquidity)) : 0;
    let volScore = avgVolume > 0 ? Math.min((mkt.volume24h / avgVolume - 1) / 3, 1) : 0;
    volScore = Math.max(0, volScore);

    const score = Math.round(changeScore * 30 + spreadScore * 25 + liqScore * 25 + volScore * 20);
    await prisma.market.update({
      where: { id: mkt.id },
      data: { dislocationScore: Math.min(100, Math.max(0, score)) },
    });
  }

  console.log(`\n  Seeded ${MARKETS.length} markets with snapshots and scores.\n`);

  // ── Phase 2 + 3: Create clusters, link markets, compute everything ──

  const freshMarkets = await prisma.market.findMany();
  const freshMap = new Map(freshMarkets.map((m) => [m.externalId, m]));

  for (const c of CLUSTERS) {
    const cluster = await prisma.cluster.create({
      data: { name: c.name, description: c.description, theme: c.theme },
    });

    for (const extId of c.marketIds) {
      const mktId = marketMap.get(extId);
      if (mktId) {
        await prisma.clusterMarket.create({
          data: { clusterId: cluster.id, marketId: mktId },
        });
      }
    }

    const members = c.marketIds
      .map((extId) => freshMap.get(extId))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);

    // Compute Phase 2 analytics + Phase 3 ranking/classification/expressions
    const result = computeCluster(c.name, c.theme, members);

    await prisma.cluster.update({
      where: { id: cluster.id },
      data: {
        avgProbability: result.avgProbability,
        probabilityDispersion: result.probabilityDispersion,
        inconsistencyScore: result.inconsistencyScore,
        divergenceScore: result.divergenceScore,
        confidenceScore: result.confidenceScore,
        rankingScore: result.rankingScore,
        classification: result.classification,
        explanation: result.explanation,
        expressions: result.expressions,
      },
    });

    for (const sig of result.signals) {
      await prisma.clusterSignal.create({
        data: {
          clusterId: cluster.id,
          type: sig.type,
          severity: sig.severity,
          message: sig.message,
          data: JSON.stringify(sig.data),
        },
      });
    }

    const labels = JSON.parse(result.classification);
    const exprs = JSON.parse(result.expressions);
    console.log(`  ✓ Cluster: ${c.name} (${members.length} markets, ${result.signals.length} signals, ${labels.length} labels, ${exprs.length} expressions, rank=${result.rankingScore})`);
  }

  console.log(`\n  Seeded ${CLUSTERS.length} clusters.`);
  console.log("  Done.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
