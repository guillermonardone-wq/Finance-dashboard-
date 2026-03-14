import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { CreateSessionRequest, SessionResponse } from "@racing-coach/types";

// POST /api/sessions — Create a new driving session
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionRequest = await request.json();

    if (!body.name || !body.trackId || !body.date) {
      return NextResponse.json(
        { error: "name, trackId, and date are required" },
        { status: 400 }
      );
    }

    // Verify track exists
    const track = await prisma.track.findUnique({
      where: { id: body.trackId },
    });
    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    const session = await prisma.session.create({
      data: {
        name: body.name,
        trackId: body.trackId,
        date: new Date(body.date),
        carName: body.carName,
        carNotes: body.carNotes,
        conditions: body.conditions,
      },
      include: { track: true },
    });

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

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// GET /api/sessions — List all sessions
export async function GET() {
  try {
    const sessions = await prisma.session.findMany({
      include: { track: true },
      orderBy: { date: "desc" },
    });

    const response: SessionResponse[] = sessions.map((s) => ({
      id: s.id,
      name: s.name,
      trackId: s.trackId,
      trackName: s.track.name,
      date: s.date.toISOString(),
      carName: s.carName,
      carNotes: s.carNotes,
      conditions: s.conditions,
      status: s.status,
      dataQuality: s.dataQuality,
      totalSamples: s.totalSamples,
      durationSeconds: s.durationSeconds,
      createdAt: s.createdAt.toISOString(),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error listing sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}
