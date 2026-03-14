// Research expression card — shows a thesis idea with rationale, risk, and invalidation
"use client";

import type { Expression } from "@/lib/types";

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  direct: { label: "Direct", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  conservative: { label: "Conservative", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  convex: { label: "Convex", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
  hedge: { label: "Hedge", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
};

export default function ExpressionCard({ expression }: { expression: Expression }) {
  const style = TYPE_STYLES[expression.type] ?? TYPE_STYLES.direct;

  return (
    <div className={`rounded-xl border p-4 ${style.color}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          {style.label}
        </span>
      </div>
      <h4 className="text-sm font-semibold mb-2">{expression.title}</h4>
      <div className="space-y-2 text-xs leading-relaxed opacity-85">
        <div>
          <span className="font-medium opacity-70">Rationale: </span>
          {expression.rationale}
        </div>
        <div>
          <span className="font-medium opacity-70">Main risk: </span>
          {expression.mainRisk}
        </div>
        <div>
          <span className="font-medium opacity-70">Invalidation: </span>
          {expression.invalidation}
        </div>
      </div>
    </div>
  );
}
