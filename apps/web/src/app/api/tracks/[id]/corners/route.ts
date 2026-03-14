import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/tracks/:id/corners — Get corners for a track
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const corners = await prisma.trackCorner.findMany({
      where: { trackId: id },
      orderBy: { number: "asc" },
    });

    return NextResponse.json(corners);
  } catch (error) {
    console.error("Error fetching corners:", error);
    return NextResponse.json(
      { error: "Failed to fetch corners" },
      { status: 500 }
    );
  }
}

// POST /api/tracks/:id/corners — Add/update corners (Track Builder)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const track = await prisma.track.findUnique({ where: { id } });
    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    if (!Array.isArray(body.corners)) {
      return NextResponse.json(
        { error: "Expected { corners: [...] }" },
        { status: 400 }
      );
    }

    // Delete existing corners and recreate
    await prisma.trackCorner.deleteMany({ where: { trackId: id } });

    const corners = await Promise.all(
      body.corners.map(
        (c: {
          number: number;
          name?: string;
          entryLat: number;
          entryLng: number;
          apexLat: number;
          apexLng: number;
          exitLat: number;
          exitLng: number;
          type?: string;
          direction?: string;
          notes?: string;
        }) =>
          prisma.trackCorner.create({
            data: {
              trackId: id,
              number: c.number,
              name: c.name,
              entryLat: c.entryLat,
              entryLng: c.entryLng,
              apexLat: c.apexLat,
              apexLng: c.apexLng,
              exitLat: c.exitLat,
              exitLng: c.exitLng,
              type: c.type,
              direction: c.direction,
              notes: c.notes,
            },
          })
      )
    );

    return NextResponse.json(corners, { status: 201 });
  } catch (error) {
    console.error("Error saving corners:", error);
    return NextResponse.json(
      { error: "Failed to save corners" },
      { status: 500 }
    );
  }
}
