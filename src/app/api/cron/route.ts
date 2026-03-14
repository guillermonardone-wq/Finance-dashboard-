// GET /api/cron – refresh market data and recalculate dislocation scores
// In production you'd call the Polymarket API here.
// For Phase 1 this simulates small price movements and recalculates scores.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDislocation } from "@/lib/dislocation";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await prisma.market.findMany({ where: { active: true } });

  if (markets.length === 0) {
    return NextResponse.json({ updated: 0, timestamp: new Date().toISOString() });
  }

  // Phase 1: simulate new volume/liquidity per market, then compute averages
  const simulated = markets.map((mkt) => {
    const drift = (Math.random() - 0.5) * 0.04;
    const newYes = Math.max(0.01, Math.min(0.99, mkt.yesPrice + drift));
    const newNo = Math.max(0.01, Math.min(0.99, 1 - newYes + (Math.random() - 0.5) * 0.03));
    const newSpread = parseFloat(Math.abs(newYes - (1 - newNo)).toFixed(4));
    const newVolume = mkt.volume24h * (0.85 + Math.random() * 0.3);
    const newLiquidity = mkt.liquidity * (0.9 + Math.random() * 0.2);
    return { mkt, newYes, newNo, newSpread, newVolume, newLiquidity };
  });

  const avgVolume =
    simulated.reduce((s, d) => s + d.newVolume, 0) / simulated.length;
  const avgLiquidity =
    simulated.reduce((s, d) => s + d.newLiquidity, 0) / simulated.length;

  let updated = 0;

  for (const { mkt, newYes, newNo, newSpread, newVolume, newLiquidity } of simulated) {
    // Get the current latest snapshot BEFORE creating a new one (avoids race condition)
    const prevSnapshot = await prisma.snapshot.findFirst({
      where: { marketId: mkt.id },
      orderBy: { capturedAt: "desc" },
    });

    // Save new snapshot
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

    // Calculate dislocation using the NEW values and the PREVIOUS snapshot's price
    const score = calculateDislocation({
      currentYes: newYes,
      previousYes: prevSnapshot?.yesPrice ?? null,
      spread: newSpread,
      liquidity: newLiquidity,
      volume24h: newVolume,
      avgVolume,
      avgLiquidity,
    });

    // Update market with new prices and score
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

  return NextResponse.json({ updated, timestamp: new Date().toISOString() });
}
