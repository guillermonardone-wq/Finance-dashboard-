export default function OptionsFlowTable({ data, activeTicker }) {
  const filtered = activeTicker === 'ALL' ? data : data.filter(d => d.ticker === activeTicker);

  function formatValue(val) {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val}`;
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Live Options Flow</h2>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.length} orders</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400">Real-time</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-700/30">
              {['Time', 'Ticker', 'Exp', 'Strike', 'C/P', 'Spot', 'Type', 'Size', 'Premium', 'Value', 'Vol/OI', 'Exchange'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 40).map(row => (
              <tr
                key={row.id}
                className={`border-b border-slate-700/20 transition-colors hover:bg-slate-700/30 ${
                  row.isUnusual ? 'bg-amber-500/5' : ''
                }`}
              >
                <td className="px-3 py-2 font-mono text-slate-400">{row.time}</td>
                <td className="px-3 py-2 font-bold text-white">{row.ticker}</td>
                <td className="px-3 py-2 text-slate-300">{row.expiration}</td>
                <td className="px-3 py-2 font-mono text-white">${row.strike}</td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    row.type === 'Call'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-semibold ${
                    row.sentiment === 'Bullish' ? 'text-emerald-400'
                      : row.sentiment === 'Bearish' ? 'text-red-400'
                      : 'text-slate-400'
                  }`}>
                    {row.sentiment}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    row.orderType === 'Sweep' ? 'bg-purple-500/15 text-purple-400' : 'text-slate-400'
                  }`}>
                    {row.orderType}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-white">{row.size.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-slate-300">${row.premium}</td>
                <td className="px-3 py-2 font-mono font-semibold text-white">{formatValue(row.totalValue)}</td>
                <td className="px-3 py-2">
                  <span className={`font-mono ${
                    parseFloat(row.volOiRatio) > 2 ? 'text-amber-400 font-semibold' : 'text-slate-400'
                  }`}>
                    {row.volOiRatio}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-500">{row.exchange}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
