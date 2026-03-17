import { LAYERS } from '../../engine/scoring';
import {
  LayerFactorBreakdown,
  PenaltySummary,
  ConfidenceIndicator,
  GateResultDisplay,
} from '../common/ScoreDisplay';

/**
 * ThesisScorecardTab — Full scoring cockpit (deep mode).
 *
 * Three-layer factor breakdown with manual override inputs,
 * penalties, confidence, signal independence, playbook matches,
 * missing scores warning, and gate results.
 */
export default function ThesisScorecardTab({ evaluation, onScoreUpdate }) {
  if (!evaluation) {
    return (
      <p className="text-sm text-slate-600 py-8 text-center">
        No evaluation data. Try re-scoring the thesis.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Three-layer breakdown */}
      {Object.entries(LAYERS).map(([layerKey, layerDef]) => {
        const layerData = evaluation.layers[layerKey];
        if (!layerData) return null;

        return (
          <div key={layerKey} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-slate-300">
                {layerDef.label}{' '}
                <span className="text-slate-600 font-normal">
                  ({(layerDef.weight * 100).toFixed(0)}%)
                </span>
              </h3>
              <span className="text-sm font-mono text-slate-400">
                {layerData.score?.toFixed(1)}/10
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Adjust individual factor scores (0-10). Auto-computed scores update on re-score.
            </p>
            {layerData.breakdown.map(factor => {
              const score = evaluation.factorScores[factor.factor];
              const explanation = evaluation.explanations[factor.factor];

              return (
                <div
                  key={factor.factor}
                  className="flex items-center gap-3 py-1.5 border-b border-slate-800/50"
                >
                  <div className="flex-1">
                    <LayerFactorBreakdown
                      layerKey={layerKey}
                      layer={{ breakdown: [factor], missing: [] }}
                    />
                    {explanation && (
                      <span className="text-xs text-slate-600 ml-2">({explanation})</span>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value={score ?? ''}
                    onChange={e =>
                      onScoreUpdate(
                        factor.factor,
                        e.target.value === '' ? null : parseFloat(e.target.value)
                      )
                    }
                    className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 text-center"
                    placeholder="—"
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Penalties */}
      {evaluation.penalties.applied.length > 0 && (
        <div className="bg-red-950/10 rounded-lg border border-red-900/30 p-4">
          <h3 className="text-sm font-bold text-red-400 mb-3">Penalties</h3>
          <PenaltySummary penalties={evaluation.penalties} />
        </div>
      )}

      {/* Confidence */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-3">Confidence Assessment</h3>
        <ConfidenceIndicator confidence={evaluation.confidence} />
        <p className="text-xs text-slate-500 mt-2">{evaluation.confidence.explanation}</p>
      </div>

      {/* Signal Independence */}
      {evaluation.independence?.warnings?.length > 0 && (
        <div className="bg-amber-950/10 rounded-lg border border-amber-900/30 p-4">
          <h3 className="text-sm font-bold text-amber-400 mb-2">Signal Independence Warnings</h3>
          {evaluation.independence.warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-300 py-0.5">- {w}</p>
          ))}
        </div>
      )}

      {/* Playbook Matches */}
      {evaluation.playbookMatch?.matches?.length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Playbook Matches</h3>
          {evaluation.playbookMatch.matches.map((m, i) => (
            <div key={i} className="text-xs text-slate-400 py-1 border-b border-slate-800/30">
              <span className="text-cyan-400">{m.entry.title}</span>
              <span className="text-slate-600 ml-2">match: {m.score}/10</span>
              <div className="text-slate-600 mt-0.5">{m.reasons.join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Missing scores */}
      {evaluation.scoreResult.missing.length > 0 && (
        <div className="text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded p-3">
          <span className="font-bold">INCOMPLETE:</span>{' '}
          {evaluation.scoreResult.missing.length} factors not scored.
          Score all factors for accurate classification.
        </div>
      )}

      {/* Gate results */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-300 mb-4">Gate Results</h3>
        <GateResultDisplay gateResult={evaluation.gateResult} />
      </div>
    </div>
  );
}
