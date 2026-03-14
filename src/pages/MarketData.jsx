import { useState, useEffect } from 'react';
import { useMarketStore } from '../store/useMarketStore';

const WATCHLIST_DEFAULT = ['SPY', 'QQQ', 'TLT', 'GLD', 'USO', 'UUP', 'EEM', 'VIX'];
const MACRO_SERIES = ['US_CPI', 'US_GDP', 'FEDERAL_FUNDS_RATE', 'US_UNEMPLOYMENT', 'US_INFLATION'];

export default function MarketData() {
  const {
    prices, news, macroData, observations, providers,
    fetchPrice, fetchWatchlist, fetchNews, fetchMacroSeries,
    fetchObservations, fetchProviders,
  } = useMarketStore();
  const [symbol, setSymbol] = useState('');
  const [newsQuery, setNewsQuery] = useState('');

  // Load seeded observations and provider status on mount
  useEffect(() => {
    fetchObservations();
    fetchProviders();
  }, [fetchObservations, fetchProviders]);

  const handleFetchWatchlist = () => fetchWatchlist(WATCHLIST_DEFAULT);
  const handleFetchSymbol = () => { if (symbol) fetchPrice(symbol.toUpperCase()); };
  const handleFetchNews = () => fetchNews(newsQuery || 'geopolitics oil sanctions');

  const hasAnyProvider = Object.values(providers).some(p => p.enabled);

  // Group observations by type for display
  const priceObs = observations.filter(o => o.observation_type === 'price');
  const macroObs = observations.filter(o => o.observation_type === 'macro_series');
  const newsObs = observations.filter(o => o.observation_type === 'news');
  const calendarObs = observations.filter(o => o.observation_type === 'calendar_event');
  const sentimentObs = observations.filter(o => o.observation_type === 'sentiment' || o.observation_type === 'volatility');

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Market Data</h1>
        <p className="text-sm text-slate-500 mt-1">Observe conditions. Don't let drama substitute for data.</p>
      </div>

      {!hasAnyProvider && observations.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-400">
            No live providers configured. Showing seeded demo data. Add API keys in .env to enable live feeds.
          </p>
        </div>
      )}

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
        ) : priceObs.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {priceObs.map(obs => {
              const d = obs.data || {};
              return (
                <div key={obs.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-slate-200">{obs.symbol || obs.name}</span>
                    <span className={`text-xs ${(d.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(d.changePercent || 0) >= 0 ? '+' : ''}{(d.changePercent || 0).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-100 mt-1">${(d.price || 0).toFixed(2)}</p>
                  <p className="text-xs text-slate-600 mt-1">{d.source_attribution || 'Seeded data'}</p>
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
        {/* Fallback: show seeded macro observations */}
        {Object.keys(macroData).length === 0 && macroObs.length > 0 && (
          <div className="space-y-2">
            {macroObs.map(obs => {
              const d = obs.data || {};
              return (
                <div key={obs.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-200">{obs.name}</span>
                    <span className="text-sm font-mono text-cyan-400">{d.value}{d.unit === 'percent' ? '%' : ''}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-slate-500 mt-1">
                    <span>Date: {d.date}</span>
                    {d.previousValue != null && <span>Prev: {d.previousValue}{d.unit === 'percent' ? '%' : ''}</span>}
                    <span>{d.source_attribution || 'Seeded data'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Upcoming Events */}
      {calendarObs.length > 0 && (
        <Section title="Upcoming Events">
          <div className="space-y-2">
            {calendarObs.map(obs => {
              const d = obs.data || {};
              return (
                <div key={obs.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/30 flex justify-between items-center">
                  <div>
                    <span className="text-sm text-slate-200">{d.title || obs.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{d.country}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-cyan-400">{d.date}</span>
                    {d.impact && (
                      <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${
                        d.impact === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-500'
                      }`}>{d.impact}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Market Intelligence */}
      {sentimentObs.length > 0 && (
        <Section title="Market Intelligence">
          <div className="space-y-2">
            {sentimentObs.map(obs => {
              const d = obs.data || {};
              return (
                <div key={obs.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-200">{obs.name}</span>
                    <span className="text-xs text-slate-500">{obs.symbol}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{d.description}</p>
                  <p className="text-xs text-slate-600 mt-1">{d.source_attribution}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

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
        ) : newsObs.length > 0 ? (
          <div className="space-y-2">
            {newsObs.map(obs => {
              const d = obs.data || {};
              return (
                <div key={obs.id} className="bg-slate-800/30 rounded p-3 border border-slate-700/20">
                  <p className="text-sm text-slate-200">{d.title || obs.name}</p>
                  <div className="flex gap-2 mt-1 text-xs text-slate-600">
                    <span>{d.source || 'Seeded'}</span>
                    <span>{d.source_attribution}</span>
                  </div>
                </div>
              );
            })}
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
