import { useEffect, useState } from 'react';
import { useSignalStore } from '../store/useSignalStore';

const CATEGORIES = [
  'geopolitical_escalation', 'military_mobilization', 'commodity_chokepoint',
  'sanctions_risk', 'shipping_disruption', 'energy_bottleneck',
  'policy_shock', 'currency_instability', 'market_complacency',
  'central_bank_action', 'election_political', 'supply_chain',
  'technology_disruption', 'credit_stress', 'other',
];

const SOURCE_TYPES = ['manual', 'news_feed', 'market_data', 'social', 'government', 'satellite', 'shipping', 'analyst', 'other'];
const NOVELTY = ['new', 'developing', 'known', 'stale', 'unknown'];
const RELIABILITY = ['verified', 'likely', 'unverified', 'disputed'];

const EMPTY_SIGNAL = {
  title: '', description: '', category: 'other', source_type: 'manual',
  source_url: '', source_attribution: '', novelty: 'unknown', reliability: 'unverified',
  signal_strength: 0.5, tags: [],
};

export default function SignalInbox() {
  const { signals, fetchSignals, createSignal, updateSignal } = useSignalStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_SIGNAL });
  const [filter, setFilter] = useState('inbox');
  const [error, setError] = useState(null);

  useEffect(() => { fetchSignals(filter !== 'all' ? { status: filter } : {}); }, [fetchSignals, filter]);

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

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Signal Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">Capture observations fast. Grant legitimacy slowly.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-sm hover:bg-cyan-500/20 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Signal'}
        </button>
      </div>

      {/* Create form */}
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

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
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

      {/* Signal list */}
      <div className="space-y-2">
        {signals.map(signal => (
          <div key={signal.id} className="bg-slate-900 rounded-lg border border-slate-800 p-4 hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-slate-200">{signal.title}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{signal.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">{signal.category?.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-600">{signal.source_type?.replace(/_/g, ' ')}</span>
                  {signal.source_attribution && (
                    <span className="text-xs text-slate-600">via {signal.source_attribution}</span>
                  )}
                  <span className={`text-xs ${signal.novelty === 'new' ? 'text-amber-400' : 'text-slate-600'}`}>
                    {signal.novelty}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 ml-3">
                {signal.status === 'inbox' && (
                  <>
                    <StatusBtn label="Review" onClick={() => handleStatusChange(signal.id, 'reviewing')} />
                    <StatusBtn label="Noise" onClick={() => handleStatusChange(signal.id, 'noise')} color="red" />
                  </>
                )}
                {signal.status === 'reviewing' && (
                  <>
                    <StatusBtn label="Link" onClick={() => handleStatusChange(signal.id, 'linked')} color="cyan" />
                    <StatusBtn label="Noise" onClick={() => handleStatusChange(signal.id, 'noise')} color="red" />
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {signals.length === 0 && (
          <p className="text-sm text-slate-600 text-center py-12">No signals in this view.</p>
        )}
      </div>
    </div>
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
