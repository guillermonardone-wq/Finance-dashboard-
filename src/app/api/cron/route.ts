// GET /api/cron – refresh market data, recalculate all scores
// Simulates price movements for Phase 1, then runs the full
// Phase 2 + 3 pipeline on every cluster.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDislocation } from "@/lib/dislocation";
import { computeCluster } from "@/lib/cluster-compute";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await prisma.market.findMany({ where: { active: true } });

  if (markets.length === 0) {
    return NextResponse.json({ updated: 0, clustersUpdated: 0, timestamp: new Date().toISOString() });
  }

  // ── Phase 1: simulate price drift, update markets ──

  const simulated = markets.map((mkt) => {
    const drift = (Math.random() - 0.5) * 0.04;
    const newYes = Math.max(0.01, Math.min(0.99, mkt.yesPrice + drift));
    const newNo = Math.max(0.01, Math.min(0.99, 1 - newYes + (Math.random() - 0.5) * 0.03));
    const newSpread = parseFloat(Math.abs(newYes - (1 - newNo)).toFixed(4));
    const newVolume = mkt.volume24h * (0.85 + Math.random() * 0.3);
    const newLiquidity = mkt.liquidity * (0.9 + Math.random() * 0.2);
    return { mkt, newYes, newNo, newSpread, newVolume, newLiquidity };
  });

  const avgVolume = simulated.reduce((s, d) => s + d.newVolume, 0) / simulated.length;
  const avgLiquidity = simulated.reduce((s, d) => s + d.newLiquidity, 0) / simulated.length;

  let updated = 0;

  for (const { mkt, newYes, newNo, newSpread, newVolume, newLiquidity } of simulated) {
    const prevSnapshot = await prisma.snapshot.findFirst({
      where: { marketId: mkt.id },
      orderBy: { capturedAt: "desc" },
    });

    await prisma.snapshot.create({
      data: {
        marketId: mkt.id,
        yesPrice: parseFloat(newYes.toFixed(4)),
        noPrice: parseFloat(newNo.toFixed(4)),
        spread: newSpread,
        volume24h: newVolume,
        liquidity: newLiquidity,
      },
    });

    const score = calculateDislocation({
      currentYes: newYes,
      previousYes: prevSnapshot?.yesPrice ?? null,
      spread: newSpread,
      liquidity: newLiquidity,
      volume24h: newVolume,
      avgVolume,
      avgLiquidity,
    });

    await prisma.market.update({
      where: { id: mkt.id },
      data: {
        yesPrice: parseFloat(newYes.toFixed(4)),
        noPrice: parseFloat(newNo.toFixed(4)),
        spread: newSpread,
        volume24h: newVolume,
        liquidity: newLiquidity,
        dislocationScore: score,
      },
    });

    updated++;
  }

  // ── Phase 2 + 3: recompute clusters ──

  const clusters = await prisma.cluster.findMany({
    include: { markets: { include: { market: true } } },
  });

  let clustersUpdated = 0;

  for (const cluster of clusters) {
    const members = cluster.markets.map((cm) => cm.market);
    const result = computeCluster(cluster.name, cluster.theme, members);

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

    await prisma.clusterSignal.deleteMany({ where: { clusterId: cluster.id } });
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

    clustersUpdated++;
  }

  return NextResponse.json({ updated, clustersUpdated, timestamp: new Date().toISOString() });
}
