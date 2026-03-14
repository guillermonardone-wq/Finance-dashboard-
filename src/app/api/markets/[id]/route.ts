// GET /api/markets/[id] – single market with its snapshots

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const market = await prisma.market.findUnique({
    where: { id: params.id },
    include: {
      snapshots: { orderBy: { capturedAt: "desc" }, take: 50 },
    },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  return NextResponse.json(market);
}
