import { useState, useMemo } from 'react';
import { PRE_TRADE_CHECKLIST, runChecklist, getMaxPositionSize } from '../../engine/behavioral.js';

const STATUS_STYLES = {
  passed:     'border-emerald-400/30 bg-emerald-400/5 text-emerald-400',
  failed:     'border-red-400/30 bg-red-400/5 text-red-400',
  warning:    'border-amber-400/30 bg-amber-400/5 text-amber-400',
  unanswered: 'border-slate-700 bg-slate-800/50 text-slate-500',
  pending:    'border-slate-700 bg-slate-800/50 text-slate-400',
};

const STATUS_ICONS = {
  passed: '\u2713',
  failed: '\u2717',
  warning: '!',
  unanswered: '\u2014',
  pending: '\u00B7',
};

const CATEGORY_LABELS = {
  disconfirmation: 'Disconfirmation',
  risk: 'Risk Management',
  discipline: 'Discipline',
  asymmetry: 'Asymmetry',
  execution: 'Execution',
  evidence: 'Evidence',
  behavioral: 'Behavioral',
};

export default function ChecklistTab({ thesis }) {
  const [answers, setAnswers] = useState({});

  const result = useMemo(() => runChecklist(answers), [answers]);

  const positionSize = useMemo(
    () => getMaxPositionSize(thesis.classification, 100000),
    [thesis.classification]
  );

  function updateAnswer(id, value) {
    setAnswers(prev => ({ ...prev, [id]: value }));
  }

  // Group items by category
  const grouped = useMemo(() => {
    const groups = {};
    for (const item of result.items) {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [result.items]);

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className={`p-4 rounded border ${result.passed ? 'border-emerald-400/30 bg-emerald-400/5' : 'border-red-400/30 bg-red-400/5'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`font-bold text-sm ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.summary}
          </span>
          <span className="text-xs text-slate-500">
            {result.passedCount}/{result.total} passed
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded h-2">
          <div
            className={`h-2 rounded transition-all ${result.passed ? 'bg-emerald-400' : 'bg-red-400'}`}
            style={{ width: `${result.score}%` }}
          />
        </div>
      </div>

      {/* Position sizing */}
      <div className="p-3 rounded border border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Max Position Size</span>
            <p className="text-sm text-slate-300 mt-0.5">{positionSize.description}</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-mono text-slate-200">{positionSize.maxPercent}%</span>
            <p className="text-xs text-slate-500">of risk capital</p>
          </div>
        </div>
      </div>

      {/* Blocks */}
      {result.blocks.length > 0 && (
        <div className="p-3 rounded border border-red-400/20 bg-red-400/5">
          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Blocking Issues</p>
          {result.blocks.map(b => (
            <p key={b.id} className="text-xs text-red-300 mb-1">{b.message}</p>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="p-3 rounded border border-amber-400/20 bg-amber-400/5">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Warnings</p>
          {result.warnings.map(w => (
            <p key={w.id} className="text-xs text-amber-300 mb-1">{w.message}</p>
          ))}
        </div>
      )}

      {/* Checklist items by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div className="space-y-2">
            {items.map(item => {
              const checklistDef = PRE_TRADE_CHECKLIST.find(c => c.id === item.id);
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded border ${STATUS_STYLES[item.status]}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-mono w-4 shrink-0 text-center mt-0.5">
                      {STATUS_ICONS[item.status]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 mb-2">{item.question}</p>

                      {/* Input based on type */}
                      {checklistDef?.type === 'boolean' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateAnswer(item.id, true)}
                            className={`text-xs px-3 py-1 rounded border transition-colors ${
                              answers[item.id] === true
                                ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                                : 'border-slate-700 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => updateAnswer(item.id, false)}
                            className={`text-xs px-3 py-1 rounded border transition-colors ${
                              answers[item.id] === false
                                ? 'border-red-400 bg-red-400/10 text-red-400'
                                : 'border-slate-700 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            No
                          </button>
                        </div>
                      )}

                      {checklistDef?.type === 'text' && (
                        <textarea
                          value={answers[item.id] || ''}
                          onChange={e => updateAnswer(item.id, e.target.value)}
                          placeholder={`Minimum ${checklistDef.minLength || 1} characters...`}
                          rows={2}
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                        />
                      )}

                      {checklistDef?.type === 'number' && (
                        <input
                          type="number"
                          value={answers[item.id] ?? ''}
                          onChange={e => updateAnswer(item.id, e.target.value === '' ? null : Number(e.target.value))}
                          min={checklistDef.min}
                          max={checklistDef.max}
                          className="w-20 text-xs bg-slate-900 border border-slate-700 rounded p-2 text-slate-300 focus:border-cyan-400 focus:outline-none"
                        />
                      )}

                      {checklistDef?.type === 'select' && (
                        <div className="flex flex-wrap gap-2">
                          {checklistDef.options.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => updateAnswer(item.id, opt.value)}
                              className={`text-xs px-3 py-1 rounded border transition-colors ${
                                answers[item.id] === opt.value
                                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                                  : 'border-slate-700 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Status message */}
                      {item.message && (
                        <p className={`text-xs mt-2 ${
                          item.status === 'failed' ? 'text-red-300' :
                          item.status === 'warning' ? 'text-amber-300' :
                          'text-slate-500'
                        }`}>
                          {item.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
