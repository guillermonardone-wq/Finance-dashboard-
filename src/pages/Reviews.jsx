import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BEHAVIORAL_PROMPTS } from '../engine/behavioral';

const OUTCOMES = [
  { value: 'correct_right_reason', label: 'Correct — right reasoning' },
  { value: 'correct_wrong_reason', label: 'Correct — wrong reasoning (got lucky)' },
  { value: 'correct_lucky', label: 'Correct — pure luck' },
  { value: 'incorrect_bad_thesis', label: 'Incorrect — thesis was wrong' },
  { value: 'incorrect_bad_execution', label: 'Incorrect — bad execution' },
  { value: 'incorrect_bad_timing', label: 'Incorrect — timing was off' },
  { value: 'mixed', label: 'Mixed results' },
  { value: 'too_early_to_tell', label: 'Too early to tell' },
];

const EMPTY_REVIEW = {
  thesis_id: '', outcome: '', outcome_description: '',
  signals_that_mattered: [''], signals_that_were_noise: [''], signals_missed: [''],
  process_followed: null, process_violations: [''],
  sizing_appropriate: null, timing_appropriate: null, early_confirmation_accurate: null,
  emotional_state_during: '',
  overconfidence_detected: false, narrative_attachment_detected: false, confirmation_bias_detected: false,
  lessons_learned: '', playbook_additions: [''], rule_changes: [''],
  process_score: 5, analysis_score: 5, execution_score: 5, overall_score: 5,
};

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_REVIEW });
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getReviews().then(setReviews).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const review = await api.createReview({
        ...form,
        signals_that_mattered: form.signals_that_mattered.filter(Boolean),
        signals_that_were_noise: form.signals_that_were_noise.filter(Boolean),
        signals_missed: form.signals_missed.filter(Boolean),
        process_violations: form.process_violations.filter(Boolean),
        playbook_additions: form.playbook_additions.filter(Boolean),
        rule_changes: form.rule_changes.filter(Boolean),
      });
      setReviews(prev => [review, ...prev]);
      setForm({ ...EMPTY_REVIEW });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Post-Mortem Reviews</h1>
          <p className="text-sm text-slate-500 mt-1">Honest review is the only way to improve. No flattery.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded text-sm hover:bg-cyan-500/20">
          {showForm ? 'Cancel' : '+ New Review'}
        </button>
      </div>

      {/* Challenge prompt */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6">
        <p className="text-xs text-amber-400 font-medium mb-1">REFLECTION</p>
        <p className="text-sm text-amber-200">
          {BEHAVIORAL_PROMPTS.post_action[Math.floor(Math.random() * BEHAVIORAL_PROMPTS.post_action.length)]}
        </p>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900 rounded-lg border border-slate-800 p-5 mb-6 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2">{error}</div>}

          <Field label="Thesis ID" required>
            <input value={form.thesis_id} onChange={e => setForm(f => ({ ...f, thesis_id: e.target.value }))}
              className="input-field" placeholder="Paste thesis ID" required />
          </Field>

          <Field label="Outcome" required>
            <select value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
              className="input-field" required>
              <option value="">Select outcome...</option>
              {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="What happened?" required>
            <textarea value={form.outcome_description}
              onChange={e => setForm(f => ({ ...f, outcome_description: e.target.value }))}
              className="input-field h-24" placeholder="Describe the outcome in detail." required />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Did you follow process?">
              <select value={form.process_followed ?? ''} onChange={e => setForm(f => ({ ...f, process_followed: e.target.value === 'true' }))}
                className="input-field">
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No — I deviated</option>
              </select>
            </Field>
            <Field label="Was sizing appropriate?">
              <select value={form.sizing_appropriate ?? ''} onChange={e => setForm(f => ({ ...f, sizing_appropriate: e.target.value === 'true' }))}
                className="input-field">
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            <Field label="Was timing appropriate?">
              <select value={form.timing_appropriate ?? ''} onChange={e => setForm(f => ({ ...f, timing_appropriate: e.target.value === 'true' }))}
                className="input-field">
                <option value="">Select...</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
          </div>

          {/* Behavioral self-assessment */}
          <div className="bg-red-500/5 border border-red-500/20 rounded p-3">
            <p className="text-xs text-red-400 font-bold mb-2">BEHAVIORAL HONESTY CHECK</p>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={form.overconfidence_detected}
                  onChange={e => setForm(f => ({ ...f, overconfidence_detected: e.target.checked }))} />
                Overconfidence detected
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={form.narrative_attachment_detected}
                  onChange={e => setForm(f => ({ ...f, narrative_attachment_detected: e.target.checked }))} />
                Narrative attachment
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={form.confirmation_bias_detected}
                  onChange={e => setForm(f => ({ ...f, confirmation_bias_detected: e.target.checked }))} />
                Confirmation bias
              </label>
            </div>
          </div>

          <Field label="Lessons Learned (>20 chars)" required>
            <textarea value={form.lessons_learned}
              onChange={e => setForm(f => ({ ...f, lessons_learned: e.target.value }))}
              className="input-field h-24" placeholder="What did you learn? Be honest and specific." required />
          </Field>

          {/* Scores */}
          <div className="grid grid-cols-4 gap-4">
            {['process_score', 'analysis_score', 'execution_score', 'overall_score'].map(field => (
              <Field key={field} label={field.replace(/_/g, ' ')} required>
                <input type="number" min="0" max="10" step="0.5" value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: parseFloat(e.target.value) }))}
                  className="input-field" />
              </Field>
            ))}
          </div>

          <button type="submit" className="px-6 py-2 bg-cyan-500 text-slate-950 font-bold rounded text-sm hover:bg-cyan-400">
            Submit Review
          </button>
        </form>
      )}

      {/* Review list */}
      <div className="space-y-3">
        {reviews.map(r => (
          <div key={r.id} className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <div className="flex justify-between items-start mb-2">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                r.outcome?.includes('correct') ? 'bg-emerald-500/10 text-emerald-400' :
                  r.outcome?.includes('incorrect') ? 'bg-red-500/10 text-red-400' :
                    'bg-slate-700 text-slate-400'
              }`}>
                {r.outcome?.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-600">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-slate-300">{r.outcome_description}</p>
            <p className="text-xs text-slate-500 mt-2">{r.lessons_learned}</p>
            <div className="flex gap-3 mt-2 text-xs">
              {r.overconfidence_detected ? <span className="text-red-400">overconfidence</span> : null}
              {r.narrative_attachment_detected ? <span className="text-red-400">narrative attached</span> : null}
              {r.confirmation_bias_detected ? <span className="text-red-400">confirmation bias</span> : null}
            </div>
          </div>
        ))}
        {reviews.length === 0 && !showForm && (
          <p className="text-sm text-slate-600 text-center py-12">No reviews yet. Complete a thesis cycle to begin.</p>
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
