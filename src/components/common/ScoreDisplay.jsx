import { CLASSIFICATIONS } from '../../engine/classification';

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

export function DimensionScoreCard({ dimension, score, weight, explanation }) {
  const label = dimension.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  let color = 'text-slate-500';
  if (score >= 7) color = 'text-emerald-400';
  else if (score >= 4) color = 'text-amber-400';
  else if (score != null) color = 'text-red-400';

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800/50">
      <div className="flex-1">
        <span className="text-xs text-slate-400">{label}</span>
        {explanation && <span className="text-xs text-slate-600 ml-2">({explanation})</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-600">w:{weight}</span>
        <span className={`text-sm font-mono font-bold w-8 text-right ${color}`}>
          {score != null ? score : '—'}
        </span>
      </div>
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
