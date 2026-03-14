import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThesisStore } from '../store/useThesisStore';
import { useSignalStore } from '../store/useSignalStore';
import { useMarketStore } from '../store/useMarketStore';
import { ClassificationBadge, CompositeScoreBar } from '../components/common/ScoreDisplay';

const PROVIDER_HINTS = {
  AlphaVantage: 'Add ALPHAVANTAGE_API_KEY to .env to enable market data.',
  Finnhub: 'Add FINNHUB_API_KEY to .env to enable prices and calendar.',
  NewsAPI: 'Add NEWSAPI_KEY to .env to enable news headlines.',
};

export default function Dashboard() {
  const { theses, fetchTheses, createThesis } = useThesisStore();
  const { signals, fetchSignals } = useSignalStore();
  const { providers, fetchProviders } = useMarketStore();
  const navigate = useNavigate();

  // Quick capture state
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureStatement, setCaptureStatement] = useState('');
  const [captureError, setCaptureError] = useState(null);
  const [captureLoading, setCaptureLoading] = useState(false);

  // Heartbeat
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [now, setNow] = useState(Date.now());

  const refreshAll = useCallback(() => {
    fetchTheses();
    fetchSignals({ status: 'inbox' });
    fetchProviders();
    setLastRefreshed(Date.now());
  }, [fetchTheses, fetchSignals, fetchProviders]);

  useEffect(() => {
    refreshAll();
    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(refreshAll, 30000);
    // Tick heartbeat display every second
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
    };
  }, [refreshAll]);

  const activeTheses = theses.filter(t => ['active', 'executing', 'approved'].includes(t.status));
  const draftTheses = theses.filter(t => t.status === 'draft');
  const quarantined = theses.filter(t => t.status === 'quarantined');
  const inboxSignals = signals.filter(s => s.status === 'inbox');
  const enabledProviders = Object.values(providers).filter(p => p.enabled);
  const disabledProviders = Object.entries(providers).filter(([, p]) => !p.enabled);

  const secondsAgo = Math.floor((now - lastRefreshed) / 1000);

  const handleQuickCapture = async () => {
    setCaptureError(null);
    if (!captureTitle.trim() || !captureStatement.trim()) {
      setCaptureError('Both fields are required.');
      return;
    }
    setCaptureLoading(true);
    try {
      const thesis = await createThesis({
        title: captureTitle.trim(),
        thesis_statement: captureStatement.trim(),
        status: 'draft',
        classification: 'WATCH',
      });
      setCaptureTitle('');
      setCaptureStatement('');
      navigate(`/thesis/${thesis.id}`);
    } catch (err) {
      setCaptureError(err.message);
    } finally {
      setCaptureLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">Process before action. Evidence before conviction.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Updated {secondsAgo}s ago</span>
        </div>
      </div>

      {/* Quick Capture */}
      <div className="bg-slate-900 rounded-lg border border-cyan-500/20 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Quick Capture</span>
          <span className="text-xs text-slate-600">— title + thesis, 10 seconds, saved as draft</span>
        </div>
        {captureError && (
          <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2 mb-3">{captureError}</div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <input
            value={captureTitle}
            onChange={e => setCaptureTitle(e.target.value)}
            className="input-field"
            placeholder="Thesis title"
          />
          <input
            value={captureStatement}
            onChange={e => setCaptureStatement(e.target.value)}
            className="input-field col-span-2"
            placeholder="What will happen and why?"
            onKeyDown={e => {
              if (e.key === 'Enter') handleQuickCapture();
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-3">
          <Link to="/thesis/new" className="text-xs text-slate-500 hover:text-slate-300">
            Full builder
          </Link>
          <button
            onClick={handleQuickCapture}
            disabled={captureLoading}
            className="px-4 py-1.5 bg-cyan-500 text-slate-950 font-bold rounded text-xs hover:bg-cyan-400 disabled:opacity-50"
          >
            {captureLoading ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatusCard label="Active Theses" value={activeTheses.length} color="cyan" />
        <StatusCard label="Inbox Signals" value={inboxSignals.length} color="amber" />
        <StatusCard label="Drafts" value={draftTheses.length} color="slate" />
        <StatusCard
          label="Providers"
          value={`${enabledProviders.length}/${enabledProviders.length + disabledProviders.length}`}
          color={enabledProviders.length > 0 ? 'emerald' : 'red'}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Theses */}
        <div className="col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Active Theses</h2>
              <Link to="/theses" className="text-xs text-cyan-400 hover:text-cyan-300">View All</Link>
            </div>
            {activeTheses.length === 0 ? (
              <p className="text-sm text-slate-600 py-6 text-center">No active theses yet. Capture a draft above, then expand it.</p>
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

          {/* Draft Theses */}
          {draftTheses.length > 0 && (
            <div className="bg-slate-900 rounded-lg border border-slate-800/50 p-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Drafts</h2>
              <div className="space-y-2">
                {draftTheses.map(thesis => (
                  <Link key={thesis.id} to={`/thesis/${thesis.id}`} className="block">
                    <div className="bg-slate-800/30 rounded p-3 hover:bg-slate-800/60 transition-colors border border-slate-700/20">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm text-slate-300">{thesis.title}</h3>
                        <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">draft</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{thesis.thesis_statement}</p>
                    </div>
                  </Link>
                ))}
              </div>
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

          {/* Quarantine — only shown when non-empty */}
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
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Data Providers</h2>
              <Link to="/providers" className="text-xs text-cyan-400 hover:text-cyan-300">Config</Link>
            </div>
            {Object.entries(providers).map(([name, p]) => (
              <div key={name} className="py-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-slate-400">{name}</span>
                  <span className="text-slate-600 ml-auto">{p.requestCount || 0} req</span>
                </div>
                {!p.enabled && PROVIDER_HINTS[name] && (
                  <p className="text-xs text-amber-500/70 mt-0.5 ml-4">{PROVIDER_HINTS[name]}</p>
                )}
              </div>
            ))}
            {Object.keys(providers).length === 0 && (
              <p className="text-xs text-slate-600 py-2">No providers configured. Check .env file.</p>
            )}
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
    slate: 'text-slate-400 border-slate-700',
  };
  return (
    <div className={`bg-slate-900 rounded-lg border p-3 ${colorMap[color] || 'border-slate-800'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorMap[color]?.split(' ')[0] || 'text-slate-300'}`}>{value}</p>
    </div>
  );
}
