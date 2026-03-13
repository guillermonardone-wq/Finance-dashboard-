import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useThesisStore } from '../store/useThesisStore';
import { useSignalStore } from '../store/useSignalStore';
import { useMarketStore } from '../store/useMarketStore';
import { ClassificationBadge, CompositeScoreBar } from '../components/common/ScoreDisplay';

export default function Dashboard() {
  const { theses, fetchTheses } = useThesisStore();
  const { signals, fetchSignals } = useSignalStore();
  const { providers, fetchProviders } = useMarketStore();

  useEffect(() => {
    fetchTheses();
    fetchSignals({ status: 'inbox' });
    fetchProviders();
  }, [fetchTheses, fetchSignals, fetchProviders]);

  const activeTheses = theses.filter(t => ['active', 'executing', 'approved'].includes(t.status));
  const quarantined = theses.filter(t => t.status === 'quarantined');
  const inboxSignals = signals.filter(s => s.status === 'inbox');
  const enabledProviders = Object.values(providers).filter(p => p.enabled);
  const disabledProviders = Object.values(providers).filter(p => !p.enabled);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">Process before action. Evidence before conviction.</p>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatusCard label="Active Theses" value={activeTheses.length} color="cyan" />
        <StatusCard label="Inbox Signals" value={inboxSignals.length} color="amber" />
        <StatusCard label="Quarantined" value={quarantined.length} color="red" />
        <StatusCard
          label="Providers"
          value={`${enabledProviders.length}/${enabledProviders.length + disabledProviders.length}`}
          color={enabledProviders.length > 0 ? 'emerald' : 'red'}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Theses */}
        <div className="col-span-2 bg-slate-900 rounded-lg border border-slate-800 p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Active Theses</h2>
            <Link to="/thesis/new" className="text-xs text-cyan-400 hover:text-cyan-300">+ New Thesis</Link>
          </div>
          {activeTheses.length === 0 ? (
            <p className="text-sm text-slate-600 py-8 text-center">No active theses. Start by capturing signals.</p>
          ) : (
            <div className="space-y-3">
              {activeTheses.map(thesis => (
                <Link key={thesis.id} to={`/thesis/${thesis.id}`} className="block">
                  <div className="bg-slate-800/50 rounded-lg p-3 hover:bg-slate-800 transition-colors border border-slate-700/30">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-sm font-medium text-slate-200 flex-1 mr-3">{thesis.title}</h3>
                      <ClassificationBadge classification={thesis.classification} />
                    </div>
                    <CompositeScoreBar score={thesis.composite_score || 0} />
                    <div className="flex gap-3 mt-2 text-xs text-slate-500">
                      <span>P: {((thesis.probability_best || 0) * 100).toFixed(0)}%</span>
                      {thesis.expected_timeline?.end && (
                        <span>Exp: {thesis.expected_timeline.end}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Signal Inbox */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Signal Inbox</h2>
              <Link to="/signals" className="text-xs text-cyan-400 hover:text-cyan-300">View All</Link>
            </div>
            {inboxSignals.length === 0 ? (
              <p className="text-xs text-slate-600 py-4 text-center">Inbox empty.</p>
            ) : (
              <div className="space-y-2">
                {inboxSignals.slice(0, 5).map(signal => (
                  <div key={signal.id} className="text-xs bg-slate-800/30 rounded p-2 border border-slate-700/20">
                    <p className="text-slate-300 font-medium">{signal.title}</p>
                    <div className="flex gap-2 mt-1 text-slate-600">
                      <span className="bg-slate-800 px-1.5 py-0.5 rounded">{signal.category}</span>
                      <span>{signal.novelty}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quarantine */}
          {quarantined.length > 0 && (
            <div className="bg-red-950/20 rounded-lg border border-red-900/30 p-4">
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">Quarantined</h2>
              <div className="space-y-2">
                {quarantined.map(t => (
                  <Link key={t.id} to={`/thesis/${t.id}`} className="block">
                    <div className="text-xs text-red-300 bg-red-900/10 rounded p-2 border border-red-900/20">
                      {t.title}
                      {t.quarantine_reason && (
                        <p className="text-red-500 mt-1">{t.quarantine_reason}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Provider Health */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Data Providers</h2>
            {Object.entries(providers).map(([name, p]) => (
              <div key={name} className="flex items-center gap-2 py-1 text-xs">
                <span className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-slate-400">{name}</span>
                <span className="text-slate-600 ml-auto">{p.requestCount || 0} req</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value, color }) {
  const colorMap = {
    cyan: 'text-cyan-400 border-cyan-400/20',
    amber: 'text-amber-400 border-amber-400/20',
    red: 'text-red-400 border-red-400/20',
    emerald: 'text-emerald-400 border-emerald-400/20',
  };
  return (
    <div className={`bg-slate-900 rounded-lg border p-3 ${colorMap[color] || 'border-slate-800'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]?.split(' ')[0] || 'text-slate-300'}`}>{value}</p>
    </div>
  );
}
