import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { TrackResponse } from "@racing-coach/types";

// GET /api/tracks — List all tracks
export async function GET() {
  try {
    const tracks = await prisma.track.findMany({
      include: {
        _count: { select: { corners: true } },
      },
      orderBy: { name: "asc" },
    });

    const response: TrackResponse[] = tracks.map((t) => ({
      id: t.id,
      name: t.name,
      location: t.location,
      country: t.country,
      lengthMeters: t.lengthMeters,
      cornerCount: t._count.corners,
      source: t.source,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error listing tracks:", error);
    return NextResponse.json(
      { error: "Failed to list tracks" },
      { status: 500 }
    );
  }
}
