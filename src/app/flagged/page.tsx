// Flagged Opportunities page – markets with dislocation score >= 40
"use client";

import { useEffect, useState } from "react";
import type { Market } from "@/lib/types";
import MarketCard from "../components/MarketCard";

export default function FlaggedPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/markets?sort=dislocation")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load markets (${r.status})`);
        return r.json();
      })
      .then((data: Market[]) => {
        setMarkets(data.filter((m) => m.dislocationScore >= 40));
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
        <h1 className="text-2xl font-bold mb-1">Flagged Opportunities</h1>
        <p className="text-sm text-gray-400">
          Markets with dislocation score &ge; 40 — potential mispricings worth
          investigating
        </p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-12">{error}</div>
      ) : markets.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No flagged markets right now. Check back after running{" "}
          <code className="text-indigo-400">GET /api/cron</code> a few times.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => (
            <MarketCard key={m.id} {...m} />
          ))}
        </div>
      )}
    </div>
  );
}
