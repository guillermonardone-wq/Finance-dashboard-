"use client";

import { useState, useCallback } from "react";

interface SessionData {
  id: string;
  name: string;
  date: string;
  status: string;
  carName: string | null;
  conditions: string | null;
  dataQuality: string | null;
  track: {
    name: string;
    location: string;
    corners: Array<{
      number: number;
      name: string | null;
      type: string | null;
      direction: string | null;
    }>;
  };
  sensorUploads: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    sampleCount: number | null;
  }>;
  laps: Array<{
    id: string;
    lapNumber: number;
    lapTimeSeconds: number;
    isValid: boolean;
    maxSpeedKmh: number | null;
  }>;
  analysis: {
    totalLaps: number;
    validLaps: number;
    bestLapNumber: number | null;
    bestLapTime: number | null;
    consistency: number | null;
  } | null;
  coaching: {
    summaryText: string;
    top3Improvements: Array<{
      cornerNumber: number;
      suggestion: string;
      estimatedTimeSave: number;
    }>;
    cornerCoaching: Array<{
      corner_number?: number;
      cornerNumber?: number;
      coaching_text?: string;
      coachingText?: string;
      confidence: number;
    }>;
  } | null;
  analysisJobs: Array<{
    id: string;
    status: string;
    stage: string | null;
    progressPercent: number;
    errorMessage: string | null;
  }>;
}

