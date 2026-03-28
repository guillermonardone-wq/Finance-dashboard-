import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useThesisStore } from "../store/useThesisStore";
import { useSignalStore } from "../store/useSignalStore";
import { useThesisEvaluation } from "../hooks/useThesisEvaluation";

import ThesisHeader from "../components/thesis/ThesisHeader";
import ThesisOverviewTab from "../components/thesis/ThesisOverviewTab";
import ThesisEvidenceTab from "../components/thesis/ThesisEvidenceTab";
import ThesisScorecardTab from "../components/thesis/ThesisScorecardTab";
import ThesisAuditTab from "../components/thesis/ThesisAuditTab";
import PredictionMarketTab from "../components/PredictionMarketTab";
import AdvisoryTab from "../components/AdvisoryTab";
import ChecklistTab from "../components/thesis/ChecklistTab";
import ErrorBoundary from "../components/ErrorBoundary";

const TABS = [
  "Overview",
  "Evidence",
  "Prediction Markets",
  "LLM Review",
  "Scorecard",
  "Checklist",
  "Audit Log",
];

/**
 * ThesisDetail — Thin orchestrator for the thesis workspace.
 *
 * Responsibilities:
 * 1. Fetch thesis + linked signals by route param
 * 2. Drive evaluation via useThesisEvaluation hook
 * 3. Render tab navigation
 * 4. Delegate all rendering to focused tab components
 */
export default function ThesisDetail() {
  const { id } = useParams();
  const location = useLocation();
  const fromCluster = location.state?.fromCluster;
  const clusterTitle = location.state?.clusterTitle;
  const { activeThesis, fetchThesis, loading, error } = useThesisStore();
  const { signals, fetchSignals } = useSignalStore();
  const [tab, setTab] = useState("Overview");

  // Fetch thesis and its linked signals; clear stale signals immediately on ID change
  useEffect(() => {
    fetchSignals({ thesis_id: id });
    fetchThesis(id);
    return () => {
      // Clear signals when leaving this thesis — prevents stale data on next navigation
      useSignalStore.setState({ signals: [] });
    };
  }, [id, fetchThesis, fetchSignals]);

  // Evaluation hook — encapsulates scoring, re-scoring, and persistence
  const { evaluation, handleScoreUpdate, handleReScore } = useThesisEvaluation(
    id,
    activeThesis,
    signals,
  );

  // --- Loading / error / not-found states ---

  if (loading) {
    return <div className="p-6 text-slate-500">Loading thesis...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-400 bg-red-400/10 border border-red-400/20 rounded p-4">
          <p className="font-bold text-sm mb-1">Error loading thesis</p>
          <p className="text-sm">{error}</p>
          <Link
            to="/theses"
            className="text-xs text-cyan-400 hover:text-cyan-300 mt-3 inline-block"
          >
            Back to Theses
          </Link>
        </div>
      </div>
    );
  }

  if (!activeThesis) {
    return (
      <div className="p-6">
        <div className="text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded p-4">
          <p className="font-bold text-sm mb-1">Thesis not found</p>
          <p className="text-sm text-slate-400">ID: {id}</p>
          <Link
            to="/theses"
            className="text-xs text-cyan-400 hover:text-cyan-300 mt-3 inline-block"
          >
            Back to Theses
          </Link>
        </div>
      </div>
    );
  }

  const thesis = activeThesis;

  return (
    <div className="p-6 max-w-5xl">
      {/* From-cluster creation banner */}
      {fromCluster && (
        <div className="mb-4 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-3">
          <span className="text-emerald-400 text-sm">⚡</span>
          <div>
            <p className="text-sm text-emerald-400 font-medium">Created from Bot Feed cluster{clusterTitle ? `: ${clusterTitle}` : ''}</p>
            <p className="text-xs text-slate-500">Review and refine this draft. Signals are already linked.</p>
          </div>
        </div>
      )}

      {/* Header + score summary — always visible */}
      <ThesisHeader
        thesis={thesis}
        evaluation={evaluation}
        onReScore={handleReScore}
      />

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-slate-800 pb-px">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              tab === t
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
            {t === "Evidence" && signals.length > 0 && (
              <span className="ml-1.5 text-xs text-slate-600">
                {signals.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content — each tab wrapped in error boundary */}
      {tab === "Overview" && (
        <ErrorBoundary label="Overview">
          <ThesisOverviewTab
            thesis={thesis}
            signals={signals}
            evaluation={evaluation}
          />
        </ErrorBoundary>
      )}

      {tab === "Evidence" && (
        <ErrorBoundary label="Evidence">
          <ThesisEvidenceTab thesisId={id} signals={signals} />
        </ErrorBoundary>
      )}

      {tab === "Prediction Markets" && (
        <ErrorBoundary label="Prediction Markets">
          <PredictionMarketTab thesis={thesis} />
        </ErrorBoundary>
      )}

      {tab === "LLM Review" && (
        <ErrorBoundary label="LLM Review">
          <AdvisoryTab thesis={thesis} />
        </ErrorBoundary>
      )}

      {tab === "Scorecard" && (
        <ErrorBoundary label="Scorecard">
          <ThesisScorecardTab
            evaluation={evaluation}
            onScoreUpdate={handleScoreUpdate}
          />
        </ErrorBoundary>
      )}

      {tab === "Checklist" && (
        <ErrorBoundary label="Checklist">
          <ChecklistTab thesis={thesis} />
        </ErrorBoundary>
      )}

      {tab === "Audit Log" && (
        <ErrorBoundary label="Audit Log">
          <ThesisAuditTab thesis={thesis} />
        </ErrorBoundary>
      )}
    </div>
  );
}
