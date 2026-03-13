import { useState, useEffect } from 'react';

export default function Header({ summary, activeTicker, onTickerChange }) {
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const marketOpen = clock.getHours() >= 9 && clock.getHours() < 16;

  return (
    <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white tracking-tight">
            <span className="text-emerald-400">Options</span>Flow
          </h1>
          <div className="flex items-center gap-1.5 ml-4">
            <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-slate-400">
              {marketOpen ? 'Market Open' : 'Market Closed'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {['ALL', 'SPY', 'QQQ', 'AAPL'].map(t => (
              <button
                key={t}
                onClick={() => onTickerChange(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeTicker === t
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-sm font-mono text-slate-400">
            {clock.toLocaleTimeString('en-US')}
          </span>
        </div>
      </div>

      {summary && (
        <div className="px-6 pb-3 flex gap-4 overflow-x-auto">
          {summary.map(s => (
            <div key={s.ticker} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-4 py-2 min-w-fit">
              <span className="text-sm font-bold text-white">{s.ticker}</span>
              <span className="text-sm font-mono text-white">${s.price}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                parseFloat(s.change) >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
              }`}>
                {parseFloat(s.change) >= 0 ? '+' : ''}{s.change}%
              </span>
              <div className="flex items-center gap-2 ml-2 border-l border-slate-700 pl-2">
                <span className="text-xs text-slate-500">IV Rank</span>
                <span className={`text-xs font-semibold ${
                  s.ivRank > 50 ? 'text-amber-400' : 'text-slate-300'
                }`}>{s.ivRank}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
