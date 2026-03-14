import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SessionResponse } from "@racing-coach/types";

// GET /api/sessions/:id — Get session details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        track: true,
        sensorUploads: true,
        videoUploads: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const response: SessionResponse = {
      id: session.id,
      name: session.name,
      trackId: session.trackId,
      trackName: session.track.name,
      date: session.date.toISOString(),
      carName: session.carName,
      carNotes: session.carNotes,
      conditions: session.conditions,
      status: session.status,
      dataQuality: session.dataQuality,
      totalSamples: session.totalSamples,
      durationSeconds: session.durationSeconds,
      createdAt: session.createdAt.toISOString(),
    };

    return NextResponse.json({
      ...response,
      sensorUploads: session.sensorUploads,
      videoUploads: session.videoUploads,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