export default function SessionDetailClient({
  session: initialSession,
}: {
  session: SessionData;
}) {
  const [session, setSession] = useState(initialSession);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "laps" | "coaching"
  >("overview");

  const latestJob = session.analysisJobs[0] || null;

  // Poll for analysis status when analyzing
  const pollAnalysis = useCallback(async () => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/sessions/${session.id}/analysis`);
        const data = await res.json();

        if (
          data.job?.status === "completed" ||
          data.job?.status === "failed" ||
          data.session?.status === "ANALYSIS_COMPLETE" ||
          data.session?.status === "ANALYSIS_FAILED"
        ) {
          clearInterval(interval);
          window.location.reload();
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [session.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/sessions/${session.id}/upload/sensors`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      window.location.reload();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  const handleStartAnalysis = async () => {
    setAnalyzing(true);

    try {
      const res = await fetch(`/api/sessions/${session.id}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start analysis");
      }

      pollAnalysis();
    } catch (err) {
      setAnalyzing(false);
      setUploadError(err instanceof Error ? err.message : "Analysis failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <p className="text-gray-400">
            {session.track.name} &middot;{" "}
            {new Date(session.date).toLocaleDateString()}
            {session.carName && ` &middot; ${session.carName}`}
          </p>
        </div>
        <StatusBadge status={session.status} />
      </div>

      {/* Upload Section */}
      {session.status === "CREATED" && (
        <div className="card">
          <h2 className="font-semibold mb-3">Upload Sensor Data</h2>
          <p className="text-sm text-gray-400 mb-4">
            Upload a JSON or CSV file with GPS, accelerometer, and gyroscope
            data.
          </p>
          {uploadError && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 px-3 py-2 rounded-lg text-sm mb-3">
              {uploadError}
            </div>
          )}
          <label className="btn-primary cursor-pointer inline-block">
            {uploading ? "Uploading..." : "Choose File"}
            <input
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      )}

      {/* Analysis Trigger */}
      {session.status === "DATA_UPLOADED" && (
        <div className="card">
          <h2 className="font-semibold mb-2">Ready for Analysis</h2>
          <p className="text-sm text-gray-400 mb-4">
            Sensor data uploaded ({session.sensorUploads[0]?.sampleCount ?? "?"}{" "}
            samples). Start the analysis pipeline.
          </p>
          <button
            onClick={handleStartAnalysis}
            className="btn-primary"
            disabled={analyzing}
          >
            {analyzing ? "Starting..." : "Start Analysis"}
          </button>
        </div>
      )}

      {/* Analysis Progress */}
      {session.status === "ANALYZING" && latestJob && (
        <div className="card">
          <h2 className="font-semibold mb-3">Analysis in Progress</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                {latestJob.stage?.replace(/_/g, " ") || "Starting..."}
              </span>
              <span className="text-racing-400">
                {latestJob.progressPercent}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-racing-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${latestJob.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Tabs */}
      {(session.status === "ANALYSIS_COMPLETE" ||
        session.status === "ANALYSIS_FAILED") && (
        <>
          <div className="flex gap-1 border-b border-gray-800">
            {(["overview", "laps", "coaching"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-racing-500 text-racing-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <OverviewTab session={session} />
          )}
          {activeTab === "laps" && <LapsTab session={session} />}
          {activeTab === "coaching" && <CoachingTab session={session} />}
        </>
      )}
    </div>
  );
}

function OverviewTab({ session }: { session: SessionData }) {
  const { analysis, coaching } = session;

  return (
    <div className="space-y-6">
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Laps" value={analysis.totalLaps} />
          <StatCard label="Valid Laps" value={analysis.validLaps} />
          <StatCard
            label="Best Lap"
            value={
              analysis.bestLapTime
                ? formatLapTime(analysis.bestLapTime)
                : "N/A"
            }
          />
          <StatCard
            label="Consistency"
            value={
              analysis.consistency
                ? `${analysis.consistency.toFixed(2)}s`
                : "N/A"
            }
            subtitle="std dev"
          />
        </div>
      )}

      {coaching && coaching.top3Improvements && (
        <div className="card">
          <h3 className="font-semibold mb-4">Top 3 Improvements</h3>
          <div className="space-y-3">
            {(coaching.top3Improvements as Array<{cornerNumber: number; suggestion: string; estimatedTimeSave: number}>).map(
              (imp, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-gray-800/50 p-3 rounded-lg"
                >
                  <span className="bg-racing-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm">{imp.suggestion}</p>
                    <p className="text-xs text-racing-400 mt-1">
                      Est. time save: {imp.estimatedTimeSave.toFixed(3)}s
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {coaching?.summaryText && (
        <div className="card">
          <h3 className="font-semibold mb-3">Coaching Summary</h3>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {coaching.summaryText}
          </p>
        </div>
      )}
    </div>
  );
}

function LapsTab({ session }: { session: SessionData }) {
  const bestLapNum = session.analysis?.bestLapNumber;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="pb-3 pr-4">Lap</th>
            <th className="pb-3 pr-4">Time</th>
            <th className="pb-3 pr-4">Max Speed</th>
            <th className="pb-3 pr-4">Valid</th>
            <th className="pb-3">Delta vs Best</th>
          </tr>
        </thead>
        <tbody>
          {session.laps.map((lap) => {
            const isBest = lap.lapNumber === bestLapNum;
            const bestTime = session.analysis?.bestLapTime;
            const delta =
              bestTime && lap.isValid
                ? lap.lapTimeSeconds - bestTime
                : null;

            return (
              <tr
                key={lap.id}
                className={`border-b border-gray-800/50 ${
                  isBest ? "bg-racing-900/20" : ""
                }`}
              >
                <td className="py-2 pr-4 font-mono">
                  {lap.lapNumber}
                  {isBest && (
                    <span className="ml-2 text-racing-400 text-xs">BEST</span>
                  )}
                </td>
                <td className="py-2 pr-4 font-mono">
                  {formatLapTime(lap.lapTimeSeconds)}
                </td>
                <td className="py-2 pr-4">
                  {lap.maxSpeedKmh
                    ? `${lap.maxSpeedKmh.toFixed(1)} km/h`
                    : "—"}
                </td>
                <td className="py-2 pr-4">
                  {lap.isValid ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-red-400">No</span>
                  )}
                </td>
                <td className="py-2 font-mono">
                  {delta !== null && !isBest ? (
                    <span
                      className={
                        delta > 0 ? "text-red-400" : "text-green-400"
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(3)}s
                    </span>
                  ) : isBest ? (
                    <span className="text-racing-400">—</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CoachingTab({ session }: { session: SessionData }) {
  const { coaching, track } = session;

  if (!coaching) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-500">No coaching data available.</p>
      </div>
    );
  }

  const cornerMap = Object.fromEntries(
    track.corners.map((c) => [c.number, c])
  );

  return (
    <div className="space-y-4">
      {(coaching.cornerCoaching as Array<{
        corner_number?: number;
        cornerNumber?: number;
        coaching_text?: string;
        coachingText?: string;
        confidence: number;
        measured_insights?: string[];
        measuredInsights?: string[];
        inferred_insights?: string[];
        inferredInsights?: string[];
      }>).map((cc) => {
        const num = cc.corner_number ?? cc.cornerNumber ?? 0;
        const text = cc.coaching_text ?? cc.coachingText ?? "";
        const corner = cornerMap[num];

        return (
          <div key={num} className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">
                {corner?.name || `Turn ${num}`}
                {corner?.type && (
                  <span className="text-gray-500 text-sm ml-2">
                    ({corner.type}, {corner.direction})
                  </span>
                )}
              </h3>
              <ConfidenceBadge confidence={cc.confidence} />
            </div>
            <p className="text-sm text-gray-300">{text}</p>

            <div className="mt-3 flex gap-4 text-xs">
              {(cc.measured_insights ?? cc.measuredInsights ?? []).length > 0 && (
                <div>
                  <span className="text-green-500 font-medium">MEASURED: </span>
                  <span className="text-gray-400">
                    {(cc.measured_insights ?? cc.measuredInsights ?? []).join(", ")}
                  </span>
                </div>
              )}
              {(cc.inferred_insights ?? cc.inferredInsights ?? []).length > 0 && (
                <div>
                  <span className="text-yellow-500 font-medium">INFERRED: </span>
                  <span className="text-gray-400">
                    {(cc.inferred_insights ?? cc.inferredInsights ?? []).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold font-mono mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls =
    pct >= 70 ? "badge-green" : pct >= 40 ? "badge-yellow" : "badge-red";
  return <span className={cls}>{pct}% confidence</span>;
}

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, "0")}`;
}
