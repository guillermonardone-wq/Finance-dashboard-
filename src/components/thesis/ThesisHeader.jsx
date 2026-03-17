import { Link } from "react-router-dom";
import {
  ClassificationBadge,
  CompositeScoreBar,
  LayerScoreSummary,
  ConfidenceIndicator,
} from "../common/ScoreDisplay";

export default function ThesisHeader({ thesis, evaluation, onReScore }) {
  return (
    <div className="mb-6">
      <Link
        to="/theses"
        className="text-xs text-slate-500 hover:text-slate-400 mb-2 block"
      >
        All Theses
      </Link>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 mr-4">
          <h1 className="text-xl font-bold text-slate-100">{thesis.title}</h1>
          <p className="text-sm text-slate-400 mt-1 line-clamp-3">
            {thesis.thesis_statement}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ClassificationBadge classification={thesis.classification} />
          {thesis.status === "quarantined" && (
            <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded px-2 py-1">
              QUARANTINED
            </span>
          )}
        </div>
      </div>

      {/* Score summary bar — always visible for fast-mode glancability */}
      {evaluation && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mt-4">
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Composite Score</span>
                <span>
                  {evaluation.scoreResult.composite}/100 (completeness:{" "}
                  {evaluation.scoreResult.completeness}%)
                </span>
              </div>
              <CompositeScoreBar score={evaluation.scoreResult.composite} />
              <div className="mt-3">
                <LayerScoreSummary layers={evaluation.layers} />
              </div>
              <div className="mt-2">
                <ConfidenceIndicator confidence={evaluation.confidence} />
              </div>
            </div>
            <button
              onClick={onReScore}
              className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-slate-700"
            >
              Re-score
            </button>
          </div>

          {evaluation.penalties.total > 0 && (
            <div className="mt-3 bg-red-950/20 border border-red-900/30 rounded p-2">
              <span className="text-xs text-red-400 font-bold">
                Penalties: -{evaluation.penalties.total}
              </span>
            </div>
          )}

          {evaluation.classification.overrideActive && (
            <div className="mt-3 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded p-2">
              FORCED DOWNGRADE: Score alone would classify as{" "}
              {evaluation.classification.scoreClassification}, but downgrades
              active.
              {evaluation.classification.downgrades.map((d, i) => (
                <div key={i} className="mt-1 text-amber-300">
                  {d.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
