import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignalStore } from '../store/useSignalStore';
import { useThesisStore } from '../store/useThesisStore';

const CATEGORIES = [
  'geopolitical_escalation', 'military_mobilization', 'commodity_chokepoint',
  'sanctions_risk', 'shipping_disruption', 'energy_bottleneck',
  'policy_shock', 'currency_instability', 'market_complacency',
  'central_bank_action', 'election_political', 'supply_chain',
  'technology_disruption', 'credit_stress', 'other',
];

const SOURCE_TYPES = ['manual', 'news_feed', 'market_data', 'social', 'government', 'satellite', 'shipping', 'analyst', 'fred', 'gdelt', 'other'];
const NOVELTY = ['new', 'developing', 'known', 'stale', 'unknown'];
const RELIABILITY = ['verified', 'likely', 'unverified', 'disputed'];

const SOURCE_BADGE_COLORS = {
  manual: 'bg-slate-700 text-slate-300',
  fred: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  gdelt: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  news_feed: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  market_data: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  government: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
};

const EMPTY_SIGNAL = {
  title: '', description: '', category: 'other', source_type: 'manual',
  source_url: '', source_attribution: '', novelty: 'unknown', reliability: 'unverified',
  signal_strength: 0.5, tags: [],
};

// Status filter mapping: user-facing label -> DB status value
const STATUS_FILTERS = [
  { label: 'New', status: 'inbox' },
  { label: 'Linked', status: 'linked' },
  { label: 'Dismissed', status: 'noise' },
  { label: 'All', status: null },
];

