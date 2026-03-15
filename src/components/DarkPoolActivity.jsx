export default function DarkPoolActivity({ data, activeTicker }) {
  const filtered = activeTicker === 'ALL' ? data : data.filter(d => d.ticker === activeTicker);

  function formatNotional(val) {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val}`;
  }

  const totalNotional = filtered.reduce((sum, d) => sum + d.notionalValue, 0);
  const blockCount = filtered.filter(d => d.type === 'Block').length;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 text-lg">&#9679;</span>
          <div>
            <h2 className="text-sm font-semibold text-white">Dark Pool Activity</h2>
            <p className="text-xs text-slate-400 mt-0.5">Off-exchange prints & blocks</p>
          </div>
        </div>
        <div className="flex gap-4 mt-3">
          <div className="bg-slate-900/50 rounded-lg px-3 py-2 flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Notional</p>
            <p className="text-sm font-bold text-white font-mono">{formatNotional(totalNotional)}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg px-3 py-2 flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Blocks</p>
            <p className="text-sm font-bold text-cyan-400 font-mono">{blockCount}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg px-3 py-2 flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Prints</p>
            <p className="text-sm font-bold text-white font-mono">{filtered.length}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
        {filtered.map(dp => (
          <div key={dp.id} className="px-5 py-2.5 hover:bg-slate-700/20 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{dp.ticker}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  dp.type === 'Block' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-slate-600/30 text-slate-400'
                }`}>
                  {dp.type}
                </span>
              </div>
              <span className="font-mono text-white text-sm">{formatNotional(dp.notionalValue)}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-[11px]">
              <span className="text-slate-500">{dp.time}</span>
              <span className="text-slate-400">{dp.shares.toLocaleString()} shares @ ${dp.price}</span>
              <span className="text-slate-500">{dp.venue}</span>
              <span className={`ml-auto text-[10px] font-semibold ${
                dp.aboveBelow === 'Above Ask' ? 'text-emerald-400'
                  : dp.aboveBelow === 'Below Bid' ? 'text-red-400'
                  : 'text-slate-400'
              }`}>
                {dp.aboveBelow}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
