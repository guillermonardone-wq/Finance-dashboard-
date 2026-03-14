import { useEffect } from 'react';
import { useMarketStore } from '../store/useMarketStore';

const ENV_HINTS = {
  finnhub: { var: 'FINNHUB_API_KEY', desc: 'Stocks, ETFs, FX pairs, news, calendar', url: 'https://finnhub.io/register' },
  alpha_vantage: { var: 'ALPHA_VANTAGE_API_KEY', desc: 'Fallback prices, macro data', url: 'https://www.alphavantage.co/support/#api-key' },
  newsapi: { var: 'NEWSAPI_API_KEY', desc: 'News headlines', url: 'https://newsapi.org/register' },
  fred: { var: 'FRED_API_KEY', desc: 'US macro: CPI, GDP, unemployment, rates, yield curves', url: 'https://fred.stlouisfed.org/docs/api/api_key.html' },
  worldbank: { var: null, desc: 'Global macro: GDP, inflation, trade by country (no key needed)', url: null },
};

export default function ProviderHealth() {
  const { providers, fetchProviders } = useMarketStore();

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const providerList = Object.entries(providers);
  const enabledCount = providerList.filter(([, p]) => p.enabled).length;
  const totalCount = providerList.length;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Provider Health</h1>
        <p className="text-sm text-slate-500 mt-1">Data quality directly affects decision quality. Monitor staleness.</p>
      </div>

      {/* Summary banner */}
      <div className={`rounded-lg border p-4 mb-6 ${
        enabledCount === 0 ? 'bg-red-950/20 border-red-900/30'
          : enabledCount < totalCount ? 'bg-amber-950/20 border-amber-900/30'
            : 'bg-emerald-950/20 border-emerald-900/30'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <span className={`text-lg font-bold ${
            enabledCount === 0 ? 'text-red-400' : enabledCount < totalCount ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {enabledCount}/{totalCount} Providers Active
          </span>
        </div>
        {enabledCount === 0 && (
          <p className="text-xs text-red-400">
            No providers configured. Using demo/seed data only. Add API keys to .env to enable live data.
          </p>
        )}
        {enabledCount > 0 && enabledCount < totalCount && (
          <p className="text-xs text-amber-400">
            Some providers are disabled. Add missing API keys to .env for full coverage.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {providerList.map(([name, provider]) => {
          const hint = ENV_HINTS[name];
          return (
            <div key={name} className={`bg-slate-900 rounded-lg border p-4 ${
              provider.enabled ? 'border-slate-800' : 'border-red-900/30'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${provider.enabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <h3 className="text-sm font-bold text-slate-200">{name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    provider.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {provider.enabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{provider.requestCount || 0} requests</span>
              </div>

              {/* Capabilities */}
              <div className="flex gap-1 flex-wrap mb-3">
                {Object.entries(provider.capabilities || {}).map(([cap, enabled]) => (
                  <span key={cap} className={`text-xs px-2 py-0.5 rounded ${
                    enabled ? 'bg-slate-800 text-slate-400' : 'bg-slate-900 text-slate-700'
                  }`}>
                    {cap}
                  </span>
                ))}
              </div>

              {/* Configuration hint */}
              {!provider.enabled && hint && (
                <div className="text-xs bg-amber-500/5 border border-amber-500/10 rounded p-2 mb-2">
                  {hint.var ? (
                    <p className="text-amber-400">
                      Add <code className="bg-slate-800 px-1 rounded">{hint.var}</code> to .env — {hint.desc}
                    </p>
                  ) : (
                    <p className="text-amber-400">{hint.desc}</p>
                  )}
                </div>
              )}

              {/* Last error */}
              {provider.lastError && (
                <div className="text-xs text-red-400 bg-red-400/5 rounded p-2 border border-red-400/10">
                  <span className="font-medium">Last Error:</span> {provider.lastError.message}
                  <span className="text-red-500 ml-2">({provider.lastError.time})</span>
                </div>
              )}
            </div>
          );
        })}

        {providerList.length === 0 && (
          <p className="text-sm text-slate-600 text-center py-12">
            Loading provider status...
          </p>
        )}
      </div>

      <div className="mt-6 bg-slate-900 rounded-lg border border-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Required Environment Variables</h3>
        <div className="text-xs text-slate-500 space-y-2">
          {Object.entries(ENV_HINTS).map(([name, hint]) => (
            <div key={name} className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${providers[name]?.enabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <code className="text-slate-400 w-40">{hint.var || '(none)'}</code>
              <span>{hint.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
