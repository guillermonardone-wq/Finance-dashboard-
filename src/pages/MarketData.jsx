import { useState } from 'react';
import { useMarketStore } from '../store/useMarketStore';

const WATCHLIST_DEFAULT = ['SPY', 'QQQ', 'TLT', 'GLD', 'USO', 'UUP', 'EEM', 'VIX'];
const MACRO_SERIES = ['US_CPI', 'US_GDP', 'FEDERAL_FUNDS_RATE', 'US_UNEMPLOYMENT', 'US_INFLATION'];

export default function MarketData() {
  const { prices, news, macroData, fetchPrice, fetchWatchlist, fetchNews, fetchMacroSeries } = useMarketStore();
  const [symbol, setSymbol] = useState('');
  const [newsQuery, setNewsQuery] = useState('');

  const handleFetchWatchlist = () => fetchWatchlist(WATCHLIST_DEFAULT);
  const handleFetchSymbol = () => { if (symbol) fetchPrice(symbol.toUpperCase()); };
  const handleFetchNews = () => fetchNews(newsQuery || 'geopolitics oil sanctions');

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Market Data</h1>
        <p className="text-sm text-slate-500 mt-1">Observe conditions. Don't let drama substitute for data.</p>
      </div>

      {/* Price section */}
      <Section title="Prices">
        <div className="flex gap-2 mb-4">
          <button onClick={handleFetchWatchlist}
            className="px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/20">
            Load Watchlist
          </button>
          <input value={symbol} onChange={e => setSymbol(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 w-24"
            placeholder="Symbol" onKeyDown={e => e.key === 'Enter' && handleFetchSymbol()} />
          <button onClick={handleFetchSymbol}
            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200">
            Fetch
          </button>
        </div>

        {Object.keys(prices).length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(prices).map(([sym, result]) => {
              const data = result?.data?.data || result?.data || result;
              if (!data?.price && !data?.success) return null;
              const priceData = data.data || data;
              return (
                <div key={sym} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-slate-200">{priceData.symbol || sym}</span>
                    <span className={`text-xs ${(priceData.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(priceData.changePercent || 0) >= 0 ? '+' : ''}{(priceData.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-100 mt-1">${(priceData.price || 0).toFixed(2)}</p>
                  {priceData.source_attribution && (
                    <p className="text-xs text-slate-600 mt-1">{priceData.source_attribution}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-600">Click "Load Watchlist" to fetch market prices.</p>
        )}
      </Section>

      {/* Macro section */}
      <Section title="Macro Series">
        <div className="flex gap-2 flex-wrap mb-4">
          {MACRO_SERIES.map(series => (
            <button key={series} onClick={() => fetchMacroSeries(series)}
              className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200 border border-slate-700">
              {series.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        {Object.entries(macroData).map(([seriesId, result]) => {
          const points = result?.data?.data?.points || result?.data?.points || [];
          if (points.length === 0) return null;
          const latest = points[0];
          return (
            <div key={seriesId} className="bg-slate-800/50 rounded p-3 border border-slate-700/30 mb-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-200">{latest?.name || seriesId}</span>
                <span className="text-sm font-mono text-cyan-400">{latest?.value}</span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 mt-1">
                <span>Date: {latest?.date}</span>
                {latest?.previousValue && <span>Prev: {latest.previousValue}</span>}
                {latest?.source_attribution && <span>{latest.source_attribution}</span>}
              </div>
            </div>
          );
        })}
      </Section>

      {/* News section */}
      <Section title="News Feed">
        <div className="flex gap-2 mb-4">
          <input value={newsQuery} onChange={e => setNewsQuery(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 flex-1"
            placeholder="Search: geopolitics oil sanctions..."
            onKeyDown={e => e.key === 'Enter' && handleFetchNews()} />
          <button onClick={handleFetchNews}
            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200">
            Search News
          </button>
        </div>
        {news.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {news.map((article, i) => (
              <div key={i} className="bg-slate-800/30 rounded p-3 border border-slate-700/20">
                <a href={article.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-slate-200 hover:text-cyan-400">{article.title}</a>
                {article.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{article.description}</p>
                )}
                <div className="flex gap-2 mt-2 text-xs text-slate-600">
                  <span>{article.source}</span>
                  <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}</span>
                  {article.source_attribution && <span>{article.source_attribution}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600">Click "Search News" to fetch headlines.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}
