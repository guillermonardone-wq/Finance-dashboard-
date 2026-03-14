// GET /api/clusters – list all clusters with market counts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sort = req.nextUrl.searchParams.get("sort") ?? "divergence";
  const theme = req.nextUrl.searchParams.get("theme");

  const where: Record<string, unknown> = {};
  if (theme && theme !== "all") where.theme = theme;

  const orderMap: Record<string, object> = {
    divergence: { divergenceScore: "desc" },
    inconsistency: { inconsistencyScore: "desc" },
    confidence: { confidenceScore: "desc" },
    ranking: { rankingScore: "desc" },
  };

  const clusters = await prisma.cluster.findMany({
    where,
    orderBy: orderMap[sort] ?? { divergenceScore: "desc" },
    include: {
      _count: { select: { markets: true, signals: true } },
    },
  });

  return NextResponse.json(clusters);
}
