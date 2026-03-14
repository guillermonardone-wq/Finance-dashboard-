// Home page – All Markets dashboard
"use client";

import { useEffect, useState } from "react";
import MarketCard from "./components/MarketCard";
import CategoryFilter from "./components/CategoryFilter";
import SortSelect from "./components/SortSelect";

interface Market {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  resolutionDate: string | null;
  dislocationScore: number;
}

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("dislocation");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ category, sort });
    fetch(`/api/markets?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setMarkets(data);
        setLoading(false);
      });
  }, [category, sort]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">All Markets</h1>
        <p className="text-sm text-gray-400">
          Active prediction markets ranked by dislocation score
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <CategoryFilter active={category} onChange={setCategory} />
        <div className="ml-auto">
          <SortSelect value={sort} onChange={setSort} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading markets...</div>
      ) : markets.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No markets found. Run <code className="text-indigo-400">npm run db:seed</code> to
          populate sample data.
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
