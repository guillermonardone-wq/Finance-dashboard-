// ============================================================
// PREDICTION MARKET TAB — Thesis detail page integration
// ============================================================
// This component renders the "Prediction Markets" tab on the
// thesis detail page. It shows linked contracts, consensus
// comparison, warnings, and assessment history.
//
// STRUCTURAL RULE: This is informational. It does NOT modify
// gates, classification, or action state.
// ============================================================

import { useEffect, useState } from 'react';
import { usePredictionMarketStore } from '../store/usePredictionMarketStore';

export default function PredictionMarketTab({ thesis }) {
  const {
    links, assessment, loading, error,
    fetchLinksForThesis, computeAssessment,
  } = usePredictionMarketStore();

  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (thesis?.id) {
      fetchLinksForThesis(thesis.id);
    }
  }, [thesis?.id, fetchLinksForThesis]);

  const handleComputeAssessment = async () => {
    if (thesis?.id) {
      await computeAssessment(thesis.id);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 py-6 text-center">Loading prediction market data...</div>;
  if (error) return <div className="text-sm text-red-400 py-6 text-center">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Structural subordination notice */}
      <div className="text-xs text-slate-600 bg-slate-900/50 rounded px-3 py-2 border border-slate-800">
        Prediction market data is evidence, not authority. It cannot override gates, classification, or risk controls.
      </div>

      {/* Assessment staleness warning */}
      {assessment && assessment.assessment && (
        <AssessmentStalenessNotice assessment={assessment.assessment} />
      )}

      {/* Consensus Comparison Block */}
      {assessment && assessment.assessment && (
        <ConsensusComparisonBlock thesis={thesis} assessment={assessment.assessment} helpers={assessment.scoring_helpers} />
      )}

      {/* Linked Contracts */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-300">Linked Prediction Markets</h3>
          <div className="flex gap-2">
            <button onClick={handleComputeAssessment}
              className="px-3 py-1.5 text-xs bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded border border-cyan-500/20">
              Compute Assessment
            </button>
          </div>
        </div>

        {links.length === 0 ? (
          <p className="text-sm text-slate-600 py-4 text-center">
            No prediction market contracts linked to this thesis.
          </p>
        ) : (
          <div className="space-y-3">
            {links.map(link => (
              <LinkedContractCard
                key={link.id}
                link={link}
                expanded={expanded === link.id}
                onToggle={() => setExpanded(expanded === link.id ? null : link.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contract Analysis Detail */}
      {assessment && assessment.contracts && assessment.contracts.length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Contract Analysis Detail</h3>
          {assessment.contracts.map((c, i) => (
            <div key={i} className={`text-xs text-slate-400 py-2 border-b border-slate-800/30 last:border-0 ${c.is_excluded ? 'opacity-40' : ''}`}>
              <div className="flex justify-between">
                <span className="text-slate-300">{c.event_title}</span>
                <span className={c.is_excluded ? 'text-red-500' : c.weight > 0.3 ? 'text-emerald-400' : c.weight > 0.1 ? 'text-amber-400' : 'text-red-400'}>
                  {c.is_excluded ? 'EXCLUDED (>48h)' : `weight: ${c.weight.toFixed(2)}`}
                </span>
              </div>
              <div className="flex gap-4 mt-1 flex-wrap">
                <span>P(yes): {(c.implied_probability * 100).toFixed(0)}%</span>
                <span>Confidence: {(c.link_confidence * 100).toFixed(0)}%</span>
                <span>Wording: {(c.wording_match_score * 100).toFixed(0)}%</span>
                <span className="text-slate-500">type: {c.link_type.replace(/_/g, ' ')} ({c.link_type_multiplier}x)</span>
                {c.freshness_factor < 1 && !c.is_excluded && (
                  <span className="text-amber-400">freshness: {c.freshness_factor}x</span>
                )}
                {c.is_excluded && <span className="text-red-500">EXCLUDED</span>}
                {c.is_stale && !c.is_excluded && <span className="text-amber-400">STALE</span>}
                {c.is_thin && <span className="text-amber-400">THIN MARKET</span>}
                {c.wording_mismatch && <span className="text-red-400">WORDING MISMATCH</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scoring Helpers (informational only) */}
      {assessment && assessment.scoring_helpers && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Scoring Commentary</h3>
          <p className="text-xs text-slate-500 mb-2">
            These are bounded informational outputs. They do not directly modify scoring dimensions or gates.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 rounded p-2">
              <p className="text-xs text-slate-500">Divergence Modifier</p>
              <p className="text-sm text-slate-300">
                {assessment.scoring_helpers.prediction_market_divergence != null
                  ? assessment.scoring_helpers.prediction_market_divergence.toFixed(2)
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <p className="text-xs text-slate-500">Market Confidence</p>
              <p className="text-sm text-slate-300">
                {assessment.scoring_helpers.prediction_market_confidence != null
                  ? `${(assessment.scoring_helpers.prediction_market_confidence * 100).toFixed(0)}%`
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded p-2">
              <p className="text-xs text-slate-500">Qualifying Contracts</p>
              <p className="text-sm text-slate-300">
                {assessment.scoring_helpers.qualifying_contract_count ?? 0}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">{assessment.scoring_helpers.prediction_market_commentary}</p>
        </div>
      )}
    </div>
  );
}

// ---- Assessment Staleness Notice ----
function AssessmentStalenessNotice({ assessment }) {
  // Find the freshest snapshot observation time across contracts
  const contractTimes = (assessment.contracts || [])
    .filter(c => c.observed_at)
    .map(c => new Date(c.observed_at).getTime());
  const freshestSnapshot = contractTimes.length > 0 ? Math.max(...contractTimes) : null;

  // The assessment's own computed time (approximated by looking at the id/notes for now)
  // Since assessment object comes from computeAndStoreAssessment, assessed_at is stored in DB
  // but the live object may not have it — use the contracts to detect if data has moved on
  const allExcluded = (assessment.contracts || []).every(c => c.is_excluded);
  const anyExcluded = (assessment.contracts || []).some(c => c.is_excluded);

  const warnings = [];

  if (allExcluded && (assessment.contracts || []).length > 0) {
    warnings.push('All linked contracts have data older than 48h. This assessment has no current market evidence.');
  } else if (anyExcluded) {
    const count = assessment.contracts.filter(c => c.is_excluded).length;
    warnings.push(`${count} contract(s) excluded due to data older than 48h.`);
  }

  if (assessment.insufficient_evidence) {
    warnings.push(`Insufficient qualifying contracts (${assessment.qualifying_contract_count || 0} found, need 2+). No numeric probability produced.`);
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((text, i) => (
        <div key={i} className="flex gap-2 items-start text-xs text-red-400 bg-red-400/5 rounded px-2 py-1.5 border border-red-400/10">
          <span className="font-bold shrink-0">EVIDENCE QUALITY:</span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Consensus Comparison Block ----
function ConsensusComparisonBlock({ thesis, assessment, helpers }) {
  const mp = assessment.prediction_market_implied_probability;
  const tl = thesis.probability_low;
  const th = thesis.probability_high;

  const consensusColors = {
    aligned: 'border-emerald-500/30 bg-emerald-500/5',
    mildly_divergent: 'border-amber-500/30 bg-amber-500/5',
    strongly_divergent: 'border-red-500/30 bg-red-500/5',
    not_comparable: 'border-slate-700 bg-slate-800/30',
  };

  const consensusLabels = {
    aligned: 'ALIGNED',
    mildly_divergent: 'MILDLY DIVERGENT',
    strongly_divergent: 'STRONGLY DIVERGENT',
    not_comparable: 'NOT COMPARABLE',
  };

  const consensusTextColors = {
    aligned: 'text-emerald-400',
    mildly_divergent: 'text-amber-400',
    strongly_divergent: 'text-red-400',
    not_comparable: 'text-slate-500',
  };

  return (
    <div className={`rounded-lg border p-4 ${consensusColors[assessment.consensus_state]}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-slate-300">Consensus Comparison</h3>
        <span className={`text-xs font-bold ${consensusTextColors[assessment.consensus_state]}`}>
          {consensusLabels[assessment.consensus_state]}
        </span>
      </div>

      {/* Three-way comparison */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-slate-800/50 rounded p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">My Thesis</p>
          <p className="text-lg font-bold text-cyan-400">
            {(tl * 100).toFixed(0)}-{(th * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-slate-600">best: {(thesis.probability_best * 100).toFixed(0)}%</p>
        </div>
        <div className="bg-slate-800/50 rounded p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Prediction Market</p>
          <p className="text-lg font-bold text-purple-400">
            {mp != null ? `${(mp * 100).toFixed(0)}%` : 'N/A'}
          </p>
          {assessment.divergence_score != null && (
            <p className="text-xs text-slate-600">div: {(assessment.divergence_score * 100).toFixed(0)}pp</p>
          )}
        </div>
        <div className="bg-slate-800/50 rounded p-3 text-center">
          <p className="text-xs text-slate-500 mb-1">Market Pricing</p>
          <p className="text-sm text-slate-300 mt-1">
            {thesis.market_pricing_assessment?.gap_size || 'unknown'}
          </p>
          <p className="text-xs text-slate-600">
            implied: {thesis.market_pricing_assessment?.implied_prob
              ? `${(parseFloat(thesis.market_pricing_assessment.implied_prob) * 100).toFixed(0)}%`
              : '?'}
          </p>
        </div>
      </div>

      {/* Warnings */}
      <Warnings assessment={assessment} />

      {/* Interpretation */}
      {assessment.notes && (
        <div className="mt-3 text-xs text-slate-400 whitespace-pre-line border-t border-slate-700/50 pt-2">
          {assessment.notes}
        </div>
      )}
    </div>
  );
}

// ---- Warnings ----
function Warnings({ assessment }) {
  const warnings = [];
  if (assessment.wording_warning) {
    warnings.push({ type: 'wording', text: 'Contract wording does not closely match thesis. Comparison may be unreliable.', color: 'amber' });
  }
  if (assessment.liquidity_warning) {
    warnings.push({ type: 'liquidity', text: 'Thin market detected. Prediction market signal is weak.', color: 'amber' });
  }
  if (assessment.thin_market_penalty > 0.3) {
    warnings.push({ type: 'penalty', text: `Thin market penalty: ${(assessment.thin_market_penalty * 100).toFixed(0)}%. Confidence heavily reduced.`, color: 'amber' });
  }
  if (assessment.proxy_dominance_warning) {
    warnings.push({ type: 'proxy', text: 'Assessment driven primarily by proxy markets. Direct comparison unavailable. Do not treat as definitive.', color: 'red' });
  }

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((w, i) => {
        const colorClasses = w.color === 'red'
          ? 'text-red-400 bg-red-400/5 border-red-400/10'
          : 'text-amber-400 bg-amber-400/5 border-amber-400/10';
        return (
          <div key={i} className={`flex gap-2 items-start text-xs rounded px-2 py-1 border ${colorClasses}`}>
            <span className="font-bold shrink-0">WARNING:</span>
            <span>{w.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Linked Contract Card ----
function LinkedContractCard({ link, expanded, onToggle }) {
  const snapshot = link.latest_snapshot;
  const isStale = snapshot ? new Date(snapshot.observed_at) < new Date(Date.now() - 6 * 3600 * 1000) : true;
  const isExcluded = snapshot ? new Date(snapshot.observed_at) < new Date(Date.now() - 48 * 3600 * 1000) : true;

  return (
    <div className={`bg-slate-800/50 rounded border border-slate-700/30 overflow-hidden ${isExcluded ? 'opacity-50' : ''}`}>
      <div className="p-3 cursor-pointer hover:bg-slate-800/80" onClick={onToggle}>
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{link.event_title || 'Untitled market'}</p>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-slate-500">{link.provider_name}</span>
              <span className={linkTypeColor(link.link_type)}>{link.link_type.replace(/_/g, ' ')}</span>
              {link.event_status && <span className="text-slate-600">{link.event_status}</span>}
            </div>
          </div>
          <div className="text-right shrink-0 ml-3">
            {snapshot ? (
              <>
                <p className={`text-lg font-bold ${isExcluded ? 'text-slate-500 line-through' : 'text-purple-400'}`}>
                  {(snapshot.implied_probability * 100).toFixed(0)}%
                </p>
                <div className="flex gap-1 items-center">
                  {isExcluded && <span className="text-xs text-red-500">EXCLUDED</span>}
                  {isStale && !isExcluded && <span className="text-xs text-amber-400">STALE</span>}
                  {link.wording_mismatch_flag === 1 && <span className="text-xs text-red-400">MISMATCH</span>}
                </div>
              </>
            ) : (
              <span className="text-xs text-slate-600">No data</span>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/30 p-3 bg-slate-900/50">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Detail label="Link Type" value={link.link_type.replace(/_/g, ' ')} />
            <Detail label="Link Confidence" value={`${(link.link_confidence * 100).toFixed(0)}%`} />
            <Detail label="Wording Match" value={`${(link.wording_match_score * 100).toFixed(0)}%`}
              warn={link.wording_match_score < 0.3} />
            {snapshot && (
              <>
                <Detail label="Volume (24h)" value={snapshot.volume_24h != null ? `$${snapshot.volume_24h.toLocaleString()}` : 'N/A'} />
                <Detail label="Liquidity" value={snapshot.liquidity != null ? `$${snapshot.liquidity.toLocaleString()}` : 'N/A'}
                  warn={snapshot.liquidity != null && snapshot.liquidity < 10000} />
                <Detail label="Spread" value={snapshot.spread != null ? `${(snapshot.spread * 100).toFixed(1)}%` : 'N/A'} />
                <Detail label="Observed" value={snapshot.observed_at ? new Date(snapshot.observed_at).toLocaleString() : 'N/A'}
                  warn={isStale} />
              </>
            )}
          </div>
          {isExcluded && (
            <div className="mt-2 text-xs text-red-400 bg-red-400/5 rounded px-2 py-1 border border-red-400/10">
              Data older than 48h — excluded from aggregation entirely.
            </div>
          )}
          {link.rationale && (
            <div className="mt-2 text-xs text-slate-500">
              <span className="text-slate-600">Rationale:</span> {link.rationale}
            </div>
          )}
          {link.event_url && (
            <a href={link.event_url} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-cyan-400 hover:text-cyan-300">
              View on {link.provider_name}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, warn }) {
  return (
    <div>
      <span className="text-slate-600">{label}: </span>
      <span className={warn ? 'text-amber-400' : 'text-slate-300'}>{value}</span>
    </div>
  );
}

function linkTypeColor(type) {
  const colors = {
    direct_match: 'text-emerald-400',
    partial_match: 'text-cyan-400',
    proxy: 'text-amber-400',
    adjacent_signal: 'text-slate-400',
  };
  return colors[type] || 'text-slate-400';
}
