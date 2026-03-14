// Card for a cluster shown in the clusters list
"use client";

import { pct, scoreColor, scoreBg } from "@/lib/format";

interface Props {
  id: string;
  name: string;
  description: string;
  theme: string;
  avgProbability: number;
  probabilityDispersion: number;
  inconsistencyScore: number;
  divergenceScore: number;
  confidenceScore: number;
  marketCount: number;
  signalCount: number;
}

export default function ClusterCard(props: Props) {
  const {
    id,
    name,
    description,
    theme,
    avgProbability,
    inconsistencyScore,
    divergenceScore,
    confidenceScore,
    marketCount,
    signalCount,
  } = props;

  return (
    <a
      href={`/clusters/${id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-indigo-500/50 transition group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[11px] font-medium uppercase tracking-wider text-indigo-400 mb-1">
            {theme}
          </span>
          <h3 className="text-sm font-semibold leading-snug group-hover:text-white transition">
            {name}
          </h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{description}</p>
        </div>
        <div
          className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-lg border text-sm font-bold ${scoreBg(divergenceScore)} ${scoreColor(divergenceScore)}`}
          title="Divergence score"
        >
          {divergenceScore}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2 text-center text-[11px] text-gray-400">
        <div>
          <div className="text-gray-500 mb-0.5">Markets</div>
          <div className="font-medium text-gray-300">{marketCount}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Avg Prob</div>
          <div className="font-medium text-gray-300">{pct(avgProbability)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Inconsist.</div>
          <div className={`font-medium ${scoreColor(inconsistencyScore)}`}>
            {inconsistencyScore}
          </div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Confidence</div>
          <div className="font-medium text-gray-300">{confidenceScore}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Signals</div>
          <div className={`font-medium ${signalCount > 0 ? "text-yellow-400" : "text-gray-500"}`}>
            {signalCount}
          </div>
        </div>
      </div>
    </a>
  );
}
