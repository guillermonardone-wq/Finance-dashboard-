import { useState, useEffect } from 'react';
import { useMarketStore } from '../store/useMarketStore';

const WATCHLIST_DEFAULT = ['SPY', 'QQQ', 'TLT', 'GLD', 'USO', 'UUP', 'EEM', 'IWM'];
const FX_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD'];
const FRED_KEY_SERIES = ['US_CPI', 'US_GDP', 'US_UNEMPLOYMENT', 'FEDERAL_FUNDS_RATE', 'US_TREASURY_10Y', 'VIX'];
const WB_KEY_INDICATORS = ['GDP_GROWTH', 'INFLATION_CPI', 'UNEMPLOYMENT', 'TRADE_PCT_GDP', 'CURRENT_ACCOUNT_PCT_GDP'];

export default function MarketData() {
  const {
    prices, observations, providers, fredData, fredYieldCurve,
    worldBankData, worldBankIndicators, worldBankSearch, fxPairs,
    fetchPrice, fetchWatchlist, fetchObservations, fetchProviders,
    fetchFredData, fetchFredYieldCurve,
    fetchWorldBankData, fetchWorldBankIndicators, searchWorldBank,
    fetchFxPairs,
  } = useMarketStore();

  const [symbol, setSymbol] = useState('');
  const [wbQuery, setWbQuery] = useState('');
  const [wbCountry, setWbCountry] = useState('USA');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchObservations();
    fetchProviders();
    fetchWorldBankIndicators();
    setLastUpdated(new Date());
  }, [fetchObservations, fetchProviders, fetchWorldBankIndicators]);

  const hasAnyProvider = Object.values(providers).some(p => p.enabled);
  const hasFred = providers.fred?.enabled;
  const hasFinnhub = providers.finnhub?.enabled;
  const hasWorldBank = providers.worldbank?.enabled;

  const handleFetchWatchlist = () => {
    fetchWatchlist(WATCHLIST_DEFAULT);
    setLastUpdated(new Date());
  };
  const handleFetchSymbol = () => {
    if (symbol) { fetchPrice(symbol.toUpperCase()); setLastUpdated(new Date()); }
  };
  const handleFetchFredSeries = (seriesId) => {
    fetchFredData(seriesId);
    setLastUpdated(new Date());
  };
  const handleFetchYieldCurve = () => {
    fetchFredYieldCurve();
    setLastUpdated(new Date());
  };
  const handleFetchFx = () => {
    fetchFxPairs(FX_PAIRS);
    setLastUpdated(new Date());
  };
  const handleFetchWbData = (indicator) => {
    fetchWorldBankData(indicator, wbCountry);
    setLastUpdated(new Date());
  };
  const handleWbSearch = () => {
    if (wbQuery.trim()) searchWorldBank(wbQuery.trim());
  };
  const handleLoadAll = () => {
    handleFetchWatchlist();
    FRED_KEY_SERIES.forEach(s => handleFetchFredSeries(s));
    handleFetchYieldCurve();
    handleFetchFx();
    WB_KEY_INDICATORS.forEach(i => handleFetchWbData(i));
  };

  // Group seed observations by type
  const priceObs = observations.filter(o => o.observation_type === 'price');
  const macroObs = observations.filter(o => o.observation_type === 'macro_series');
  const calendarObs = observations.filter(o => o.observation_type === 'calendar_event');

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Market Data</h1>
          <p className="text-sm text-slate-500 mt-1">Observe conditions. Don't let drama substitute for data.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={handleLoadAll}
            className="px-4 py-2 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/20 font-medium">
            Load All Data
          </button>
        </div>
      </div>

      {/* Demo data banner */}
      {!hasAnyProvider && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-400 font-medium">
            Using demo data until providers are configured.
          </p>
          <p className="text-xs text-amber-500/70 mt-1">
            Add FRED_API_KEY, FINNHUB_API_KEY to .env for live data. World Bank Data360 requires no key.
          </p>
        </div>
      )}

      {/* Provider status strip */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <ProviderPill name="FRED" enabled={hasFred} desc="US Macro" />
        <ProviderPill name="World Bank" enabled={hasWorldBank} desc="Global Macro" />
        <ProviderPill name="Finnhub" enabled={hasFinnhub} desc="Stocks/ETFs/FX" />
      </div>

      {/* ============================================================ */}
      {/* US MACRO — FRED */}
      {/* ============================================================ */}
      <Section title="US Macro (FRED)" subtitle={hasFred ? 'Live data' : 'Demo data'}>
        <div className="flex gap-2 flex-wrap mb-4">
          {FRED_KEY_SERIES.map(series => (
            <button key={series} onClick={() => handleFetchFredSeries(series)}
              disabled={!hasFred}
              className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200 border border-slate-700 disabled:opacity-40">
              {series.replace(/_/g, ' ')}
            </button>
          ))}
          <button onClick={handleFetchYieldCurve} disabled={!hasFred}
            className="px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/20 disabled:opacity-40">
            Yield Curve
          </button>
        </div>

        {/* FRED data cards */}
        {Object.keys(fredData).length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {Object.entries(fredData).map(([seriesId, points]) => {
              if (!points || !Array.isArray(points) || points.length === 0) return null;
              const latest = points[0];
              const prev = latest.previousValue;
              const change = prev != null ? latest.value - prev : null;
              return (
                <div key={seriesId} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-slate-400 uppercase">{seriesId.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-slate-600">{latest.date}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold text-slate-100">
                      {latest.unit === 'percent' || latest.unit === 'index'
                        ? latest.value.toFixed(2)
                        : latest.value.toLocaleString()}
                    </span>
                    {latest.unit === 'percent' && <span className="text-xs text-slate-500">%</span>}
                    {change != null && (
                      <span className={`text-xs ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{latest.source_attribution}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Yield curve */}
        {fredYieldCurve && fredYieldCurve.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/30 mb-4">
            <h3 className="text-xs text-slate-400 uppercase mb-3">Treasury Yield Curve</h3>
            <div className="flex items-end gap-6 h-28">
              {fredYieldCurve.map((pt) => {
                const height = Math.max(8, (pt.rate / 6) * 100);
                return (
                  <div key={pt.maturity} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-cyan-400 font-mono">{pt.rate?.toFixed(2)}%</span>
                    <div className="w-8 bg-cyan-500/30 rounded-t" style={{ height: `${height}%` }} />
                    <span className="text-xs text-slate-500">{pt.maturity}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 mt-2">As of {fredYieldCurve[0]?.date}</p>
          </div>
        )}

        {/* Fallback: seeded macro observations */}
        {Object.keys(fredData).length === 0 && macroObs.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {macroObs.map(obs => {
              const d = obs.data || {};
              return (
                <div key={obs.id} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-slate-400">{obs.name}</span>
                    <span className="text-xs text-slate-600">{d.date}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-bold text-slate-100">{d.value}{d.unit === 'percent' ? '%' : ''}</span>
                    {d.previousValue != null && (
                      <span className={`text-xs ${d.value >= d.previousValue ? 'text-emerald-400' : 'text-red-400'}`}>
                        prev: {d.previousValue}{d.unit === 'percent' ? '%' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{d.source_attribution || 'Seeded data'}</p>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ============================================================ */}
      {/* GLOBAL MACRO — World Bank Data360 */}
      {/* ============================================================ */}
      <Section title="Global Macro (World Bank Data360)" subtitle={hasWorldBank ? 'Live data — no key required' : 'Unavailable'}>
        {/* Search panel */}
        <div className="flex gap-2 mb-4">
          <input value={wbQuery} onChange={e => setWbQuery(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 flex-1"
            placeholder="Search indicators: inflation, GDP, trade..."
            onKeyDown={e => e.key === 'Enter' && handleWbSearch()} />
          <button onClick={handleWbSearch} disabled={!hasWorldBank}
            className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200 disabled:opacity-40">
            Search
          </button>
        </div>

        {/* Country selector and indicator buttons */}
        <div className="flex gap-2 flex-wrap mb-4 items-center">
          <select value={wbCountry} onChange={e => setWbCountry(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300">
            <option value="USA">USA</option>
            <option value="CHN">China</option>
            <option value="JPN">Japan</option>
            <option value="DEU">Germany</option>
            <option value="GBR">UK</option>
            <option value="FRA">France</option>
            <option value="IND">India</option>
            <option value="BRA">Brazil</option>
            <option value="WLD">World</option>
          </select>
          {WB_KEY_INDICATORS.map(ind => (
            <button key={ind} onClick={() => handleFetchWbData(ind)} disabled={!hasWorldBank}
              className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded hover:text-slate-200 border border-slate-700 disabled:opacity-40">
              {ind.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Search results */}
        {worldBankSearch && worldBankSearch.results?.length > 0 && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/20 mb-4 max-h-48 overflow-y-auto">
            <h4 className="text-xs text-slate-400 mb-2">Search Results ({worldBankSearch.total})</h4>
            {worldBankSearch.results.map((r, i) => (
              <div key={i} className="py-1.5 border-b border-slate-800 last:border-0">
                <p className="text-xs text-slate-300">{r.name}</p>
                <p className="text-xs text-slate-600">{r.id}</p>
              </div>
            ))}
          </div>
        )}

        {/* World Bank data cards */}
        {Object.keys(worldBankData).length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(worldBankData).map(([indicator, result]) => {
              if (!result?.observations?.length) return null;
              // Get latest per country
              const byCountry = {};
              for (const obs of result.observations) {
                if (!byCountry[obs.country]) byCountry[obs.country] = obs;
              }
              return (
                <div key={indicator} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                  <h4 className="text-xs text-slate-400 uppercase mb-2">{result.name || indicator.replace(/_/g, ' ')}</h4>
                  <div className="space-y-1">
                    {Object.entries(byCountry).map(([country, obs]) => (
                      <div key={country} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 w-10">{country}</span>
                        <span className="text-slate-200 font-mono">
                          {obs.unit === 'percent' ? `${obs.value.toFixed(1)}%` : obs.value.toLocaleString()}
                        </span>
                        <span className="text-slate-600">{obs.date}</span>
                        {obs.previousValue != null && (
                          <span className={`${obs.value >= obs.previousValue ? 'text-emerald-400' : 'text-red-400'}`}>
                            {obs.value >= obs.previousValue ? '+' : ''}{(obs.value - obs.previousValue).toFixed(1)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{result.observations[0]?.source_attribution}</p>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ============================================================ */}
      {/* STOCK / ETF PRICES */}
      {/* ============================================================ */}
      <Section title="Stocks & ETFs" subtitle={hasFinnhub ? 'Live data' : 'Demo data'}>
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
              if (!data) return null;
              const priceData = data.data || data;
              const p = priceData?.price || priceData?.c || 0;
              const cp = priceData?.changePercent || priceData?.dp || 0;
              return (
                <div key={sym} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-slate-200">{priceData?.symbol || sym}</span>
                    <span className={`text-xs ${cp >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {cp >= 0 ? '+' : ''}{cp.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-100 mt-1">${p.toFixed(2)}</p>
                  {priceData?.source_attribution && (
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
          <p className="text-xs text-slate-600">Click "Load Watchlist" or "Load All Data" to fetch prices.</p>
        )}
      </Section>

      {/* ============================================================ */}
      {/* FX vs USD */}
      {/* ============================================================ */}
      <Section title="FX Pairs vs USD" subtitle={hasFinnhub ? 'Live data' : 'Not available without Finnhub'}>
        <div className="flex gap-2 mb-4">
          <button onClick={handleFetchFx} disabled={!hasFinnhub}
            className="px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/20 disabled:opacity-40">
            Load FX Pairs
          </button>
          <span className="text-xs text-slate-600 self-center">
            {FX_PAIRS.join(', ')}
          </span>
        </div>

        {Object.keys(fxPairs).length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(fxPairs).map(([pair, data]) => {
              if (data.error) {
                return (
                  <div key={pair} className="bg-slate-800/50 rounded p-3 border border-red-900/30">
                    <span className="text-sm font-mono text-slate-400">{pair}</span>
                    <p className="text-xs text-red-400 mt-1">{data.error}</p>
                  </div>
                );
              }
              return (
                <div key={pair} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-slate-200">{data.symbol || pair}</span>
                    <span className={`text-xs ${(data.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(data.changePercent || 0) >= 0 ? '+' : ''}{(data.changePercent || 0).toFixed(3)}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-100 mt-1">{(data.price || 0).toFixed(4)}</p>
                  <p className="text-xs text-slate-600 mt-1">{data.source_attribution}</p>
                </div>
              );
            })}
          </div>
        ) : !hasFinnhub ? (
          <p className="text-xs text-slate-600">
            Add FINNHUB_API_KEY to .env to enable live FX quotes.
          </p>
        ) : (
          <p className="text-xs text-slate-600">Click "Load FX Pairs" to fetch forex data.</p>
        )}
      </Section>

      {/* ============================================================ */}
      {/* UPCOMING EVENTS */}
      {/* ============================================================ */}
      {calendarObs.length > 0 && (
        <Section title="Upcoming Events" subtitle="Seeded data">
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
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{title}</h2>
        {subtitle && (
          <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ProviderPill({ name, enabled, desc }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs border ${
      enabled ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <span className="font-medium">{name}</span>
      <span className={enabled ? 'text-emerald-500/70' : 'text-slate-600'}>{desc}</span>
    </div>
  );
}
