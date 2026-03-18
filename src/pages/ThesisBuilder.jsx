import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThesisStore } from '../store/useThesisStore';
import { useSignalStore } from '../store/useSignalStore';
import { BEHAVIORAL_PROMPTS } from '../engine/behavioral';

const EMPTY_THESIS = {
  title: '',
  thesis_statement: '',
  causal_chain: [''],
  affected_assets: [{ asset: '', direction: 'long', mechanism: '' }],
  expected_timeline: { start: '', end: '', basis: '' },
  probability_low: 0.2,
  probability_high: 0.6,
  probability_best: 0.4,
  market_pricing_assessment: { description: '', implied_prob: '', gap_size: '' },
  key_assumptions: [''],
  alternative_explanations: [''],
  disconfirming_evidence: [''],
  strongest_bear_case: '',
  what_would_make_opposite_stronger: '',
  early_vs_right: '',
  leading_indicators: [],
  confirming_indicators: [],
  invalidating_indicators: [{ indicator: '', current_state: '', target_state: '' }],
  tags: [],
};

export default function ThesisBuilder() {
  const location = useLocation();
  const { updateSignal, fetchCounts } = useSignalStore();

  // Derive initial form state from navigation (single signal or multiple)
  const { initialForm, linkedSignalIds, sourceLabel } = useMemo(() => {
    const state = location.state;
    const ids = [];
    let form = { ...EMPTY_THESIS };
    let label = null;

    if (state?.fromBotCluster) {
      // From Bot Feed cluster → rich prefill
      const c = state.fromBotCluster;
      form = {
        ...form,
        title: c.title || '',
        thesis_statement: c.thesis_statement || '',
        strongest_bear_case: c.strongest_bear_case || '',
      };
      label = `from bot cluster: ${c.title?.slice(0, 50)}`;
      // Also link any signals from the cluster
      if (state.fromSignals) {
        for (const s of state.fromSignals) ids.push(s.id);
      }
    } else if (state?.fromSignal) {
      // Single signal → pre-fill title & description
      const s = state.fromSignal;
      ids.push(s.id);
      form = {
        ...form,
        title: s.title || '',
        thesis_statement: s.description || '',
      };
      label = `from signal: ${s.title?.slice(0, 50)}`;
    } else if (state?.fromSignals && state.fromSignals.length > 0) {
      // Multiple signals → combine
      const sigs = state.fromSignals;
      for (const s of sigs) ids.push(s.id);

      const titles = sigs.map(s => s.title).filter(Boolean);
      const descriptions = sigs.map(s => `- ${s.title}: ${s.description || ''}`).join('\n');

      form = {
        ...form,
        title: titles.length === 1 ? titles[0] : '',
        thesis_statement: descriptions,
      };
      label = `from ${sigs.length} signals`;
    }

    return { initialForm: form, linkedSignalIds: ids, sourceLabel: label };
  }, [location.state]);

  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('quick'); // 'quick' or 'full'
  const navigate = useNavigate();
  const { createThesis } = useThesisStore();

  const steps = [
    { title: 'Core Thesis', fields: ['title', 'thesis_statement', 'causal_chain'] },
    { title: 'Assets & Timeline', fields: ['affected_assets', 'expected_timeline', 'probability'] },
    { title: 'Market Pricing', fields: ['market_pricing_assessment', 'key_assumptions', 'alternative_explanations'] },
    { title: 'Disconfirmation (MANDATORY)', fields: ['disconfirming_evidence', 'strongest_bear_case', 'what_would_make_opposite_stronger', 'early_vs_right'] },
    { title: 'Indicators', fields: ['invalidating_indicators', 'leading_indicators'] },
  ];

  const updateList = (field, index, value) => {
    setForm(f => {
      const list = [...(f[field] || [])];
      list[index] = value;
      return { ...f, [field]: list };
    });
  };

  const addToList = (field, template) => {
    setForm(f => ({ ...f, [field]: [...(f[field] || []), template] }));
  };

  // After creating a thesis, link any signals that spawned it
  const linkSignalsToThesis = async (thesisId) => {
    for (const signalId of linkedSignalIds) {
      try {
        await updateSignal(signalId, { thesis_id: thesisId, status: 'linked' });
      } catch (err) {
        console.warn(`[ThesisBuilder] Failed to link signal ${signalId}:`, err.message);
      }
    }
    if (linkedSignalIds.length > 0) fetchCounts();
  };

  const handleQuickCapture = async () => {
    setError(null);
    if (!form.title.trim() || !form.thesis_statement.trim()) {
      setError('Title and thesis statement are required.');
      return;
    }
    try {
      console.log('[QuickCapture] Saving draft:', form.title.trim());
      const thesis = await createThesis({
        title: form.title.trim(),
        thesis_statement: form.thesis_statement.trim(),
        status: 'draft',
        classification: 'WATCH',
      });
      if (!thesis || !thesis.id) {
        setError('Save appeared to succeed but no thesis was returned. Check server logs.');
        return;
      }
      console.log('[QuickCapture] Saved:', thesis.id);
      await linkSignalsToThesis(thesis.id);
      navigate(`/thesis/${thesis.id}`);
    } catch (err) {
      console.error('[QuickCapture] Save failed:', err);
      setError(err.message || 'Unknown error saving thesis');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.title.trim() || !form.thesis_statement.trim()) {
      setError('Title and thesis statement are required.');
      return;
    }
    try {
      console.log('[ThesisBuilder] Submitting full thesis:', form.title.trim());
      const thesis = await createThesis({
        ...form,
        status: 'draft',
        classification: 'WATCH',
      });
      if (!thesis || !thesis.id) {
        setError('Save appeared to succeed but no thesis was returned. Check server logs.');
        return;
      }
      console.log('[ThesisBuilder] Saved:', thesis.id);
      await linkSignalsToThesis(thesis.id);
      navigate(`/thesis/${thesis.id}`);
    } catch (err) {
      console.error('[ThesisBuilder] Save failed:', err);
      setError(err.message || 'Unknown error saving thesis');
    }
  };

  const probSpread = form.probability_high - form.probability_low;

  // === QUICK CAPTURE MODE ===
  if (mode === 'quick') {
    return (
      <div className="p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Quick Capture</h1>
          <p className="text-sm text-slate-500 mt-1">Capture the idea now. Add structure later.</p>
        </div>

        {sourceLabel && (
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 mb-4 flex items-center gap-2">
            <span className="text-xs text-cyan-400">Creating thesis {sourceLabel}</span>
            {linkedSignalIds.length > 0 && (
              <span className="text-xs text-slate-500">
                ({linkedSignalIds.length} signal{linkedSignalIds.length !== 1 ? 's' : ''} will be auto-linked on save)
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded p-3 mb-4">{error}</div>
        )}

        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Thesis Title <span className="text-red-400">*</span>
            </label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="input-field"
              placeholder="e.g. Oil spike on Hormuz disruption"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              What will happen and why? <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.thesis_statement}
              onChange={e => setForm(f => ({ ...f, thesis_statement: e.target.value }))}
              className="input-field h-32"
              placeholder="Describe the specific prediction and the reasoning behind it..."
              onKeyDown={e => {
                if (e.key === 'Enter' && e.metaKey) handleQuickCapture();
              }}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setMode('full')}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Switch to full builder
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-600">Cmd+Enter to save</span>
              <button
                onClick={handleQuickCapture}
                className="px-6 py-2.5 bg-cyan-500 text-slate-950 font-bold rounded text-sm hover:bg-cyan-400"
              >
                Save Draft
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 mt-4">
          Saved as draft. You can expand with causal chain, assets, probabilities, and disconfirmation from the thesis detail page.
        </p>
      </div>
    );
  }

  // === FULL BUILDER MODE ===
  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">New Thesis</h1>
          <p className="text-sm text-slate-500 mt-1">Operationalize intuition. Force structure. No shortcuts.</p>
        </div>
        <button
          onClick={() => setMode('quick')}
          className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-400/20 rounded px-3 py-1.5"
        >
          Quick Capture
        </button>
      </div>

      {/* Challenge prompt */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-6">
        <p className="text-xs text-amber-400 font-medium mb-1">CHALLENGE</p>
        <p className="text-sm text-amber-200">{BEHAVIORAL_PROMPTS.thesis_creation[step % BEHAVIORAL_PROMPTS.thesis_creation.length]}</p>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded p-3 mb-4">{error}</div>
      )}

      {/* Step indicator */}
      <div className="flex gap-1 mb-6">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`flex-1 py-2 text-xs rounded font-medium transition-colors ${
              i === step ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : i < step ? 'bg-slate-800 text-slate-400'
                  : 'bg-slate-900 text-slate-600'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
        {/* Step 0: Core Thesis */}
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Thesis Title" required>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="input-field" placeholder="Clear, specific title" required />
            </Field>
            <Field label="Thesis Statement" required hint="What specifically will happen, and why?">
              <textarea value={form.thesis_statement} onChange={e => setForm(f => ({ ...f, thesis_statement: e.target.value }))}
                className="input-field h-28" placeholder="Specific, testable prediction with rationale" required />
            </Field>
            <Field label="Causal Chain" required hint="Step-by-step: cause → effect → market consequence">
              {form.causal_chain.map((step, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <span className="text-xs text-slate-600 mt-2 w-6">{i + 1}.</span>
                  <input value={step} onChange={e => updateList('causal_chain', i, e.target.value)}
                    className="input-field flex-1" placeholder={`Step ${i + 1} in the causal chain`} />
                </div>
              ))}
              <button onClick={() => addToList('causal_chain', '')}
                className="text-xs text-cyan-400 hover:text-cyan-300 mt-1">+ Add step</button>
            </Field>
          </div>
        )}

        {/* Step 1: Assets & Timeline */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Affected Assets" required>
              {form.affected_assets.map((a, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                  <input value={a.asset} onChange={e => updateList('affected_assets', i, { ...a, asset: e.target.value })}
                    className="input-field" placeholder="Asset/ticker" />
                  <select value={a.direction} onChange={e => updateList('affected_assets', i, { ...a, direction: e.target.value })}
                    className="input-field">
                    <option value="long">Long / Bullish</option>
                    <option value="short">Short / Bearish</option>
                    <option value="vol_up">Volatility Up</option>
                    <option value="vol_down">Volatility Down</option>
                  </select>
                  <input value={a.mechanism} onChange={e => updateList('affected_assets', i, { ...a, mechanism: e.target.value })}
                    className="input-field" placeholder="Mechanism (why this asset?)" />
                </div>
              ))}
              <button onClick={() => addToList('affected_assets', { asset: '', direction: 'long', mechanism: '' })}
                className="text-xs text-cyan-400 hover:text-cyan-300">+ Add asset</button>
            </Field>

            <Field label="Expected Timeline" required>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Start</label>
                  <input type="date" value={form.expected_timeline.start}
                    onChange={e => setForm(f => ({ ...f, expected_timeline: { ...f.expected_timeline, start: e.target.value } }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">End</label>
                  <input type="date" value={form.expected_timeline.end}
                    onChange={e => setForm(f => ({ ...f, expected_timeline: { ...f.expected_timeline, end: e.target.value } }))}
                    className="input-field" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Basis</label>
                  <input value={form.expected_timeline.basis}
                    onChange={e => setForm(f => ({ ...f, expected_timeline: { ...f.expected_timeline, basis: e.target.value } }))}
                    className="input-field" placeholder="Why this timeframe?" />
                </div>
              </div>
            </Field>

            <Field label="Probability Estimate" required hint={
              probSpread < 0.15
                ? 'Spread too narrow. Overconfidence detected. Widen your range.'
                : `Spread: ${(probSpread * 100).toFixed(0)}%`
            }>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Low ({(form.probability_low * 100).toFixed(0)}%)</label>
                  <input type="range" min="0.05" max="0.95" step="0.05" value={form.probability_low}
                    onChange={e => setForm(f => ({ ...f, probability_low: parseFloat(e.target.value) }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Best ({(form.probability_best * 100).toFixed(0)}%)</label>
                  <input type="range" min="0.05" max="0.95" step="0.05" value={form.probability_best}
                    onChange={e => setForm(f => ({ ...f, probability_best: parseFloat(e.target.value) }))} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">High ({(form.probability_high * 100).toFixed(0)}%)</label>
                  <input type="range" min="0.05" max="0.95" step="0.05" value={form.probability_high}
                    onChange={e => setForm(f => ({ ...f, probability_high: parseFloat(e.target.value) }))} className="w-full" />
                </div>
              </div>
              {probSpread < 0.15 && (
                <p className="text-xs text-red-400 mt-2">
                  A narrow probability range signals overconfidence. The engine will penalize this.
                </p>
              )}
            </Field>
          </div>
        )}

        {/* Step 2: Market Pricing */}
        {step === 2 && (
          <div className="space-y-4">
            <Field label="Why might the market be mispricing this?" required>
              <textarea value={form.market_pricing_assessment.description}
                onChange={e => setForm(f => ({ ...f, market_pricing_assessment: { ...f.market_pricing_assessment, description: e.target.value } }))}
                className="input-field h-24" placeholder="What is the market missing or underweighting?" />
            </Field>
            <Field label="Key Assumptions" required hint="Each assumption is a failure point.">
              {form.key_assumptions.map((a, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <span className="text-xs text-slate-600 mt-2 w-6">{i + 1}.</span>
                  <input value={a} onChange={e => updateList('key_assumptions', i, e.target.value)}
                    className="input-field flex-1" placeholder={`Assumption ${i + 1}`} />
                </div>
              ))}
              <button onClick={() => addToList('key_assumptions', '')} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add</button>
              {form.key_assumptions.filter(a => a.length > 0).length > 5 && (
                <p className="text-xs text-amber-400 mt-1">
                  {form.key_assumptions.filter(a => a.length > 0).length} assumptions. Each is a way to be wrong. The engine will downgrade.
                </p>
              )}
            </Field>
            <Field label="Alternative Explanations" required hint="What else could explain what you're seeing?">
              {form.alternative_explanations.map((a, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={a} onChange={e => updateList('alternative_explanations', i, e.target.value)}
                    className="input-field flex-1" placeholder="Alternative explanation" />
                </div>
              ))}
              <button onClick={() => addToList('alternative_explanations', '')} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add</button>
            </Field>
          </div>
        )}

        {/* Step 3: Disconfirmation — THE MOST IMPORTANT STEP */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-red-500/5 border border-red-500/20 rounded p-3 mb-2">
              <p className="text-xs text-red-400 font-bold">THIS SECTION IS MANDATORY.</p>
              <p className="text-xs text-red-300 mt-1">
                You cannot create a thesis without articulating why it might be wrong.
                This is the behavioral constraint that protects you from narrative attachment.
              </p>
            </div>

            <Field label="Disconfirming Evidence" required hint="What evidence would weaken or kill this thesis?">
              {form.disconfirming_evidence.map((d, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={d} onChange={e => updateList('disconfirming_evidence', i, e.target.value)}
                    className="input-field flex-1" placeholder="Evidence that would hurt this thesis" />
                </div>
              ))}
              <button onClick={() => addToList('disconfirming_evidence', '')} className="text-xs text-cyan-400 hover:text-cyan-300">+ Add</button>
            </Field>

            <Field label="Strongest Bear Case" required hint="Write it as if you were arguing AGAINST yourself.">
              <textarea value={form.strongest_bear_case}
                onChange={e => setForm(f => ({ ...f, strongest_bear_case: e.target.value }))}
                className="input-field h-28" placeholder="If you were short this thesis, what would your argument be?" />
            </Field>

            <Field label="What would make the OPPOSITE case stronger?" required>
              <textarea value={form.what_would_make_opposite_stronger}
                onChange={e => setForm(f => ({ ...f, what_would_make_opposite_stronger: e.target.value }))}
                className="input-field h-24" placeholder="What developments would flip this thesis entirely?" />
            </Field>

            <Field label="What evidence would prove you're EARLY, not RIGHT?" hint="Being early is the #1 excuse for being wrong.">
              <textarea value={form.early_vs_right}
                onChange={e => setForm(f => ({ ...f, early_vs_right: e.target.value }))}
                className="input-field h-20" placeholder="How would you distinguish 'I'm early' from 'I'm wrong'?" />
            </Field>
          </div>
        )}

        {/* Step 4: Indicators */}
        {step === 4 && (
          <div className="space-y-4">
            <Field label="Invalidating Indicators" required hint="What would PROVE the thesis wrong?">
              {form.invalidating_indicators.map((ind, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 mb-2">
                  <input value={ind.indicator} onChange={e => updateList('invalidating_indicators', i, { ...ind, indicator: e.target.value })}
                    className="input-field" placeholder="Indicator" />
                  <input value={ind.current_state} onChange={e => updateList('invalidating_indicators', i, { ...ind, current_state: e.target.value })}
                    className="input-field" placeholder="Current state" />
                  <input value={ind.target_state} onChange={e => updateList('invalidating_indicators', i, { ...ind, target_state: e.target.value })}
                    className="input-field" placeholder="Invalidation state" />
                </div>
              ))}
              <button onClick={() => addToList('invalidating_indicators', { indicator: '', current_state: '', target_state: '' })}
                className="text-xs text-cyan-400 hover:text-cyan-300">+ Add</button>
            </Field>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-4 border-t border-slate-800">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-30"
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="px-6 py-2 bg-slate-800 text-slate-200 rounded text-sm hover:bg-slate-700">
              Next: {steps[step + 1].title}
            </button>
          ) : (
            <button onClick={handleSubmit}
              className="px-6 py-2 bg-cyan-500 text-slate-950 font-bold rounded text-sm hover:bg-cyan-400">
              Create Thesis
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-600 mb-2">{hint}</p>}
      {children}
    </div>
  );
}
