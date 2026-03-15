import { CLASSIFICATIONS } from '../../engine/classification';
import { LAYERS } from '../../engine/scoring';

const COLOR_MAP = {
  slate: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  blue: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  amber: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  purple: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  cyan: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
  emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  red: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export function ClassificationBadge({ classification }) {
  const meta = CLASSIFICATIONS[classification] || CLASSIFICATIONS.IGNORE;
  const colors = COLOR_MAP[meta.color] || COLOR_MAP.slate;
  return (
    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold border ${colors}`}>
      {meta.label}
    </span>
  );
}

export function CompositeScoreBar({ score, maxScore = 100 }) {
  const pct = Math.min(100, (score / maxScore) * 100);
  let color = 'bg-slate-500';
  if (pct >= 85) color = 'bg-emerald-500';
  else if (pct >= 75) color = 'bg-cyan-500';
  else if (pct >= 65) color = 'bg-purple-500';
  else if (pct >= 50) color = 'bg-amber-500';
  else if (pct >= 35) color = 'bg-blue-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono text-slate-300 w-10 text-right">{Math.round(score)}</span>
    </div>
  );
}

/**
 * Three-layer score summary. Shows Evidence / Structure / Market Edge
 * as three side-by-side bars with their layer scores.
 */
export function LayerScoreSummary({ layers }) {
  if (!layers) return null;

  const LAYER_COLORS = {
    evidence: { bar: 'bg-cyan-500', text: 'text-cyan-400', dim: 'text-cyan-600' },
    structure: { bar: 'bg-amber-500', text: 'text-amber-400', dim: 'text-amber-600' },
    market_edge: { bar: 'bg-purple-500', text: 'text-purple-400', dim: 'text-purple-600' },
  };

  return (
    <div className="space-y-1.5">
      {Object.entries(layers).map(([key, layer]) => {
        const meta = LAYERS[key];
        const colors = LAYER_COLORS[key] || LAYER_COLORS.evidence;
        const pct = Math.min(100, (layer.score / 10) * 100);
        const weightPct = (layer.weight * 100).toFixed(0);

        return (
          <div key={key} className="flex items-center gap-2">
            <span className={`text-xs w-24 ${colors.text}`}>{meta?.label || key}</span>
            <span className={`text-xs w-8 ${colors.dim}`}>{weightPct}%</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-8 text-right ${colors.text}`}>
              {layer.score != null ? layer.score.toFixed(1) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Displays individual factor scores within a layer.
 */
export function LayerFactorBreakdown({ layerKey, layer }) {
  if (!layer || !layer.breakdown) return null;

  const scored = layer.breakdown.filter(b => b.rawScore != null);
  const missing = layer.breakdown.filter(b => b.rawScore == null);

  return (
    <div className="space-y-1">
      {scored.map(b => (
        <FactorScoreRow key={b.factor} factor={b} />
      ))}
      {missing.length > 0 && (
        <div className="text-xs text-slate-600 mt-1">
          Missing: {missing.map(b => b.label).join(', ')}
        </div>
      )}
    </div>
  );
}

function FactorScoreRow({ factor }) {
  let color = 'text-slate-500';
  if (factor.rawScore >= 7) color = 'text-emerald-400';
  else if (factor.rawScore >= 4) color = 'text-amber-400';
  else if (factor.rawScore != null) color = 'text-red-400';

  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-800/50">
      <div className="flex-1">
        <span className="text-xs text-slate-400">{factor.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600">w:{factor.weight}</span>
        <span className={`text-sm font-mono font-bold w-8 text-right ${color}`}>
          {factor.rawScore != null ? factor.rawScore : '—'}
        </span>
      </div>
    </div>
  );
}

// Legacy compat — maps to FactorScoreRow
export function DimensionScoreCard({ dimension, score, weight, explanation }) {
  const label = dimension.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <FactorScoreRow
      factor={{ label, rawScore: score, weight, factor: dimension }}
    />
  );
}

/**
 * Penalty summary display.
 */
export function PenaltySummary({ penalties }) {
  if (!penalties || penalties.applied.length === 0) return null;

  return (
    <div className="space-y-1">
      {penalties.applied.map(p => (
        <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-red-900/20">
          <span className="text-red-400">{p.label}</span>
          <span className="text-red-500 font-mono">-{p.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between text-xs pt-1">
        <span className="text-red-300 font-bold">Total Penalty</span>
        <span className="text-red-400 font-mono font-bold">-{penalties.total}</span>
      </div>
    </div>
  );
}

/**
 * Confidence indicator — separate from score.
 */
export function ConfidenceIndicator({ confidence }) {
  if (!confidence) return null;

  let color = 'text-slate-500';
  let bgColor = 'bg-slate-500';
  if (confidence.level >= 0.8) { color = 'text-emerald-400'; bgColor = 'bg-emerald-500'; }
  else if (confidence.level >= 0.6) { color = 'text-cyan-400'; bgColor = 'bg-cyan-500'; }
  else if (confidence.level >= 0.4) { color = 'text-amber-400'; bgColor = 'bg-amber-500'; }
  else { color = 'text-red-400'; bgColor = 'bg-red-500'; }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">Confidence:</span>
      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${bgColor} rounded-full`}
          style={{ width: `${confidence.level * 100}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${color}`}>
        {(confidence.level * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function GateResultDisplay({ gateResult }) {
  if (!gateResult) return null;
  return (
    <div className="space-y-1.5">
      <div className={`text-sm font-bold ${gateResult.passed ? 'text-emerald-400' : 'text-red-400'}`}>
        {gateResult.summary}
      </div>
      {gateResult.hardFails.map(f => (
        <div key={f.id} className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded px-2.5 py-1.5">
          <span className="font-bold">HARD FAIL:</span> {f.name} — {f.reason}
        </div>
      ))}
      {gateResult.softFails.map(f => (
        <div key={f.id} className="text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded px-2.5 py-1.5">
          <span className="font-bold">WARNING:</span> {f.name} — {f.reason}
        </div>
      ))}
    </div>
  );
}
