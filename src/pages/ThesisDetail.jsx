import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useThesisStore } from '../store/useThesisStore';
import { useSignalStore } from '../store/useSignalStore';
import { SCORE_WEIGHTS } from '../engine/scoring';
import { ClassificationBadge, CompositeScoreBar, DimensionScoreCard, GateResultDisplay } from '../components/common/ScoreDisplay';

const TABS = ['Overview', 'Evidence', 'Scorecard', 'Checklist', 'Audit Log'];

export default function ThesisDetail() {
  const { id } = useParams();
  const { activeThesis, fetchThesis, updateThesis, evaluateThesis } = useThesisStore();
  const { signals, fetchSignals } = useSignalStore();
  const [tab, setTab] = useState('Overview');
  const [evaluation, setEvaluation] = useState(null);
  const [manualScores, setManualScores] = useState({});

  useEffect(() => {
    fetchThesis(id);
    fetchSignals({ thesis_id: id });
  }, [id, fetchThesis, fetchSignals]);

  useEffect(() => {
    if (activeThesis) {
      const result = evaluateThesis(activeThesis, signals);
      setEvaluation(result);
    }
  }, [activeThesis, signals, evaluateThesis]);

  if (!activeThesis) return <div className="p-6 text-slate-500">Loading thesis...</div>;

  const thesis = activeThesis;

  const handleScoreUpdate = async (dimension, value) => {
    const newScores = { ...manualScores, [dimension]: value };
    setManualScores(newScores);

    const scoreField = `score_${dimension}`;
    await updateThesis(id, { [scoreField]: value });
  };

  const handleReScore = () => {
    if (activeThesis) {
      const result = evaluateThesis(activeThesis, signals);
      setEvaluation(result);
      // Persist computed scores
      updateThesis(id, {
        composite_score: result.scoreResult.composite,
        classification: result.classification.classification,
        classification_reason: result.classification.downgrades.length > 0
          ? result.classification.downgrades.map(d => d.reason).join('; ')
          : `Score: ${result.scoreResult.composite}`,
      });
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link to="/theses" className="text-xs text-slate-500 hover:text-slate-400 mb-2 block">All Theses</Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-100">{thesis.title}</h1>
            <p className="text-sm text-slate-400 mt-1">{thesis.thesis_statement}</p>
          </div>
          <div className="flex items-center gap-3">
            <ClassificationBadge classification={thesis.classification} />
            {thesis.status === 'quarantined' && (
              <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
                QUARANTINED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score summary bar */}
      {evaluation && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Composite Score</span>
                <span>{evaluation.scoreResult.composite}/100 (completeness: {evaluation.scoreResult.completeness}%)</span>
              </div>
              <CompositeScoreBar score={evaluation.scoreResult.composite} />
            </div>
            <button onClick={handleReScore}
              className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-slate-700">
              Re-score
            </button>
          </div>
          {evaluation.classification.overrideActive && (
            <div className="mt-3 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded p-2">
              FORCED DOWNGRADE: Score alone would classify as {evaluation.classification.scoreClassification}, but downgrades active.
              {evaluation.classification.downgrades.map((d, i) => (
                <div key={i} className="mt-1 text-amber-300">{d.reason}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-px">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          {/* Causal Chain */}
          <Section title="Causal Chain">
            {(thesis.causal_chain || []).map((step, i) => (
              <div key={i} className="flex gap-3 items-start py-1">
                <span className="text-xs text-slate-600 font-mono w-6 mt-0.5">{i + 1}.</span>
                <span className="text-sm text-slate-300">{step}</span>
              </div>
            ))}
          </Section>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-4">
            <MetricCard label="Probability" value={`${(thesis.probability_low * 100).toFixed(0)}–${(thesis.probability_high * 100).toFixed(0)}% (best: ${(thesis.probability_best * 100).toFixed(0)}%)`} />
            <MetricCard label="Timeline" value={thesis.expected_timeline?.start ? `${thesis.expected_timeline.start} → ${thesis.expected_timeline.end || '?'}` : 'Not set'} />
            <MetricCard label="Assumptions" value={`${(thesis.key_assumptions || []).length} key assumptions`}
              warn={(thesis.key_assumptions || []).length > 5} />
          </div>

          {/* Affected Assets */}
          <Section title="Affected Assets">
            {(thesis.affected_assets || []).map((a, i) => (
              <div key={i} className="flex gap-4 text-sm py-1">
                <span className="text-cyan-400 font-mono">{a.asset}</span>
                <span className={a.direction === 'short' ? 'text-red-400' : 'text-emerald-400'}>{a.direction}</span>
                <span className="text-slate-500">{a.mechanism}</span>
              </div>
            ))}
          </Section>

          {/* Disconfirmation block */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <h3 className="text-sm font-bold text-red-400 mb-3">DISCONFIRMATION</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-red-400 mb-1">Strongest Bear Case:</p>
                <p className="text-sm text-slate-300">{thesis.strongest_bear_case || 'NOT WRITTEN'}</p>
              </div>
              <div>
                <p className="text-xs text-red-400 mb-1">What Would Make Opposite Stronger:</p>
                <p className="text-sm text-slate-300">{thesis.what_would_make_opposite_stronger || 'NOT WRITTEN'}</p>
              </div>
              <div>
                <p className="text-xs text-red-400 mb-1">Early vs Right:</p>
                <p className="text-sm text-slate-300">{thesis.early_vs_right || 'NOT WRITTEN'}</p>
              </div>
              <div>
                <p className="text-xs text-red-400 mb-1">Disconfirming Evidence:</p>
                {(thesis.disconfirming_evidence || []).map((d, i) => (
                  <p key={i} className="text-sm text-slate-400 ml-3">- {d}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Market Pricing Assessment */}
          <Section title="Market Pricing Assessment">
            <p className="text-sm text-slate-300">{thesis.market_pricing_assessment?.description || 'Not assessed'}</p>
          </Section>

          {/* Alternative Explanations */}
          <Section title="Alternative Explanations">
            {(thesis.alternative_explanations || []).map((a, i) => (
              <p key={i} className="text-sm text-slate-400 py-0.5">- {a}</p>
            ))}
          </Section>
        </div>
      )}

      {tab === 'Evidence' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-300">Linked Signals</h2>
            <span className="text-xs text-slate-500">{signals.length} signals</span>
          </div>
          {signals.length === 0 ? (
            <p className="text-sm text-slate-600 py-8 text-center">
              No linked signals. Go to Signal Inbox to link evidence.
            </p>
          ) : (
            signals.map(s => (
              <div key={s.id} className="bg-slate-800/50 rounded p-3 border border-slate-700/30">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-200">{s.title}</span>
                  <span className={`text-xs ${s.reliability === 'verified' ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {s.reliability}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                <div className="flex gap-2 mt-2 text-xs text-slate-600">
                  <span>{s.category?.replace(/_/g, ' ')}</span>
                  {s.source_attribution && <span>via {s.source_attribution}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Scorecard' && evaluation && (
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-4">Dimension Scores</h3>
            <p className="text-xs text-slate-600 mb-4">
              Click a score to manually adjust. Auto-computed scores are marked. Each dimension is 0-10.
            </p>
            {Object.entries(SCORE_WEIGHTS).map(([dim, weight]) => {
              const score = evaluation.dimensionScores[dim];
              const explanation = evaluation.explanations[dim];
              return (
                <div key={dim} className="flex items-center gap-3 py-2 border-b border-slate-800/50">
                  <DimensionScoreCard dimension={dim} score={score} weight={weight} explanation={explanation} />
                  <input
                    type="number" min="0" max="10" step="1"
                    value={score ?? ''}
                    onChange={e => handleScoreUpdate(dim, e.target.value === '' ? null : parseFloat(e.target.value))}
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 text-center"
                    placeholder="—"
                  />
                </div>
              );
            })}
          </div>

          {/* Missing scores warning */}
          {evaluation.scoreResult.missing.length > 0 && (
            <div className="text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded p-3">
              <span className="font-bold">INCOMPLETE:</span> {evaluation.scoreResult.missing.length} dimensions not scored.
              Missing scores incur a penalty of -{evaluation.scoreResult.missingPenalty}.
              Score all dimensions for accurate classification.
            </div>
          )}

          {/* Gate results */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-4">Gate Results</h3>
            <GateResultDisplay gateResult={evaluation.gateResult} />
          </div>
        </div>
      )}

      {tab === 'Checklist' && (
        <div className="text-sm text-slate-500 py-8 text-center">
          Pre-trade checklist will be available once thesis is classified as PAPER TRADE or above.
          <br />Current classification: {thesis.classification}
        </div>
      )}

      {tab === 'Audit Log' && (
        <div className="space-y-3">
          <div className="text-sm text-slate-500">
            <p>Created: {thesis.created_at}</p>
            <p>Updated: {thesis.updated_at}</p>
            <p>Status: {thesis.status}</p>
          </div>
          {(thesis.previous_classifications || []).length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-300 mb-2">Classification History</h3>
              {thesis.previous_classifications.map((c, i) => (
                <div key={i} className="text-xs text-slate-400 py-1 border-b border-slate-800/30">
                  {c.date}: {c.from} → {c.to} — {c.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <h3 className="text-sm font-bold text-slate-300 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ label, value, warn }) {
  return (
    <div className={`bg-slate-900 rounded-lg border p-3 ${warn ? 'border-amber-500/30' : 'border-slate-800'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-medium mt-1 ${warn ? 'text-amber-400' : 'text-slate-300'}`}>{value}</p>
    </div>
  );
}
