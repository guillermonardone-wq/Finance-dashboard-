import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analysisQueue } from "@/lib/queue";
import type { AnalysisJobPayload } from "@racing-coach/types";

// POST /api/sessions/:id/analyze — Queue analysis job
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: { sensorUploads: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.sensorUploads.length === 0) {
      return NextResponse.json(
        { error: "No sensor data uploaded. Upload sensor data first." },
        { status: 400 }
      );
    }

    if (session.status === "ANALYZING") {
      return NextResponse.json(
        { error: "Analysis already in progress" },
        { status: 409 }
      );
    }

    // Create analysis job record
    const analysisJob = await prisma.analysisJob.create({
      data: {
        sessionId: id,
        status: "queued",
      },
    });

    // Build job payload
    const payload: AnalysisJobPayload = {
      sessionId: id,
      sensorDataKey: session.sensorUploads[0].storageKey,
      trackId: session.trackId,
      analysisJobId: analysisJob.id,
      options: {
        minLapTimeSeconds: 30,
        maxLapTimeSeconds: 600,
        brakingGThreshold: 0.3,
        cornerCurvatureThreshold: 0.01,
      },
    };

    // Enqueue in Redis via BullMQ
    const job = await analysisQueue.add("analyze-session", payload, {
      jobId: analysisJob.id,
    });

    // Update job with Redis job ID and session status
    await prisma.analysisJob.update({
      where: { id: analysisJob.id },
      data: { redisJobId: job.id },
    });

    await prisma.session.update({
      where: { id },
      data: { status: "ANALYZING" },
    });

    return NextResponse.json(
      { jobId: analysisJob.id, status: "queued" },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error starting analysis:", error);
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 }
    );
  }
}
