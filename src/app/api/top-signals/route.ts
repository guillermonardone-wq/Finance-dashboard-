// GET /api/top-signals – clusters ranked by Phase 3 ranking score
// Returns clusters that have at least one signal, ordered by rankingScore

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const clusters = await prisma.cluster.findMany({
    where: {
      signals: { some: {} },  // only clusters with at least one signal
    },
    orderBy: { rankingScore: "desc" },
    include: {
      signals: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { markets: true, signals: true } },
    },
  });

  return NextResponse.json(clusters);
}
