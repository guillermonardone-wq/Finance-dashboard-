import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/sessions/:id/laps — Get laps with optional corner analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const includeCorners =
      request.nextUrl.searchParams.get("includeCorners") === "true";

    const laps = await prisma.lap.findMany({
      where: { sessionId: id },
      include: includeCorners
        ? {
            cornerAnalyses: {
              include: { trackCorner: true },
              orderBy: { cornerNumber: "asc" },
            },
          }
        : undefined,
      orderBy: { lapNumber: "asc" },
    });

    return NextResponse.json(laps);
  } catch (error) {
    console.error("Error fetching laps:", error);
    return NextResponse.json(
      { error: "Failed to fetch laps" },
      { status: 500 }
    );
  }
}
