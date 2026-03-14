// Cluster detail page – shows cluster analytics, member markets, and signals
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ClusterDetail } from "@/lib/types";
import type { Expression } from "@/lib/types";
import { pct, usd, scoreColor, scoreBg } from "@/lib/format";
import MarketCard from "../../components/MarketCard";
import SignalBadge from "../../components/SignalBadge";
import ClassificationBadges from "../../components/ClassificationBadges";
import ExpressionCard from "../../components/ExpressionCard";

export default function ClusterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/clusters/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Cluster not found" : `Error ${r.status}`);
        return r.json();
      })
      .then(setCluster)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="text-center py-20 text-gray-400">
        {error}.{" "}
        <a href="/clusters" className="text-indigo-400 hover:underline">
          Back to clusters
        </a>
      </div>
    );
  }

  if (!cluster) {
    return <div className="text-center py-20 text-gray-500">Loading...</div>;
  }

  const markets = cluster.markets.map((cm) => cm.market);
  const labels: string[] = safeParse(cluster.classification, []);
  const expressions: Expression[] = safeParse(cluster.expressions, []);

  return (
    <div className="max-w-5xl mx-auto">
      <a
        href="/clusters"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition"
      >
        &larr; All Clusters
      </a>

      {/* Title + score badges */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
            {cluster.theme}
          </span>
          <h1 className="text-xl font-bold mt-1">{cluster.name}</h1>
          {cluster.description && (
            <p className="text-sm text-gray-400 mt-2">{cluster.description}</p>
          )}
          {labels.length > 0 && (
            <div className="mt-3">
              <ClassificationBadges labels={labels} />
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <div
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border text-lg font-bold ${scoreBg(cluster.rankingScore)} ${scoreColor(cluster.rankingScore)}`}
          >
            {cluster.rankingScore}
            <span className="text-[9px] uppercase tracking-wider opacity-60">
              rank
            </span>
          </div>
          <div
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl border text-lg font-bold ${scoreBg(cluster.divergenceScore)} ${scoreColor(cluster.divergenceScore)}`}
          >
            {cluster.divergenceScore}
            <span className="text-[9px] uppercase tracking-wider opacity-60">
              diverg.
            </span>
          </div>
        </div>
      </div>

      {/* Explanation */}
      {cluster.explanation && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Why Flagged</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{cluster.explanation}</p>
        </div>
      )}

      {/* Analytics cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard label="Avg Probability" value={pct(cluster.avgProbability)} />
        <StatCard label="Dispersion" value={pct(cluster.probabilityDispersion)} />
        <StatCard
          label="Inconsistency"
          value={String(cluster.inconsistencyScore)}
          color={scoreColor(cluster.inconsistencyScore)}
        />
        <StatCard
          label="Divergence"
          value={String(cluster.divergenceScore)}
          color={scoreColor(cluster.divergenceScore)}
        />
        <StatCard label="Confidence" value={String(cluster.confidenceScore)} />
      </div>

      {/* Probability comparison bar */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Probability Comparison</h2>
        <div className="space-y-3">
          {markets.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-48 text-xs text-gray-400 truncate shrink-0" title={m.title}>
                {m.title}
              </div>
              <div className="flex-1 bg-gray-800 rounded-full h-5 relative overflow-hidden">
                <div
                  className="h-full bg-indigo-500/70 rounded-full"
                  style={{ width: `${m.yesPrice * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white">
                  {pct(m.yesPrice)}
                </span>
              </div>
              <div className="w-16 text-right text-xs text-gray-500">
                {usd(m.liquidity)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signals */}
      {cluster.signals.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-4">
            Signals ({cluster.signals.length})
          </h2>
          <div className="space-y-3">
            {cluster.signals.map((s) => (
              <SignalBadge
                key={s.id}
                type={s.type}
                severity={s.severity}
                message={s.message}
              />
            ))}
          </div>
        </div>
      )}

      {/* Research Expressions */}
      {expressions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-4">
            Research Expressions ({expressions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expressions.map((expr) => (
              <ExpressionCard key={expr.type} expression={expr} />
            ))}
          </div>
        </div>
      )}

      {/* Member markets */}
      <h2 className="text-sm font-semibold mb-4">
        Member Markets ({markets.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {markets.map((m) => (
          <MarketCard key={m.id} {...m} />
        ))}
      </div>
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

function StatCard({
  label,
  value,
  color = "text-gray-100",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}
