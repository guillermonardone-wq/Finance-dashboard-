import { useEffect } from 'react';
import { useMarketStore } from '../store/useMarketStore';

export default function ProviderHealth() {
  const { providers, fetchProviders } = useMarketStore();

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const providerList = Object.entries(providers);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Provider Health</h1>
        <p className="text-sm text-slate-500 mt-1">Data quality directly affects decision quality. Monitor staleness.</p>
      </div>

      <div className="space-y-3">
        {providerList.map(([name, provider]) => (
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

            {/* Last error */}
            {provider.lastError && (
              <div className="text-xs text-red-400 bg-red-400/5 rounded p-2 border border-red-400/10">
                <span className="font-medium">Last Error:</span> {provider.lastError.message}
                <span className="text-red-500 ml-2">({provider.lastError.time})</span>
              </div>
            )}
          </div>
        ))}

        {providerList.length === 0 && (
          <p className="text-sm text-slate-600 text-center py-12">
            No providers configured. Check your .env file.
          </p>
        )}
      </div>

      <div className="mt-6 bg-slate-900 rounded-lg border border-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-2">Configuration</h3>
        <p className="text-xs text-slate-500">
          Provider API keys are configured in <code className="text-slate-400">.env</code>.
          See <code className="text-slate-400">.env.example</code> for required variables.
        </p>
        <div className="mt-3 text-xs text-slate-600 space-y-1">
          <p>ALPHA_VANTAGE_API_KEY — price, macro, news, sentiment</p>
          <p>FINNHUB_API_KEY — price, calendar, news, sentiment</p>
          <p>NEWSAPI_API_KEY — news headlines</p>
        </div>
      </div>
    </div>
  );
}
