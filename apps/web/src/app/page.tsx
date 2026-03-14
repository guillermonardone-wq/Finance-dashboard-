import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const [sessionCount, trackCount, recentSessions] = await Promise.all([
    prisma.session.count(),
    prisma.track.count(),
    prisma.session.findMany({
      include: { track: true },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Phone-first post-session racing coach
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-400">Total Sessions</p>
          <p className="text-3xl font-bold mt-1">{sessionCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">Tracks Available</p>
          <p className="text-3xl font-bold mt-1">{trackCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-400">Quick Action</p>
          <Link href="/sessions/new" className="btn-primary mt-2 inline-block">
            New Session
          </Link>
        </div>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Sessions</h2>
          <Link
            href="/sessions"
            className="text-sm text-racing-400 hover:text-racing-300"
          >
            View all
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No sessions yet.</p>
            <Link href="/sessions/new" className="btn-primary mt-4 inline-block">
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="card block hover:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{session.name}</h3>
                    <p className="text-sm text-gray-400">
                      {session.track.name} &middot;{" "}
                      {new Date(session.date).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={session.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    CREATED: "badge-gray",
    DATA_UPLOADED: "badge-blue",
    ANALYZING: "badge-yellow",
    ANALYSIS_COMPLETE: "badge-green",
    ANALYSIS_FAILED: "badge-red",
  };

  const labels: Record<string, string> = {
    CREATED: "Created",
    DATA_UPLOADED: "Data Uploaded",
    ANALYZING: "Analyzing...",
    ANALYSIS_COMPLETE: "Complete",
    ANALYSIS_FAILED: "Failed",
  };

  return (
    <span className={styles[status] || "badge-gray"}>
      {labels[status] || status}
    </span>
  );
}
