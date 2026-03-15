export default function UnusualSweeps({ data, activeTicker }) {
  const filtered = activeTicker === 'ALL' ? data : data.filter(d => d.ticker === activeTicker);

  function formatValue(val) {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val}`;
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
        <span className="text-purple-400 text-lg">&#9889;</span>
        <div>
          <h2 className="text-sm font-semibold text-white">Unusual Sweeps</h2>
          <p className="text-xs text-slate-400 mt-0.5">Aggressive multi-exchange fills</p>
        </div>
        <span className="ml-auto bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {filtered.length} alerts
        </span>
      </div>
      <div className="divide-y divide-slate-700/30 max-h-96 overflow-y-auto">
        {filtered.map(sweep => (
          <div key={sweep.id} className="px-5 py-3 hover:bg-slate-700/20 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{sweep.ticker}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  sweep.type === 'Call'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {sweep.type}
                </span>
                <span className="text-slate-400 text-xs">${sweep.strike} {sweep.expiration}</span>
              </div>
              <span className="font-mono font-bold text-white text-sm">{formatValue(sweep.totalValue)}</span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="text-slate-500">{sweep.time}</span>
              <span className="text-slate-400">Size: <span className="text-white font-mono">{sweep.size.toLocaleString()}</span></span>
              <span className="text-slate-400">Vol/OI: <span className={`font-mono ${
                parseFloat(sweep.volOiRatio) > 2 ? 'text-amber-400' : 'text-white'
              }`}>{sweep.volOiRatio}</span></span>
              <span className={`ml-auto text-[10px] font-semibold ${
                sweep.sentiment === 'Bullish' ? 'text-emerald-400'
                  : sweep.sentiment === 'Bearish' ? 'text-red-400'
                  : 'text-slate-400'
              }`}>
                {sweep.sentiment}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">No unusual sweeps detected</div>
        )}
      </div>
    </div>
  );
}
