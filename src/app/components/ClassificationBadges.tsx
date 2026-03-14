// Renders classification labels as colored pills
"use client";

const LABEL_MAP: Record<string, { text: string; color: string }> = {
  internal_inconsistency: { text: "Internal Inconsistency", color: "bg-red-500/20 text-red-400" },
  lagging_repricing: { text: "Lagging Repricing", color: "bg-orange-500/20 text-orange-400" },
  thin_liquidity_trap: { text: "Thin Liquidity Trap", color: "bg-yellow-500/20 text-yellow-400" },
  unusual_volatility: { text: "Unusual Volatility", color: "bg-purple-500/20 text-purple-400" },
  high_dispersion: { text: "High Dispersion", color: "bg-blue-500/20 text-blue-400" },
};

export default function ClassificationBadges({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => {
        const info = LABEL_MAP[label] ?? { text: label, color: "bg-gray-700 text-gray-300" };
        return (
          <span
            key={label}
            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${info.color}`}
          >
            {info.text}
          </span>
        );
      })}
    </div>
  );
}
