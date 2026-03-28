import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const STATE_COLORS = {
  ESCALATE: 'text-red-400 bg-red-400/10 border-red-400/30',
  DEVELOP_THESIS: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  QUARANTINE: 'text-red-400 bg-red-500/5 border-red-500/20',
  WATCH: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  LOG_ONLY: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  IGNORE: 'text-slate-600 bg-slate-600/5 border-slate-600/20',
};

const STATE_ICONS = {
  ESCALATE: '⚡', DEVELOP_THESIS: '◈', QUARANTINE: '⊘',
  WATCH: '◉', LOG_ONLY: '○', IGNORE: '·',
};

export default function BotFeed() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [creatingThesis, setCreatingThesis] = useState(null);

  // Create thesis via server-side endpoint
  const handleCreateThesis = async (analysis) => {
    const { cluster, counter_case } = analysis;
    setCreatingThesis(cluster.title);

    try {
      const created = await api.createThesisFromCluster({
        cluster: {
          title: cluster.title,
          summary: cluster.summary,
          primary_category: cluster.primary_category,
          primary_geographies: cluster.primary_geographies,
        },
        signals: cluster.signals || [],
        counter_case,
      });

      // Navigate to the new thesis with a banner flag
      navigate(`/thesis/${created.id}`, {
        state: { fromCluster: true, clusterTitle: cluster.title },
      });
    } catch (err) {
      setError(`Failed to create thesis: ${err.message}`);
    }
    setCreatingThesis(null);
  };

  const runScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bot/scan', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Server error: ${res.status}` }));
        throw new Error(errData.error || `Scan failed with status ${res.status}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setResult(data);

      // Persist scan summary for the activity bar
      if (data.summary) {
        localStorage.setItem('sf_last_scan_summary', JSON.stringify(data.summary));
        localStorage.setItem('sf_last_scan_at', new Date().toISOString());
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const lastScanAt = localStorage.getItem('sf_last_scan_at');
  const lastScanAgo = lastScanAt ? timeSince(lastScanAt) : null;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Bot Intelligence Feed</h1>
          <p className="text-sm text-slate-500 mt-1">
            Skeptical analysis. Evidence over narrative.
            {lastScanAgo && <span className="text-slate-600 ml-2">Last scan: {lastScanAgo}</span>}
          </p>
        </div>
        <button onClick={runScan} disabled={loading}
          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-sm hover:bg-cyan-500/20 disabled:opacity-50">
          {loading ? 'Scanning...' : 'Run Full Scan'}
        </button>
      </div>

      {error && <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded p-3 mb-4">{error}</div>}

      {/* Pipeline summary */}
      {result && result.summary && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Scan Summary</h2>
            <span className="text-xs text-slate-600">{result.duration_ms}ms</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            <SummaryStat label="Inputs" value={result.summary.total_inputs} />
            <SummaryStat label="Candidates" value={result.summary.candidates_detected} />
            <SummaryStat label="Clusters" value={result.summary.clusters_formed} />
            <SummaryStat label="Escalations" value={result.summary.escalations} color="red" />
            <SummaryStat label="Develop" value={result.summary.develop_thesis} color="amber" />
            <SummaryStat label="Quarantined" value={result.summary.quarantined} color="red" />
          </div>
        </div>
      )}

      {/* Escalations Panel */}
      {result?.analyses?.filter(a => a.recommendation.recommended_state === 'ESCALATE').length > 0 && (
        <div className="bg-red-950/20 rounded-lg border border-red-900/30 p-4 mb-6">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3">Escalations — Requires Immediate Review</h2>
          {result.analyses.filter(a => a.recommendation.recommended_state === 'ESCALATE').map((analysis, i) => (
            <AnalysisCard key={i} analysis={analysis} expanded={expanded === `e-${i}`} onToggle={() => setExpanded(expanded === `e-${i}` ? null : `e-${i}`)} onCreateThesis={handleCreateThesis} creating={creatingThesis} />
          ))}
        </div>
      )}

      {/* All Analyses */}
      {result?.analyses && (
        <div className="space-y-3">
          {result.analyses.filter(a => a.recommendation.recommended_state !== 'ESCALATE').map((analysis, i) => (
            <AnalysisCard key={i} analysis={analysis} expanded={expanded === `a-${i}`} onToggle={() => setExpanded(expanded === `a-${i}` ? null : `a-${i}`)} onCreateThesis={handleCreateThesis} creating={creatingThesis} />
          ))}
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-lg mb-2">No scan results yet.</p>
          <p className="text-sm">Click "Run Full Scan" to analyze all inbox signals and recent market observations.</p>
        </div>
      )}
    </div>
  );
}

function AnalysisCard({ analysis, expanded, onToggle, onCreateThesis, creating }) {
  const { cluster, recommendation, pattern_match, mispricing_assessment, counter_case } = analysis;
  const stateColor = STATE_COLORS[recommendation.recommended_state] || STATE_COLORS.LOG_ONLY;
  const icon = STATE_ICONS[recommendation.recommended_state] || '·';
  const isActionable = ['ESCALATE', 'DEVELOP_THESIS'].includes(recommendation.recommended_state);
  const isCreating = creating === cluster.title;

  return (
    <div className={`bg-slate-900 rounded-lg border p-4 ${recommendation.recommended_state === 'ESCALATE' ? 'border-red-900/50' : 'border-slate-800'}`}>
      {/* Header */}
      <div className="flex justify-between items-start cursor-pointer" onClick={onToggle}>
        <div className="flex-1 mr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-bold border ${stateColor}`}>
              {icon} {recommendation.recommended_state}
            </span>
            <span className="text-xs text-slate-500">
              {cluster.signal_count} signal{cluster.signal_count !== 1 ? 's' : ''}, {cluster.independent_source_count} source{cluster.independent_source_count !== 1 ? 's' : ''}
            </span>
            {cluster.primary_category && (
              <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{cluster.primary_category.replace(/_/g, ' ')}</span>
            )}
          </div>
          <h3 className="text-sm font-medium text-slate-200">{cluster.title}</h3>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cluster.summary}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-1">
          <span className="text-xs text-slate-600">strength: {cluster.cluster_strength}</span>
          <span className="text-xs text-slate-600">
            confidence: {((recommendation.confidence_range?.best || 0) * 100).toFixed(0)}%
          </span>
          {isActionable && onCreateThesis && (
            <button
              onClick={(e) => { e.stopPropagation(); onCreateThesis(analysis); }}
              disabled={isCreating}
              className="mt-1 px-3 py-1.5 rounded text-xs font-bold transition-colors bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Thesis'}
            </button>
          )}
        </div>
      </div>

      {/* Signal details + Delta indicators */}
      {cluster.signals && cluster.signals.length > 0 && (
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
          <span>{cluster.signals.length} signal{cluster.signals.length !== 1 ? 's' : ''}</span>
          {cluster.primary_geographies?.length > 0 && <span className="text-slate-500">{cluster.primary_geographies.join(', ')}</span>}
          {cluster.cluster_strength >= 4 && <DeltaTag label="strong cluster" direction="up" />}
          {cluster.signal_count >= 5 && <DeltaTag label="high volume" direction="up" />}
          {recommendation.confidence_range?.best >= 0.7 && <DeltaTag label="high confidence" direction="up" />}
          {recommendation.confidence_range?.best < 0.3 && <DeltaTag label="low confidence" direction="down" />}
          {(recommendation.penalties_applied || []).length >= 2 && <DeltaTag label="heavily penalized" direction="down" />}
        </div>
      )}

      {/* Why Not Higher — ALWAYS VISIBLE */}
      <div className="mt-3 bg-slate-800/50 rounded p-2.5 border border-slate-700/30">
        <p className="text-xs text-amber-400 font-medium mb-1">WHY NOT HIGHER</p>
        <p className="text-xs text-slate-400">{recommendation.why_not_higher}</p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Signals in cluster */}
          {cluster.signals?.length > 0 && (
            <DetailSection title={`Signals (${cluster.signals.length})`} color="cyan">
              {cluster.signals.slice(0, 8).map((s, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs">
                  <FreshnessDot dateStr={s.created_at} />
                  <SourcePill type={s.source_type} />
                  <span className="text-slate-300 truncate">{s.title}</span>
                </div>
              ))}
              {cluster.signals.length > 8 && <p className="text-xs text-slate-600">+{cluster.signals.length - 8} more</p>}
            </DetailSection>
          )}

          {/* Penalties */}
          {(recommendation.penalties_applied || []).length > 0 && (
            <DetailSection title="Penalties Applied" color="red">
              {recommendation.penalties_applied.map((p, i) => (
                <div key={i} className="text-xs text-red-300 py-1">
                  <span className="font-medium">[{p.id}]</span> {p.reason}
                </div>
              ))}
            </DetailSection>
          )}

          {/* Governor Overrides */}
          {(recommendation.governor_overrides || []).length > 0 && (
            <DetailSection title="Governor Overrides" color="amber">
              {recommendation.governor_overrides.map((o, i) => (
                <div key={i} className="text-xs text-amber-300 py-1">
                  {o.from} → {o.to}: {o.reason}
                </div>
              ))}
            </DetailSection>
          )}

          {/* Pattern Match */}
          {pattern_match && (
            <DetailSection title={`Pattern: ${pattern_match.pattern_name}`} color="purple">
              <p className="text-xs text-slate-400">Match: {((pattern_match.match_score || 0) * 100).toFixed(0)}%</p>
              {pattern_match.matched_precursors?.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-emerald-400 font-medium">Matched:</p>
                  {pattern_match.matched_precursors.map((p, i) => (
                    <p key={i} className="text-xs text-emerald-300 ml-2">+ {p}</p>
                  ))}
                </div>
              )}
              {pattern_match.missing_confirmations?.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-amber-400 font-medium">Missing:</p>
                  {pattern_match.missing_confirmations.slice(0, 5).map((m, i) => (
                    <p key={i} className="text-xs text-amber-300 ml-2">- {m}</p>
                  ))}
                </div>
              )}
            </DetailSection>
          )}

          {/* Market Context */}
          {mispricing_assessment && (
            <DetailSection title="Market Context" color="cyan">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Reaction:</span>
                  <span className="text-slate-300 ml-1">{mispricing_assessment.market_reaction_state}</span>
                </div>
                <div>
                  <span className="text-slate-500">Mispricing:</span>
                  <span className="text-slate-300 ml-1">{((mispricing_assessment.implied_mispricing_likelihood || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
              {mispricing_assessment.stale_data_penalty_applied && (
                <p className="text-xs text-red-400 mt-1">STALE DATA — low-confidence assessment.</p>
              )}
              <p className="text-xs text-slate-500 mt-1">{mispricing_assessment.reasoning}</p>
            </DetailSection>
          )}

          {/* Red-Team Counter Case */}
          {counter_case && (
            <DetailSection title="Counter Case" color="red">
              <p className="text-xs text-slate-300">{counter_case.strongest_opposing_case}</p>
              {counter_case.circular_logic_detected && (
                <p className="text-xs text-red-400 mt-2 font-bold">CIRCULAR LOGIC DETECTED</p>
              )}
              {counter_case.evidence_gaps?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-amber-400 font-medium">Evidence Gaps:</p>
                  {counter_case.evidence_gaps.slice(0, 4).map((g, i) => (
                    <p key={i} className="text-xs text-amber-300 ml-2">? {g}</p>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2 items-center">
                <span className="text-xs text-slate-500">Quality:</span>
                <span className={`text-xs font-bold ${(counter_case.reasoning_quality_score || 0) >= 7 ? 'text-red-400' : (counter_case.reasoning_quality_score || 0) >= 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {counter_case.reasoning_quality_score || 0}/10
                </span>
              </div>
            </DetailSection>
          )}

          {/* Required Next Steps */}
          {(recommendation.required_next_confirmations || []).length > 0 && (
            <DetailSection title="What Would Increase Conviction" color="slate">
              {recommendation.required_next_confirmations.map((c, i) => (
                <p key={i} className="text-xs text-slate-400 py-0.5">→ {c}</p>
              ))}
            </DetailSection>
          )}
        </div>
      )}

      {/* Expand indicator */}
      <div className="text-center mt-2">
        <button onClick={onToggle} className="text-xs text-slate-600 hover:text-slate-400">
          {expanded ? '▲ Collapse' : '▼ Full analysis'}
        </button>
      </div>
    </div>
  );
}

function DetailSection({ title, color, children }) {
  const borderColors = {
    red: 'border-red-900/30', amber: 'border-amber-900/30', purple: 'border-purple-900/30',
    cyan: 'border-cyan-900/30', slate: 'border-slate-700/30',
  };
  const titleColors = {
    red: 'text-red-400', amber: 'text-amber-400', purple: 'text-purple-400',
    cyan: 'text-cyan-400', slate: 'text-slate-400',
  };
  return (
    <div className={`border rounded p-3 ${borderColors[color] || borderColors.slate}`}>
      <p className={`text-xs font-bold mb-2 ${titleColors[color] || titleColors.slate}`}>{title}</p>
      {children}
    </div>
  );
}

function SummaryStat({ label, value, color }) {
  const colorClass = color === 'red' ? 'text-red-400' : color === 'amber' ? 'text-amber-400' : 'text-slate-300';
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}

function DeltaTag({ label, direction }) {
  const isUp = direction === 'up';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${
      isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
           : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      {isUp ? '\u25B2' : '\u25BC'} {label}
    </span>
  );
}

function FreshnessDot({ dateStr }) {
  if (!dateStr) return <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />;
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  const color = hours < 4 ? 'bg-emerald-400' : hours < 24 ? 'bg-amber-400' : hours < 168 ? 'bg-orange-400' : 'bg-slate-600';
  return <span className={`w-1.5 h-1.5 rounded-full ${color} inline-block shrink-0`} />;
}

function SourcePill({ type }) {
  const colors = {
    fred: 'text-blue-400', gdelt: 'text-purple-400', acled: 'text-red-300',
    news_feed: 'text-amber-400', market_data: 'text-cyan-400',
    manual: 'text-slate-500', government: 'text-emerald-400',
  };
  const label = type === 'news_feed' ? 'news' : type === 'market_data' ? 'mkt' : (type || 'other').slice(0, 5);
  return <span className={`text-xs ${colors[type] || 'text-slate-500'}`}>{label}</span>;
}

function timeSince(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
