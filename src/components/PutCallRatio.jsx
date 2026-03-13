export default function PutCallRatio({ data }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
        <span className="text-amber-400 text-lg">&#9878;</span>
        <div>
          <h2 className="text-sm font-semibold text-white">Put/Call Ratio</h2>
          <p className="text-xs text-slate-400 mt-0.5">Market sentiment indicator</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {data.map(item => {
          const callPct = (item.totalCalls / (item.totalCalls + item.totalPuts) * 100).toFixed(0);
          const putPct = (100 - callPct).toFixed(0);

          return (
            <div key={item.ticker} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{item.ticker}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.sentiment === 'Bullish' ? 'bg-emerald-500/15 text-emerald-400'
                      : item.sentiment === 'Bearish' ? 'bg-red-500/15 text-red-400'
                      : 'bg-slate-600/30 text-slate-400'
                  }`}>
                    {item.sentiment}
                  </span>
                </div>
                <span className={`text-lg font-bold font-mono ${
                  item.ratio > 1.0 ? 'text-red-400' : item.ratio < 0.7 ? 'text-emerald-400' : 'text-white'
                }`}>
                  {item.ratio}
                </span>
              </div>

              <div className="flex h-3 rounded-full overflow-hidden bg-slate-900">
                <div
                  className="bg-emerald-500/60 transition-all duration-500"
                  style={{ width: `${callPct}%` }}
                />
                <div
                  className="bg-red-500/60 transition-all duration-500"
                  style={{ width: `${putPct}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px]">
                <span className="text-emerald-400">Calls: {item.totalCalls.toLocaleString()} ({callPct}%)</span>
                <span className="text-red-400">Puts: {item.totalPuts.toLocaleString()} ({putPct}%)</span>
              </div>

              <div className="flex gap-1 items-end h-8">
                {item.history.map((val, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm transition-all ${
                      val > 1.0 ? 'bg-red-500/40' : 'bg-emerald-500/40'
                    }`}
                    style={{ height: `${Math.min(100, (val / 2) * 100)}%` }}
                    title={`P/C: ${val}`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] mt-1">
                <div className="bg-slate-900/50 rounded px-2 py-1.5">
                  <span className="text-slate-500">Call OI: </span>
                  <span className="text-white font-mono">{(item.callOI / 1000).toFixed(0)}K</span>
                </div>
                <div className="bg-slate-900/50 rounded px-2 py-1.5">
                  <span className="text-slate-500">Put OI: </span>
                  <span className="text-white font-mono">{(item.putOI / 1000).toFixed(0)}K</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
