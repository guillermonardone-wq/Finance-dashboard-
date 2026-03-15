import { useEffect, useState } from 'react';
import { useAdvisoryStore } from '../store/useAdvisoryStore';

const DIMENSION_LABELS = {
  evidence_strength: 'Evidence Strength',
  signal_independence: 'Signal Independence',
  structural_logic: 'Structural Logic',
  timing_clarity: 'Timing Clarity',
  market_edge: 'Market Edge',
  counter_case_robustness: 'Counter-Case Robustness',
};

const RECOMMENDATION_COLORS = {
  STRONG_PASS: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  PASS: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  NEUTRAL: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  DEVELOP_FURTHER: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  REJECT: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export default function AdvisoryTab({ thesis }) {
  const { assessment, history, loading, error, fetchLatest, fetchHistory, runEvaluation } = useAdvisoryStore();
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (thesis?.id) {
      fetchLatest(thesis.id);
      fetchHistory(thesis.id);
    }
  }, [thesis?.id, fetchLatest, fetchHistory]);

  const handleRunReview = async () => {
    try {
      await runEvaluation(thesis.id);
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="space-y-6">
      {/* Advisory notice */}
      <div className="bg-amber-950/10 border border-amber-900/30 rounded-lg p-3">
        <p className="text-xs text-amber-400">
          ADVISORY ONLY — LLM assessments are a second opinion. They cannot override deterministic scores,
          bypass gates, or set trade state. All outputs are labeled advisory.
        </p>
      </div>

      {/* Run button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRunReview}
          disabled={loading}
          className="px-4 py-2 text-xs font-bold bg-cyan-500 text-slate-950 rounded hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading ? 'Running LLM Review...' : 'Run LLM Review'}
        </button>
        {assessment && (
          <span className="text-xs text-slate-500">
            Last run: {new Date(assessment.created_at).toLocaleString()}
            {' '}({assessment.model_provider}/{assessment.model_name})
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded p-3">
          {error}
        </div>
      )}

      {loading && !assessment && (
        <div className="text-sm text-slate-500 py-8 text-center">
          Running LLM evaluation... This may take 10-30 seconds.
        </div>
      )}

      {assessment && assessment.status === 'completed' && (
        <>
          {/* Score comparison */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Score Comparison</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <ScoreCard label="Deterministic" value={assessment.deterministic_score} max={100} />
              <ScoreCard label="LLM Advisory" value={assessment.overall_score} max={100} />
              <DeltaCard delta={assessment.score_delta} />
            </div>
            {assessment.disagreement_summary && (
              <p className="text-xs text-slate-400">{assessment.disagreement_summary}</p>
            )}
          </div>

          {/* Recommendation */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-2">Recommendation</h3>
            <RecommendationBadge recommendation={assessment.recommendation} />
          </div>

          {/* Dimension scores */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-3">Dimension Scores (LLM)</h3>
            <div className="space-y-2">
              {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
                const score = assessment[`score_${key}`];
                return (
                  <DimensionBar key={key} label={label} score={score} />
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">LLM Confidence:</span>
              <ConfidenceBar level={assessment.confidence_level} />
            </div>
          </div>

          {/* Strongest counter-case */}
          <div className="bg-red-950/10 rounded-lg border border-red-900/30 p-4">
            <h3 className="text-sm font-bold text-red-400 mb-2">Strongest Counter-Case</h3>
            <p className="text-sm text-slate-300">{assessment.strongest_counter_case}</p>
          </div>

          {/* Hidden assumptions */}
          {assessment.hidden_assumptions?.length > 0 && (
            <div className="bg-amber-950/10 rounded-lg border border-amber-900/30 p-4">
              <h3 className="text-sm font-bold text-amber-400 mb-2">Hidden Assumptions</h3>
              <ul className="space-y-1">
                {assessment.hidden_assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-amber-300">- {a}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Key missing information */}
          {assessment.key_missing_information?.length > 0 && (
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <h3 className="text-sm font-bold text-slate-300 mb-2">Key Missing Information</h3>
              <ul className="space-y-1">
                {assessment.key_missing_information.map((m, i) => (
                  <li key={i} className="text-xs text-slate-400">- {m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Top supporting signals & concerns */}
          <div className="grid grid-cols-2 gap-4">
            {assessment.top_supporting_signals?.length > 0 && (
              <div className="bg-slate-900 rounded-lg border border-emerald-900/30 p-4">
                <h3 className="text-sm font-bold text-emerald-400 mb-2">Top Supporting Signals</h3>
                <ul className="space-y-1">
                  {assessment.top_supporting_signals.map((s, i) => (
                    <li key={i} className="text-xs text-emerald-300">- {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {assessment.top_concerns?.length > 0 && (
              <div className="bg-slate-900 rounded-lg border border-red-900/30 p-4">
                <h3 className="text-sm font-bold text-red-400 mb-2">Top Concerns</h3>
                <ul className="space-y-1">
                  {assessment.top_concerns.map((c, i) => (
                    <li key={i} className="text-xs text-red-300">- {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Assessment metadata */}
          <div className="text-xs text-slate-600 flex gap-4">
            <span>Model: {assessment.model_provider}/{assessment.model_name}</span>
            <span>Prompt: v{assessment.prompt_version}</span>
            {assessment.latency_ms && <span>Latency: {(assessment.latency_ms / 1000).toFixed(1)}s</span>}
            {assessment.prompt_tokens && <span>Tokens: {assessment.prompt_tokens + assessment.completion_tokens}</span>}
          </div>
        </>
      )}

      {assessment && assessment.status === 'failed' && (
        <div className="bg-red-950/10 rounded-lg border border-red-900/30 p-4">
          <h3 className="text-sm font-bold text-red-400 mb-2">Evaluation Failed</h3>
          <p className="text-xs text-red-300">{assessment.error_message}</p>
        </div>
      )}

      {/* History toggle */}
      {history.length > 1 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-slate-500 hover:text-slate-400"
          >
            {showHistory ? 'Hide' : 'Show'} assessment history ({history.length} runs)
          </button>
          {showHistory && (
            <div className="mt-2 space-y-2">
              {history.map(h => (
                <div key={h.id} className="text-xs text-slate-500 bg-slate-800/30 rounded p-2 flex justify-between">
                  <span>{new Date(h.created_at).toLocaleString()}</span>
                  <span>LLM: {h.overall_score}/100</span>
                  <span>Det: {h.deterministic_score ?? '—'}/100</span>
                  <span>Delta: {h.score_delta != null ? (h.score_delta >= 0 ? '+' : '') + h.score_delta : '—'}</span>
                  <span className={h.status === 'completed' ? 'text-emerald-500' : 'text-red-500'}>{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function ScoreCard({ label, value, max }) {
  const pct = value != null ? Math.round((value / max) * 100) : 0;
  let color = 'text-slate-500';
  if (pct >= 85) color = 'text-emerald-400';
  else if (pct >= 65) color = 'text-cyan-400';
  else if (pct >= 50) color = 'text-amber-400';
  else if (pct >= 35) color = 'text-blue-400';

  return (
    <div className="bg-slate-800/50 rounded p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>
        {value != null ? Math.round(value) : '—'}
      </p>
    </div>
  );
}

function DeltaCard({ delta }) {
  if (delta == null) return (
    <div className="bg-slate-800/50 rounded p-3 text-center">
      <p className="text-xs text-slate-500">Delta</p>
      <p className="text-2xl font-bold font-mono mt-1 text-slate-600">—</p>
    </div>
  );

  const abs = Math.abs(delta);
  let color = 'text-slate-400';
  if (abs > 15) color = delta > 0 ? 'text-emerald-400' : 'text-red-400';
  else if (abs > 5) color = delta > 0 ? 'text-cyan-400' : 'text-amber-400';

  return (
    <div className="bg-slate-800/50 rounded p-3 text-center">
      <p className="text-xs text-slate-500">Delta</p>
      <p className={`text-2xl font-bold font-mono mt-1 ${color}`}>
        {delta >= 0 ? '+' : ''}{Math.round(delta)}
      </p>
    </div>
  );
}

function DimensionBar({ label, score }) {
  const pct = score != null ? (score / 10) * 100 : 0;
  let color = 'bg-slate-600';
  let textColor = 'text-slate-500';
  if (score >= 7) { color = 'bg-emerald-500'; textColor = 'text-emerald-400'; }
  else if (score >= 4) { color = 'bg-amber-500'; textColor = 'text-amber-400'; }
  else if (score != null) { color = 'bg-red-500'; textColor = 'text-red-400'; }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-40">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono w-6 text-right ${textColor}`}>
        {score != null ? score : '—'}
      </span>
    </div>
  );
}

function ConfidenceBar({ level }) {
  const pct = (level || 0) * 100;
  let color = 'bg-red-500';
  let textColor = 'text-red-400';
  if (level >= 0.8) { color = 'bg-emerald-500'; textColor = 'text-emerald-400'; }
  else if (level >= 0.6) { color = 'bg-cyan-500'; textColor = 'text-cyan-400'; }
  else if (level >= 0.4) { color = 'bg-amber-500'; textColor = 'text-amber-400'; }

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono ${textColor}`}>{(level * 100).toFixed(0)}%</span>
    </div>
  );
}

function RecommendationBadge({ recommendation }) {
  if (!recommendation) return null;

  // Extract the keyword (STRONG_PASS, PASS, etc.) from the recommendation string
  const keywords = ['STRONG_PASS', 'PASS', 'NEUTRAL', 'DEVELOP_FURTHER', 'REJECT'];
  const match = keywords.find(k => recommendation.toUpperCase().includes(k));
  const colors = RECOMMENDATION_COLORS[match] || RECOMMENDATION_COLORS.NEUTRAL;

  return (
    <div className={`inline-flex flex-col rounded border p-3 ${colors}`}>
      <span className="text-xs font-bold">{match || 'ADVISORY'}</span>
      <span className="text-xs mt-1 opacity-80">{recommendation}</span>
    </div>
  );
}
