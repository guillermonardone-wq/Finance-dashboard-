import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import SessionDetailClient from "@/components/sessions/SessionDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      track: { include: { corners: { orderBy: { number: "asc" } } } },
      sensorUploads: true,
      videoUploads: true,
      laps: { orderBy: { lapNumber: "asc" } },
      analysis: true,
      coaching: true,
      analysisJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!session) notFound();

  // Serialize for client component
  const sessionData = JSON.parse(JSON.stringify(session));

  return <SessionDetailClient session={sessionData} />;
}
