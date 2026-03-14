// Top Signals page — ranked flagged clusters with classification and explanation
"use client";

import { useEffect, useState } from "react";
import type { Cluster, Expression } from "@/lib/types";
import { pct, scoreColor, scoreBg } from "@/lib/format";
import ClassificationBadges from "../components/ClassificationBadges";
import SignalBadge from "../components/SignalBadge";

interface SignalCluster extends Cluster {
  signals: { id: string; type: string; severity: string; message: string }[];
  _count: { markets: number; signals: number };
}

export default function TopSignalsPage() {
  const [clusters, setClusters] = useState<SignalCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/top-signals")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setClusters(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Top Signals</h1>
        <p className="text-sm text-gray-400">
          Flagged clusters ranked by research interest — most actionable first
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-12">{error}</div>
      ) : clusters.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No flagged clusters right now. Run{" "}
          <code className="text-indigo-400">GET /api/cron</code> a few times to generate signals.
        </div>
      ) : (
        <div className="space-y-4">
          {clusters.map((c) => {
            const labels: string[] = safeParse(c.classification, []);
            const expressions: Expression[] = safeParse(c.expressions, []);

            return (
              <a
                key={c.id}
                href={`/clusters/${c.id}`}
                className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-indigo-500/50 transition"
              >
                {/* Header row */}
                <div className="flex items-start gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-indigo-400">
                        {c.theme}
                      </span>
                      <span className="text-[11px] text-gray-600">
                        {c._count.markets} markets
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold mb-2">{c.name}</h3>
                    <ClassificationBadges labels={labels} />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <div
                      className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg border text-sm font-bold ${scoreBg(c.rankingScore)} ${scoreColor(c.rankingScore)}`}
                      title="Ranking score"
                    >
                      {c.rankingScore}
                      <span className="text-[8px] uppercase tracking-wider opacity-60">rank</span>
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                {c.explanation && (
                  <p className="text-xs text-gray-400 leading-relaxed mb-3">
                    {c.explanation}
                  </p>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-5 gap-3 text-center text-[11px] text-gray-400 mb-3">
                  <div>
                    <div className="text-gray-500 mb-0.5">Avg Prob</div>
                    <div className="font-medium text-gray-300">{pct(c.avgProbability)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">Divergence</div>
                    <div className={`font-medium ${scoreColor(c.divergenceScore)}`}>{c.divergenceScore}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">Inconsist.</div>
                    <div className={`font-medium ${scoreColor(c.inconsistencyScore)}`}>{c.inconsistencyScore}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">Confidence</div>
                    <div className="font-medium text-gray-300">{c.confidenceScore}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-0.5">Expressions</div>
                    <div className="font-medium text-gray-300">{expressions.length}</div>
                  </div>
                </div>

                {/* Top signal preview */}
                {c.signals.length > 0 && (
                  <SignalBadge
                    type={c.signals[0].type}
                    severity={c.signals[0].severity}
                    message={c.signals[0].message}
                  />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
