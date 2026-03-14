import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function SessionsPage() {
  const sessions = await prisma.session.findMany({
    include: {
      track: true,
      analysis: true,
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link href="/sessions/new" className="btn-primary">
          New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-lg">No sessions yet</p>
          <p className="text-gray-600 mt-2">
            Create a session and upload your sensor data to get started.
          </p>
          <Link href="/sessions/new" className="btn-primary mt-6 inline-block">
            Create your first session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="card hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{session.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    {session.track.name} &middot; {session.track.location}
                  </p>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                    {session.carName && <span>{session.carName}</span>}
                    {session.conditions && <span>{session.conditions}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <SessionStatusBadge status={session.status} />
                  {session.analysis && (
                    <div className="mt-2 text-sm">
                      <span className="text-gray-400">Best: </span>
                      <span className="text-racing-400 font-mono">
                        {session.analysis.bestLapTime
                          ? formatLapTime(session.analysis.bestLapTime)
                          : "N/A"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { class: string; label: string }> = {
    CREATED: { class: "badge-gray", label: "Created" },
    DATA_UPLOADED: { class: "badge-blue", label: "Data Ready" },
    ANALYZING: { class: "badge-yellow", label: "Analyzing..." },
    ANALYSIS_COMPLETE: { class: "badge-green", label: "Complete" },
    ANALYSIS_FAILED: { class: "badge-red", label: "Failed" },
  };

  const c = config[status] || { class: "badge-gray", label: status };
  return <span className={c.class}>{c.label}</span>;
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
}
