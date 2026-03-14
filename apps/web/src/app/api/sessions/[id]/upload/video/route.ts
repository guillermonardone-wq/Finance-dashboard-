import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";

// POST /api/sessions/:id/upload/video — Upload video file
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
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to object storage
    const ext = file.name.split(".").pop() || "mp4";
    const storageKey = `sessions/${id}/video.${ext}`;
    await uploadFile(storageKey, buffer, file.type || "video/mp4");

    const upload = await prisma.videoUpload.create({
      data: {
        sessionId: id,
        storageKey,
        fileName: file.name,
        fileSize: buffer.length,
      },
    });

    return NextResponse.json(
      {
        id: upload.id,
        sessionId: upload.sessionId,
        storageKey: upload.storageKey,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading video:", error);
    return NextResponse.json(
      { error: "Failed to upload video" },
      { status: 500 }
    );
  }
}
