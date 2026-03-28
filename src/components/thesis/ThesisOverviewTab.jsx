/**
 * ThesisOverviewTab — Two-column thesis workspace layout.
 *
 * Left column: the thesis memo (statement, probability, timeline, causal chain,
 * invalidation, counter-case).
 *
 * Right column: intelligence context (linked signals summary, score summary,
 * affected assets, market pricing).
 */
export default function ThesisOverviewTab({ thesis, signals, evaluation }) {
  const chain = Array.isArray(thesis.causal_chain) ? thesis.causal_chain : [];
  const assets = Array.isArray(thesis.affected_assets)
    ? thesis.affected_assets
    : [];
  const assumptions = Array.isArray(thesis.key_assumptions)
    ? thesis.key_assumptions
    : [];
  const disconfirming = Array.isArray(thesis.disconfirming_evidence)
    ? thesis.disconfirming_evidence
    : [];
  const alternatives = Array.isArray(thesis.alternative_explanations)
    ? thesis.alternative_explanations
    : [];
  const invalidating = Array.isArray(thesis.invalidating_indicators)
    ? thesis.invalidating_indicators
    : [];

  // Derive briefing data
  const supportingCount = signals.length;
  const sourceTypes = [...new Set(signals.map(s => s.source_type).filter(Boolean))];
  const categories = [...new Set(signals.map(s => s.category).filter(Boolean))];

  // Evidence quality warnings
  const warnings = [];
  if (signals.length === 0) warnings.push('No signals linked');
  else if (signals.length < 3) warnings.push('Thin evidence — needs more signals');
  if (sourceTypes.length === 1 && signals.length > 0) warnings.push('Single-source risk');
  const oldestSignal = signals.length > 0
    ? Math.max(...signals.map(s => (Date.now() - new Date(s.created_at).getTime()) / 86400000))
    : 0;
  if (oldestSignal > 7) warnings.push('Evidence aging (>7 days)');

  const missingEvidence = [];
  if (!thesis.strongest_bear_case) missingEvidence.push('strongest bear case');
  if (!thesis.what_would_make_opposite_stronger) missingEvidence.push('counter-scenario');
  if (invalidating.length === 0) missingEvidence.push('invalidation conditions');
  if (chain.length === 0) missingEvidence.push('causal chain');

  return (
    <div className="space-y-6">
      {/* BRIEFING PANEL */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Thesis Briefing</h3>
          <div className="flex gap-1">
            <span className={`text-xs px-2 py-0.5 rounded ${thesis.classification === 'WATCH' ? 'bg-blue-500/10 text-blue-400' : thesis.classification === 'DEVELOP' || thesis.classification === 'DEVELOP_THESIS' ? 'bg-amber-500/10 text-amber-400' : thesis.classification === 'ESCALATE' ? 'bg-red-500/10 text-red-400' : 'bg-slate-700 text-slate-400'}`}>{thesis.classification}</span>
            {thesis.composite_score != null && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">{thesis.composite_score.toFixed(0)}/100</span>
            )}
          </div>
        </div>

        {/* Core claim */}
        <p className="text-sm text-slate-300 mb-3">{thesis.thesis_statement || 'No thesis statement'}</p>

        {/* Top evidence */}
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">Supporting Evidence: {supportingCount} signal{supportingCount !== 1 ? 's' : ''}{sourceTypes.length > 0 ? ` from ${sourceTypes.join(', ')}` : ''}</p>
          {signals.slice(0, 3).map(s => (
            <div key={s.id} className="flex items-center gap-2 py-0.5 text-xs">
              <SignalFreshnessDot dateStr={s.created_at} />
              <span className="text-slate-400 truncate">{s.title}</span>
              <span className="text-slate-600 shrink-0">{s.source_type === 'news_feed' ? 'news' : s.source_type}</span>
            </div>
          ))}
          {signals.length > 3 && <p className="text-xs text-slate-600 mt-0.5">+{signals.length - 3} more signals</p>}
        </div>

        {/* Warnings + gaps */}
        {(warnings.length > 0 || missingEvidence.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {warnings.map((w, i) => (
              <span key={i} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">{w}</span>
            ))}
            {missingEvidence.map((m, i) => (
              <span key={i} className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded">Missing: {m}</span>
            ))}
          </div>
        )}

        {/* Counter-case */}
        <div className="text-xs">
          <span className="text-slate-500">Counter-case: </span>
          <span className={thesis.strongest_bear_case ? 'text-slate-400' : 'text-amber-400'}>{thesis.strongest_bear_case || 'Not defined'}</span>
        </div>

        {/* Compact metrics row */}
        <div className="flex gap-4 mt-3 text-xs text-slate-500 border-t border-slate-800 pt-2">
          <span>Horizon: {formatTimeline(thesis)}</span>
          <span>Prob: {formatProbability(thesis)}</span>
          {assets.length > 0 && <span>Assets: {assets.map(a => a.asset).join(', ')}</span>}
          <span>Created: {new Date(thesis.created_at).toLocaleDateString()}</span>
        </div>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT COLUMN — The Thesis Memo (2/3 width) */}
      <div className="lg:col-span-2 space-y-5">
        {/* Core parameters */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Probability" value={formatProbability(thesis)} />
          <MetricCard label="Time Horizon" value={formatTimeline(thesis)} />
          <MetricCard
            label="Assumptions"
            value={`${assumptions.length} key`}
            warn={assumptions.length > 5}
          />
        </div>

        {/* Causal Chain */}
        {chain.length > 0 && (
          <Section title="Causal Chain">
            {chain.map((step, i) => (
              <div key={i} className="flex gap-3 items-start py-1">
                <span className="text-xs text-slate-600 font-mono w-6 mt-0.5">
                  {i + 1}.
                </span>
                <span className="text-sm text-slate-300">{step}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Invalidation conditions */}
        {invalidating.length > 0 && (
          <Section title="Invalidation Conditions">
            {invalidating.map((ind, i) => (
              <div key={i} className="flex gap-3 items-start py-1">
                <span className="text-xs text-red-500 font-mono w-6 mt-0.5">
                  !
                </span>
                <div className="text-sm">
                  <span className="text-slate-300">
                    {typeof ind === "string"
                      ? ind
                      : ind.indicator || JSON.stringify(ind)}
                  </span>
                  {ind.target_state && (
                    <span className="text-red-400 ml-2 text-xs">
                      target: {ind.target_state}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Disconfirmation */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <h3 className="text-sm font-bold text-red-400 mb-3">
            DISCONFIRMATION
          </h3>
          <div className="space-y-3">
            <DisconfirmField
              label="Strongest Bear Case"
              value={thesis.strongest_bear_case}
            />
            <DisconfirmField
              label="What Would Make the Opposite Stronger"
              value={thesis.what_would_make_opposite_stronger}
            />
            <DisconfirmField
              label="Early vs Right"
              value={thesis.early_vs_right}
            />
            {disconfirming.length > 0 && (
              <div>
                <p className="text-xs text-red-400 mb-1">
                  Disconfirming Evidence:
                </p>
                {disconfirming.map((d, i) => (
                  <p key={i} className="text-sm text-slate-400 ml-3">
                    - {d}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alternative explanations */}
        {alternatives.length > 0 && (
          <Section title="Alternative Explanations">
            {alternatives.map((a, i) => (
              <p key={i} className="text-sm text-slate-400 py-0.5">
                - {a}
              </p>
            ))}
          </Section>
        )}
      </div>

      {/* RIGHT COLUMN — Intelligence Context (1/3 width) */}
      <div className="space-y-5">
        {/* Linked signals summary */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-2">
            Linked Signals
          </h3>
          {signals.length === 0 ? (
            <p className="text-xs text-slate-600">No signals linked yet.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-2">
                {signals.length} signal{signals.length !== 1 ? "s" : ""} linked
              </p>
              <div className="space-y-1.5">
                {signals.slice(0, 5).map((s) => (
                  <div key={s.id} className="text-xs text-slate-400 truncate">
                    <SourceDot type={s.source_type} /> {s.title}
                  </div>
                ))}
                {signals.length > 5 && (
                  <p className="text-xs text-slate-600">
                    +{signals.length - 5} more
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Score summary (compact) */}
        {evaluation && (
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-2">
              Score Breakdown
            </h3>
            <div className="space-y-1.5 text-xs">
              <ScoreRow
                label="Evidence"
                score={evaluation.layers.evidence.score}
                color="cyan"
              />
              <ScoreRow
                label="Structure"
                score={evaluation.layers.structure.score}
                color="amber"
              />
              <ScoreRow
                label="Market Edge"
                score={evaluation.layers.market_edge.score}
                color="purple"
              />
            </div>
            {evaluation.penalties.total > 0 && (
              <p className="text-xs text-red-400 mt-2">
                Penalties: -{evaluation.penalties.total}
              </p>
            )}
          </div>
        )}

        {/* Affected assets */}
        {assets.length > 0 && (
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-300 mb-2">
              Affected Assets
            </h3>
            {assets.map((a, i) => (
              <div key={i} className="flex gap-3 text-xs py-1">
                <span className="text-cyan-400 font-mono">{a.asset}</span>
                <span
                  className={
                    a.direction === "short"
                      ? "text-red-400"
                      : "text-emerald-400"
                  }
                >
                  {a.direction}
                </span>
                <span className="text-slate-500 truncate">{a.mechanism}</span>
              </div>
            ))}
          </div>
        )}

        {/* Market pricing */}
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-2">
            Market Pricing
          </h3>
          <p className="text-xs text-slate-400">
            {thesis.market_pricing_assessment?.description || "Not assessed"}
          </p>
        </div>

        {/* Key assumptions */}
        {assumptions.length > 0 && (
          <div
            className={`bg-slate-900 rounded-lg border p-4 ${assumptions.length > 5 ? "border-amber-500/30" : "border-slate-800"}`}
          >
            <h3 className="text-sm font-bold text-slate-300 mb-2">
              Key Assumptions
            </h3>
            {assumptions.map((a, i) => (
              <p key={i} className="text-xs text-slate-400 py-0.5">
                {i + 1}. {a}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

// --- Briefing helper ---

function SignalFreshnessDot({ dateStr }) {
  if (!dateStr) return <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block" />;
  const hours = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  const color = hours < 4 ? 'bg-emerald-400' : hours < 24 ? 'bg-amber-400' : hours < 168 ? 'bg-orange-400' : 'bg-slate-600';
  return <span className={`w-1.5 h-1.5 rounded-full ${color} inline-block shrink-0`} />;
}

// --- Helper components ---

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
    <div
      className={`bg-slate-900 rounded-lg border p-3 ${warn ? "border-amber-500/30" : "border-slate-800"}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-sm font-medium mt-1 ${warn ? "text-amber-400" : "text-slate-300"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DisconfirmField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-red-400 mb-1">{label}:</p>
      <p className="text-sm text-slate-300">{value || "NOT WRITTEN"}</p>
    </div>
  );
}

function ScoreRow({ label, score, color }) {
  const colorMap = {
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  };
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${colorMap[color] || "text-slate-300"}`}>
        {score != null ? score.toFixed(1) : "—"}/10
      </span>
    </div>
  );
}

function SourceDot({ type }) {
  const colorMap = {
    fred: "text-blue-400",
    gdelt: "text-purple-400",
    news_feed: "text-amber-400",
    manual: "text-slate-500",
    market_data: "text-cyan-400",
  };
  return <span className={colorMap[type] || "text-slate-500"}>*</span>;
}

// --- Formatters ---

function formatProbability(thesis) {
  const low = thesis.probability_low;
  const high = thesis.probability_high;
  const best = thesis.probability_best;
  if (low == null && high == null) return "Not set";
  return `${((low || 0) * 100).toFixed(0)}–${((high || 0) * 100).toFixed(0)}% (best: ${((best || 0) * 100).toFixed(0)}%)`;
}

function formatTimeline(thesis) {
  const tl = thesis.expected_timeline;
  if (!tl || (!tl.start && !tl.end)) return "Not set";
  return `${tl.start || "?"} → ${tl.end || "?"}`;
}
