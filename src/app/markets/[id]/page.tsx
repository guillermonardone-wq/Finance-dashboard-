// Market detail page – shows full info + snapshot history chart
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { pct, usd, timeUntil, scoreColor, scoreBg } from "@/lib/format";
import SnapshotChart from "../../components/SnapshotChart";

interface Snapshot {
  id: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  capturedAt: string;
}

interface MarketDetail {
  id: string;
  externalId: string;
  source: string;
  title: string;
  description: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  resolutionDate: string | null;
  dislocationScore: number;
  active: boolean;
  createdAt: string;
  snapshots: Snapshot[];
}

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/markets/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setMarket)
      .catch(() => setError(true));
  }, [id]);

  if (error) {
    return (
      <div className="text-center py-20 text-gray-400">
        Market not found.{" "}
        <a href="/" className="text-indigo-400 hover:underline">
          Back to dashboard
        </a>
      </div>
    );
  }

  if (!market) {
    return <div className="text-center py-20 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <a
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition"
      >
        &larr; All Markets
      </a>

      {/* Title section */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
            {market.category}
          </span>
          <h1 className="text-xl font-bold mt-1">{market.title}</h1>
          {market.description && (
            <p className="text-sm text-gray-400 mt-2">{market.description}</p>
          )}
        </div>
        <div
          className={`shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl border text-lg font-bold ${scoreBg(market.dislocationScore)} ${scoreColor(market.dislocationScore)}`}
        >
          {market.dislocationScore}
          <span className="text-[9px] uppercase tracking-wider opacity-60">
            score
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Yes Price" value={pct(market.yesPrice)} color="text-green-400" />
        <StatCard label="No Price" value={pct(market.noPrice)} color="text-red-400" />
        <StatCard label="Spread" value={pct(market.spread)} />
        <StatCard label="Volume 24h" value={usd(market.volume24h)} />
        <StatCard label="Liquidity" value={usd(market.liquidity)} />
        <StatCard
          label="Resolves In"
          value={timeUntil(market.resolutionDate ? new Date(market.resolutionDate) : null)}
        />
        <StatCard label="Source" value={market.source} />
        <StatCard label="Status" value={market.active ? "Active" : "Closed"} />
      </div>

      {/* Price history */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Price History</h2>
        <SnapshotChart snapshots={market.snapshots} />
      </div>

      {/* Snapshot table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="text-sm font-semibold mb-4">Recent Snapshots</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="pb-2 text-left font-medium">Time</th>
                <th className="pb-2 text-right font-medium">Yes</th>
                <th className="pb-2 text-right font-medium">No</th>
                <th className="pb-2 text-right font-medium">Spread</th>
                <th className="pb-2 text-right font-medium">Volume</th>
                <th className="pb-2 text-right font-medium">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {market.snapshots.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-400">
                    {new Date(s.capturedAt).toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-green-400">{pct(s.yesPrice)}</td>
                  <td className="py-2 text-right text-red-400">{pct(s.noPrice)}</td>
                  <td className="py-2 text-right">{pct(s.spread)}</td>
                  <td className="py-2 text-right">{usd(s.volume24h)}</td>
                  <td className="py-2 text-right">{usd(s.liquidity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
