// Simple formatting helpers used across the UI

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function usd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function timeUntil(date: Date | null): string {
  if (!date) return "No end date";
  const now = new Date();
  const ms = new Date(date).getTime() - now.getTime();
  if (ms < 0) return "Ended";
  const days = Math.floor(ms / 86_400_000);
  if (days > 30) return `${Math.floor(days / 30)}mo`;
  if (days > 0) return `${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  return `${hours}h`;
}

export function scoreColor(score: number): string {
  if (score >= 70) return "text-red-400";
  if (score >= 40) return "text-yellow-400";
  return "text-green-400";
}

export function scoreBg(score: number): string {
  if (score >= 70) return "bg-red-500/20 border-red-500/40";
  if (score >= 40) return "bg-yellow-500/20 border-yellow-500/40";
  return "bg-green-500/20 border-green-500/40";
}