export default function SignalInbox() {
  const { signals, fetchSignals, createSignal, updateSignal, fetchCounts } = useSignalStore();
  const { theses, fetchTheses } = useThesisStore();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_SIGNAL });
  const [activeFilter, setActiveFilter] = useState('New');
  const [error, setError] = useState(null);
  const [quickText, setQuickText] = useState('');
  const [quickError, setQuickError] = useState(null);
  const [linkingSignalId, setLinkingSignalId] = useState(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const quickInputRef = useRef(null);

  const currentStatusFilter = STATUS_FILTERS.find(f => f.label === activeFilter);

  useEffect(() => {
    const params = currentStatusFilter?.status ? { status: currentStatusFilter.status } : {};
    fetchSignals(params);
  }, [fetchSignals, activeFilter, currentStatusFilter?.status]);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  // Quick Add — parse text, create signal immediately
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const text = quickText.trim();
    if (!text) return;
    setQuickError(null);

    const isUrl = /^https?:\/\//.test(text);

    try {
      await createSignal({
        title: isUrl ? text.slice(0, 200) : text.slice(0, 200),
        description: text,
        category: 'other',
        source_type: 'manual',
        source_url: isUrl ? text : '',
        source_attribution: 'Quick add',
        novelty: 'new',
        reliability: 'unverified',
      });
      setQuickText('');
      fetchCounts();
      quickInputRef.current?.focus();
    } catch (err) {
      setQuickError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await createSignal(form);
      setForm({ ...EMPTY_SIGNAL });
      setShowForm(false);
      fetchCounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    await updateSignal(id, { status: newStatus });
    fetchCounts();
  };

  const handleLinkToThesis = async (signalId, thesisId) => {
    await updateSignal(signalId, { thesis_id: thesisId, status: 'linked' });
    setLinkingSignalId(null);
    fetchCounts();
  };

  // Start Thesis from Signal — navigate to Quick Capture pre-filled
  const handleStartThesis = (signal) => {
    navigate('/thesis/new', {
      state: {
        fromSignal: {
          id: signal.id,
          title: signal.title,
          description: signal.description,
          category: signal.category,
          source_type: signal.source_type,
        },
      },
    });
  };

  // Bulk: Create Thesis from Selected signals
  const handleBulkCreateThesis = () => {
    const selected = signals.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return;
    navigate('/thesis/new', {
      state: {
        fromSignals: selected.map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          category: s.category,
          source_type: s.source_type,
        })),
      },
    });
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBulkMode = () => {
    if (bulkMode) {
      setSelectedIds(new Set());
    }
    setBulkMode(!bulkMode);
  };

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Signal Inbox</h1>
        <p className="text-sm text-slate-500 mt-1">New signals that need your attention. Capture observations fast. Grant legitimacy slowly.</p>
      </div>

      {/* Quick Add Signal */}
      <form onSubmit={handleQuickAdd} className="mb-6">
        <div className="flex gap-2">
          <input
            ref={quickInputRef}
            value={quickText}
            onChange={e => setQuickText(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            placeholder="Paste a headline, URL, or quick note and hit Enter..."
            autoFocus
          />
          <button
            type="submit"
            disabled={!quickText.trim()}
            className="px-5 py-3 bg-cyan-500 text-slate-950 font-bold rounded-lg text-sm hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            + Add
          </button>
        </div>
        {quickError && (
          <p className="text-xs text-red-400 mt-1">{quickError}</p>
        )}
      </form>

      {/* Filter + actions bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setActiveFilter(f.label)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeFilter === f.label ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleBulkMode}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              bulkMode
                ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                : 'text-slate-500 hover:text-slate-300 border-slate-700'
            }`}
          >
            {bulkMode ? 'Cancel Select' : 'Select Multiple'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded transition-colors"
          >
            {showForm ? 'Cancel' : 'Full Form'}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg flex items-center justify-between">
          <span className="text-sm text-cyan-400">
            {selectedIds.size} signal{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkCreateThesis}
            className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold rounded text-sm hover:bg-cyan-400 transition-colors"
          >
            Create Thesis from Selected
          </button>
        </div>
      )}

      {/* Expanded create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-lg border border-slate-800 p-5 mb-6 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" required>
              <input
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                placeholder="Concise observation title"
                required
              />
            </Field>
            <Field label="Category" required>
              <select
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Description" required>
            <textarea
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 h-24"
              placeholder="What did you observe? Be specific."
              required
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Source Type">
              <select
                value={form.source_type} onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
              >
                {SOURCE_TYPES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Novelty">
              <select
                value={form.novelty} onChange={e => setForm(f => ({ ...f, novelty: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
              >
                {NOVELTY.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Reliability">
              <select
                value={form.reliability} onChange={e => setForm(f => ({ ...f, reliability: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
              >
                {RELIABILITY.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Source URL">
              <input
                value={form.source_url} onChange={e => setForm(f => ({ ...f, source_url: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                placeholder="https://..."
              />
            </Field>
            <Field label="Source Attribution">
              <input
                value={form.source_attribution} onChange={e => setForm(f => ({ ...f, source_attribution: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
                placeholder="e.g., Reuters, OSINT analyst, personal observation"
              />
            </Field>
          </div>

          <Field label={`Signal Strength: ${form.signal_strength}`}>
            <input
              type="range" min="0" max="1" step="0.1"
              value={form.signal_strength}
              onChange={e => setForm(f => ({ ...f, signal_strength: parseFloat(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-600">
              <span>Noise</span><span>Strong signal</span>
            </div>
          </Field>

          <button
            type="submit"
            className="px-6 py-2 bg-cyan-500 text-slate-950 font-bold rounded text-sm hover:bg-cyan-400 transition-colors"
          >
            Capture Signal
          </button>
        </form>
      )}

      {/* Signal list — newest first */}
      <div className="space-y-2">
        {signals.map(signal => (
          <div key={signal.id} className={`bg-slate-900 rounded-lg border p-4 hover:border-slate-700 transition-colors ${
            selectedIds.has(signal.id) ? 'border-cyan-500/50' : 'border-slate-800'
          }`}>
            <div className="flex justify-between items-start">
              {/* Checkbox for bulk mode */}
              {bulkMode && (
                <div className="mr-3 flex-shrink-0 pt-0.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(signal.id)}
                    onChange={() => toggleSelection(signal.id)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
                  />
                </div>
              )}

              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-slate-200 truncate">{signal.title}</h3>
                  {signal.direction && signal.direction !== 'neutral' && (
                    <DirectionBadge direction={signal.direction} />
                  )}
                  {signal.significance && signal.significance >= 3 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      {signal.significance}/5
                    </span>
                  )}
                </div>

                {/* Summary or description */}
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{signal.summary || signal.description}</p>

                {/* Metadata row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <SourceBadge type={signal.source_type} />
                  {signal.entity && (
                    <span className="text-xs font-mono bg-slate-800 text-cyan-400 px-1.5 py-0.5 rounded">
                      {signal.entity}
                    </span>
                  )}
                  <FreshnessBadge dateStr={signal.created_at} />
                  {signal.category && signal.category !== 'other' && (
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      {signal.category.replace(/_/g, ' ')}
                    </span>
                  )}
                  {signal.reliability && signal.reliability !== 'unverified' && (
                    <ReliabilityBadge level={signal.reliability} />
                  )}
                  {signal.signal_strength != null && signal.signal_strength > 0 && (
                    <StrengthDots strength={signal.signal_strength} />
                  )}
                  {signal.value != null && (
                    <span className="text-xs text-slate-500 font-mono">
                      {signal.value.toFixed(2)}{signal.change != null ? ` (${signal.change >= 0 ? '+' : ''}${signal.change.toFixed(2)})` : ''}
                    </span>
                  )}
                  {signal.source_url && (
                    <a
                      href={signal.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-500 hover:text-cyan-400 truncate max-w-[200px]"
                    >
                      source
                    </a>
                  )}
                  {signal.tags?.includes('consolidated') && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">corroborated</span>
                  )}
                </div>
                {/* Why it matters — contextual one-liner */}
                {signal.category && signal.category !== 'other' && signal.direction && signal.direction !== 'neutral' && (
                  <p className="text-xs text-slate-600 mt-1.5 italic">
                    {whyItMatters(signal)}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 ml-3 flex-shrink-0">
                {(signal.status === 'inbox' || signal.status === 'reviewing') && (
                  <>
                    <button
                      onClick={() => handleStartThesis(signal)}
                      className="px-2 py-1 rounded text-xs transition-colors text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                      title="Start a new thesis pre-filled from this signal"
                    >
                      Start Thesis
                    </button>
                    <button
                      onClick={() => setLinkingSignalId(linkingSignalId === signal.id ? null : signal.id)}
                      className="px-2 py-1 rounded text-xs transition-colors text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20"
                    >
                      Link to Thesis
                    </button>
                    <StatusBtn label="Dismiss" onClick={() => handleStatusChange(signal.id, 'noise')} color="red" />
                  </>
                )}
                {signal.status === 'linked' && signal.thesis_id && (
                  <a
                    href={`/thesis/${signal.thesis_id}`}
                    className="px-2 py-1 rounded text-xs text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                  >
                    View Thesis
                  </a>
                )}
                {signal.status === 'noise' && (
                  <StatusBtn label="Restore" onClick={() => handleStatusChange(signal.id, 'inbox')} color="slate" />
                )}
              </div>
            </div>

            {/* Link to Thesis dropdown */}
            {linkingSignalId === signal.id && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-2">Select a thesis to link this signal to:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {theses.length === 0 ? (
                    <p className="text-xs text-slate-600">No theses yet. Use "Start Thesis" to create one from this signal.</p>
                  ) : (
                    theses.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleLinkToThesis(signal.id, t.id)}
                        className="w-full text-left px-3 py-2 rounded text-xs bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors flex justify-between items-center"
                      >
                        <span className="truncate">{t.title}</span>
                        <span className="text-slate-600 ml-2 flex-shrink-0">{t.classification}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {signals.length === 0 && (
          <p className="text-sm text-slate-600 text-center py-12">No signals in this view.</p>
        )}
      </div>
    </div>
  );
}

function DirectionBadge({ direction }) {
  const styles = {
    bullish: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    bearish: 'bg-red-500/10 text-red-400 border border-red-500/20',
    neutral: 'bg-slate-700 text-slate-400',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles[direction] || styles.neutral}`}>
      {direction}
    </span>
  );
}

function SourceBadge({ type }) {
  const colors = SOURCE_BADGE_COLORS[type] || 'bg-slate-700 text-slate-400';
  const label = type === 'news_feed' ? 'news' : type === 'market_data' ? 'market' : type.replace(/_/g, ' ');
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors}`}>
      {label}
    </span>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusBtn({ label, onClick, color = 'slate' }) {
  const colors = {
    slate: 'text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700',
    cyan: 'text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20',
    red: 'text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20',
  };
  return (
    <button onClick={onClick} className={`px-2 py-1 rounded text-xs transition-colors ${colors[color]}`}>
      {label}
    </button>
  );
}

function FreshnessBadge({ dateStr }) {
  if (!dateStr) return null;
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  let label, color;
  if (mins < 60) { label = `${mins}m`; color = 'text-emerald-400'; }
  else if (mins < 1440) { label = `${Math.floor(mins / 60)}h`; color = 'text-slate-400'; }
  else { label = `${Math.floor(mins / 1440)}d`; color = 'text-slate-600'; }
  return <span className={`text-xs ${color}`}>{label}</span>;
}

function ReliabilityBadge({ level }) {
  const styles = {
    verified: 'text-emerald-400',
    likely: 'text-blue-400',
    disputed: 'text-red-400',
  };
  return <span className={`text-xs ${styles[level] || 'text-slate-500'}`}>{level}</span>;
}

function StrengthDots({ strength }) {
  const filled = Math.round(strength * 5);
  return (
    <span className="text-xs tracking-wider" title={`Strength: ${(strength * 100).toFixed(0)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? 'text-cyan-400' : 'text-slate-700'}>|</span>
      ))}
    </span>
  );
}

const CATEGORY_CONTEXT = {
  energy_bottleneck: 'Supply disruption risk for energy-linked assets',
  geopolitical_escalation: 'Escalation pressure on risk assets and defense sector',
  military_mobilization: 'Conflict intensity affecting regional stability',
  central_bank_action: 'Monetary policy shift affecting rates and equities',
  currency_instability: 'FX stress impacting trade and EM positioning',
  credit_stress: 'Credit conditions tightening, affects borrowers and yields',
  sanctions_risk: 'Trade restriction risk for affected economies',
  shipping_disruption: 'Supply chain disruption risk for commodity flows',
  commodity_chokepoint: 'Physical supply constraint on raw materials',
  policy_shock: 'Macro policy change affecting growth outlook',
  market_complacency: 'Risk sentiment divergence from fundamentals',
};

function whyItMatters(signal) {
  const base = CATEGORY_CONTEXT[signal.category];
  if (!base) return null;
  const dir = signal.direction === 'bearish' ? 'Bearish signal' : signal.direction === 'bullish' ? 'Bullish signal' : 'Signal';
  return `${dir}: ${base.toLowerCase()}.`;
}
