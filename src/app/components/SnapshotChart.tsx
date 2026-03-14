// Simple ASCII-style probability chart using pure CSS bars
// (No charting library needed for Phase 1)
"use client";

import { pct } from "@/lib/format";

interface Snapshot {
  yesPrice: number;
  capturedAt: string;
}

interface Props {
  snapshots: Snapshot[];
}

export default function SnapshotChart({ snapshots }: Props) {
  // Show most recent first, reversed so left=oldest
  const data = [...snapshots].reverse().slice(-20);

  if (data.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        No snapshot data yet.
      </div>
    );
  }

  const min = Math.min(...data.map((d) => d.yesPrice));
  const max = Math.max(...data.map((d) => d.yesPrice));
  const range = max - min || 0.01;

  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {data.map((snap, i) => {
          const height = ((snap.yesPrice - min) / range) * 100;
          return (
            <div
              key={i}
              className="flex-1 group relative"
              title={`${pct(snap.yesPrice)} at ${new Date(snap.capturedAt).toLocaleString()}`}
            >
              <div
                className="w-full bg-indigo-500/60 rounded-t hover:bg-indigo-400 transition"
                style={{ height: `${Math.max(4, height)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
        <span>{pct(min)}</span>
        <span>YES price over time</span>
        <span>{pct(max)}</span>
      </div>
    </div>
  );
}
