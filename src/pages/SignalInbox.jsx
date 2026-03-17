import { useEffect, useState, useRef } from 'react';
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

export default function SignalInbox() {
  const { signals, fetchSignals, createSignal, updateSignal } = useSignalStore();
  const { theses, fetchTheses } = useThesisStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_SIGNAL });
  const [filter, setFilter] = useState('inbox');
  const [error, setError] = useState(null);
  const [quickText, setQuickText] = useState('');
  const [quickError, setQuickError] = useState(null);
  const [linkingSignalId, setLinkingSignalId] = useState(null);
  const quickInputRef = useRef(null);

  useEffect(() => {
    fetchSignals(filter !== 'all' ? { status: filter } : {});
  }, [fetchSignals, filter]);

  useEffect(() => {
    fetchTheses();
  }, [fetchTheses]);

  // Quick Add — parse text, create signal immediately
  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const text = quickText.trim();
    if (!text) return;
    setQuickError(null);

    // Detect if it's a URL
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
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    await updateSignal(id, { status: newStatus });
  };

  const handleLinkToThesis = async (signalId, thesisId) => {
    await updateSignal(signalId, { thesis_id: thesisId, status: 'linked' });
    setLinkingSignalId(null);
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

      {/* Expanded form toggle */}
      <div className="flex justify-between items-center mb-4">
        {/* Filter tabs */}
        <div className="flex gap-1">
          {['inbox', 'reviewing', 'linked', 'noise', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                filter === f ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded transition-colors"
        >
          {showForm ? 'Cancel' : 'Full Form'}
        </button>
      </div>

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
          <div key={signal.id} className="bg-slate-900 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium text-slate-200 truncate">{signal.title}</h3>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{signal.description}</p>

                {/* Metadata row: badge, timestamp, category */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <SourceBadge type={signal.source_type} />
                  <span className="text-xs text-slate-600">{timeAgo(signal.created_at)}</span>
                  {signal.category && signal.category !== 'other' && (
                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      {signal.category.replace(/_/g, ' ')}
                    </span>
                  )}
                  {signal.novelty === 'new' && (
                    <span className="text-xs text-amber-400">new</span>
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
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1 ml-3 flex-shrink-0">
                {signal.status === 'inbox' && (
                  <>
                    <button
                      onClick={() => setLinkingSignalId(linkingSignalId === signal.id ? null : signal.id)}
                      className="px-2 py-1 rounded text-xs transition-colors text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20"
                    >
                      Link to Thesis
                    </button>
                    <StatusBtn label="Review" onClick={() => handleStatusChange(signal.id, 'reviewing')} />
                    <StatusBtn label="Noise" onClick={() => handleStatusChange(signal.id, 'noise')} color="red" />
                  </>
                )}
                {signal.status === 'reviewing' && (
                  <>
                    <button
                      onClick={() => setLinkingSignalId(linkingSignalId === signal.id ? null : signal.id)}
                      className="px-2 py-1 rounded text-xs transition-colors text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20"
                    >
                      Link to Thesis
                    </button>
                    <StatusBtn label="Noise" onClick={() => handleStatusChange(signal.id, 'noise')} color="red" />
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
              </div>
            </div>

            {/* Link to Thesis dropdown */}
            {linkingSignalId === signal.id && (
              <div className="mt-3 pt-3 border-t border-slate-800">
                <p className="text-xs text-slate-500 mb-2">Select a thesis to link this signal to:</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {theses.length === 0 ? (
                    <p className="text-xs text-slate-600">No theses yet. Create one first.</p>
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
