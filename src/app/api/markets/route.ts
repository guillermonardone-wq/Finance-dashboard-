// GET /api/markets – list all markets with optional filters
// Query params: category, sort (dislocation|volume|spread), active (true|false)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const category = params.get("category");
  const sort = params.get("sort") ?? "dislocationScore";
  const activeParam = params.get("active");

  const where: Record<string, unknown> = {};
  if (category && category !== "all") where.category = category;
  if (activeParam !== null) where.active = activeParam !== "false";

  const orderMap: Record<string, object> = {
    dislocation: { dislocationScore: "desc" },
    volume: { volume24h: "desc" },
    spread: { spread: "desc" },
    liquidity: { liquidity: "asc" },
  };

  const markets = await prisma.market.findMany({
    where,
    orderBy: orderMap[sort] ?? { dislocationScore: "desc" },
  });

  return NextResponse.json(markets);
}
