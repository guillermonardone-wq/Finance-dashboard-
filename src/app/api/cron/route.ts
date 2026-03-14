// GET /api/cron – refresh market data and recalculate dislocation scores
// In production you'd call the Polymarket API here.
// For Phase 1 this simulates small price movements and recalculates scores.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateDislocation } from "@/lib/dislocation";

export const dynamic = "force-dynamic";

export async function GET() {
  const markets = await prisma.market.findMany({ where: { active: true } });

  const avgVolume =
    markets.reduce((s, m) => s + m.volume24h, 0) / (markets.length || 1);
  const avgLiquidity =
    markets.reduce((s, m) => s + m.liquidity, 0) / (markets.length || 1);

  let updated = 0;

  for (const mkt of markets) {
    // Simulate a small price drift
    const drift = (Math.random() - 0.5) * 0.04;
    const newYes = Math.max(0.01, Math.min(0.99, mkt.yesPrice + drift));
    const newNo = Math.max(0.01, Math.min(0.99, 1 - newYes + (Math.random() - 0.5) * 0.03));
    const newSpread = parseFloat(Math.abs(newYes - (1 - newNo)).toFixed(4));

    // Save snapshot
    await prisma.snapshot.create({
      data: {
        marketId: mkt.id,
        yesPrice: parseFloat(newYes.toFixed(4)),
        noPrice: parseFloat(newNo.toFixed(4)),
        spread: newSpread,
        volume24h: mkt.volume24h * (0.85 + Math.random() * 0.3),
        liquidity: mkt.liquidity * (0.9 + Math.random() * 0.2),
      },
    });

    // Get previous snapshot for dislocation calc
    const prevSnapshot = await prisma.snapshot.findFirst({
      where: { marketId: mkt.id },
      orderBy: { capturedAt: "desc" },
      skip: 1,
    });

    const score = calculateDislocation({
      currentYes: newYes,
      previousYes: prevSnapshot?.yesPrice ?? null,
      spread: newSpread,
      liquidity: mkt.liquidity,
      volume24h: mkt.volume24h,
      avgVolume,
      avgLiquidity,
    });

    await prisma.market.update({
      where: { id: mkt.id },
      data: {
        yesPrice: parseFloat(newYes.toFixed(4)),
        noPrice: parseFloat(newNo.toFixed(4)),
        spread: newSpread,
        dislocationScore: score,
      },
    });

    updated++;
  }

  return NextResponse.json({ updated, timestamp: new Date().toISOString() });
}
