const SOURCE_BADGE_COLORS = {
  manual: "bg-slate-700 text-slate-300",
  fred: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  gdelt: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  news_feed: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  market_data: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
  government: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
};

export default function SourceBadge({ type }) {
  const colors = SOURCE_BADGE_COLORS[type] || "bg-slate-700 text-slate-400";
  const label =
    type === "news_feed"
      ? "news"
      : type === "market_data"
        ? "market"
        : (type || "").replace(/_/g, " ");

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors}`}>
      {label}
    </span>
  );
}
