// Clusters page – all event clusters ranked by divergence
"use client";

import { useEffect, useState } from "react";
import type { Cluster } from "@/lib/types";
import ClusterCard from "../components/ClusterCard";

interface ClusterWithCount extends Cluster {
  _count: { markets: number; signals: number };
}

export default function ClustersPage() {
  const [clusters, setClusters] = useState<ClusterWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clusters?sort=divergence")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load clusters (${r.status})`);
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
        <h1 className="text-2xl font-bold mb-1">Event Clusters</h1>
        <p className="text-sm text-gray-400">
          Related prediction markets grouped by theme — ranked by cross-market divergence
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading clusters...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-12">{error}</div>
      ) : clusters.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No clusters found. Run <code className="text-indigo-400">npm run db:seed</code> to
          populate data.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clusters.map((c) => (
            <ClusterCard
              key={c.id}
              id={c.id}
              name={c.name}
              description={c.description}
              theme={c.theme}
              avgProbability={c.avgProbability}
              probabilityDispersion={c.probabilityDispersion}
              inconsistencyScore={c.inconsistencyScore}
              divergenceScore={c.divergenceScore}
              confidenceScore={c.confidenceScore}
              marketCount={c._count.markets}
              signalCount={c._count.signals}
            />
          ))}
        </div>
      )}
    </div>
  );
}
