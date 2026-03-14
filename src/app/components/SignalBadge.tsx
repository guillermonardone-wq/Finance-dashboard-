// Badge for displaying a cluster signal with severity color
"use client";

interface Props {
  type: string;
  severity: string;
  message: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 border-red-500/30 text-red-400",
  medium: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
  low: "bg-blue-500/15 border-blue-500/30 text-blue-400",
};

const TYPE_LABELS: Record<string, string> = {
  disagreement: "Disagreement",
  reprice_lag: "Reprice Lag",
  thin_liquidity: "Thin Liquidity",
  unusual_activity: "Unusual Activity",
};

export default function SignalBadge({ type, severity, message }: Props) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low;
  const label = TYPE_LABELS[type] ?? type;

  return (
    <div className={`rounded-lg border p-3 ${style}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-wider opacity-50">
          {severity}
        </span>
      </div>
      <p className="text-xs leading-relaxed opacity-90">{message}</p>
    </div>
  );
}
