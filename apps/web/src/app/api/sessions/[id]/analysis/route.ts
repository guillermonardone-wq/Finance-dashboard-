import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SessionAnalysisResponse } from "@racing-coach/types";

// GET /api/sessions/:id/analysis — Get analysis results + status
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
        laps: {
          orderBy: { lapNumber: "asc" },
        },
        analysis: true,
        coaching: true,
        analysisJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const latestJob = session.analysisJobs[0] || null;

    const response: SessionAnalysisResponse = {
      session: {
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
      },
      analysis: session.analysis
        ? {
            totalLaps: session.analysis.totalLaps,
            validLaps: session.analysis.validLaps,
            bestLapNumber: session.analysis.bestLapNumber,
            bestLapTime: session.analysis.bestLapTime,
            medianLapTime: session.analysis.medianLapTime,
            consistency: session.analysis.consistency,
            status: session.analysis.status,
          }
        : null,
      laps: session.laps.map((l) => ({
        id: l.id,
        lapNumber: l.lapNumber,
        lapTimeSeconds: l.lapTimeSeconds,
        isValid: l.isValid,
        invalidReason: l.invalidReason,
        maxSpeedKmh: l.maxSpeedKmh,
        avgSpeedKmh: l.avgSpeedKmh,
        maxLateralG: l.maxLateralG,
        maxBrakingG: l.maxBrakingG,
      })),
      coaching: session.coaching
        ? {
            summaryText: session.coaching.summaryText,
            top3Improvements:
              session.coaching.top3Improvements as SessionAnalysisResponse["coaching"] extends null
                ? never
                : NonNullable<SessionAnalysisResponse["coaching"]>["top3Improvements"],
            cornerCoaching:
              session.coaching.cornerCoaching as SessionAnalysisResponse["coaching"] extends null
                ? never
                : NonNullable<SessionAnalysisResponse["coaching"]>["cornerCoaching"],
            audioStorageKey: session.coaching.audioStorageKey,
          }
        : null,
      job: latestJob
        ? {
            id: latestJob.id,
            sessionId: latestJob.sessionId,
            status: latestJob.status as "queued" | "processing" | "completed" | "failed",
            stage: latestJob.stage,
            progressPercent: latestJob.progressPercent,
            errorMessage: latestJob.errorMessage,
            createdAt: latestJob.createdAt.toISOString(),
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}
