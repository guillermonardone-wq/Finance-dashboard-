// GET /api/clusters/[id] – single cluster with markets and signals

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cluster = await prisma.cluster.findUnique({
    where: { id: params.id },
    include: {
      markets: {
        include: { market: true },
      },
      signals: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: { select: { markets: true } },
    },
  });

  if (!cluster) {
    return NextResponse.json({ error: "Cluster not found" }, { status: 404 });
  }

  return NextResponse.json(cluster);
}
