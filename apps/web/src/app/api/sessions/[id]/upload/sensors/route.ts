import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";

// POST /api/sessions/:id/upload/sensors — Upload sensor data file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send a 'file' field in form data." },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const format = fileName.endsWith(".csv") ? "csv" : "json";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate sensor data structure for JSON files
    let sampleCount: number | null = null;
    if (format === "json") {
      try {
        const data = JSON.parse(buffer.toString("utf-8"));
        if (!data.samples || !Array.isArray(data.samples)) {
          return NextResponse.json(
            { error: "Invalid sensor data: missing 'samples' array" },
            { status: 400 }
          );
        }
        sampleCount = data.samples.length;
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON file" },
          { status: 400 }
        );
      }
    }

    // Upload to object storage
    const storageKey = `sessions/${id}/sensors.${format}`;
    await uploadFile(storageKey, buffer, `application/${format}`);

    // Create upload record
    const upload = await prisma.sensorUpload.create({
      data: {
        sessionId: id,
        storageKey,
        fileName,
        fileSize: buffer.length,
        format,
        sampleCount,
      },
    });

    // Update session status
    await prisma.session.update({
      where: { id },
      data: {
        status: "DATA_UPLOADED",
        totalSamples: sampleCount,
      },
    });

    return NextResponse.json(
      {
        id: upload.id,
        sessionId: upload.sessionId,
        storageKey: upload.storageKey,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        format: upload.format,
        sampleCount: upload.sampleCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading sensor data:", error);
    return NextResponse.json(
      { error: "Failed to upload sensor data" },
      { status: 500 }
    );
  }
}
