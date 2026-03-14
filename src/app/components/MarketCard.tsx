// Reusable card shown in market lists (home page + flagged page)
"use client";

import { pct, usd, timeUntil, scoreColor, scoreBg } from "@/lib/format";

interface Props {
  id: string;
  title: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  spread: number;
  volume24h: number;
  liquidity: number;
  resolutionDate: string | null;
  dislocationScore: number;
}

export default function MarketCard(props: Props) {
  const {
    id,
    title,
    category,
    yesPrice,
    noPrice,
    spread,
    volume24h,
    liquidity,
    resolutionDate,
    dislocationScore,
  } = props;

  return (
    <a
      href={`/markets/${id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900 p-5 hover:border-indigo-500/50 transition group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[11px] font-medium uppercase tracking-wider text-indigo-400 mb-1">
            {category}
          </span>
          <h3 className="text-sm font-semibold leading-snug group-hover:text-white transition line-clamp-2">
            {title}
          </h3>
        </div>
        <div
          className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-lg border text-sm font-bold ${scoreBg(dislocationScore)} ${scoreColor(dislocationScore)}`}
        >
          {dislocationScore}
        </div>
      </div>

      {/* Prices */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg bg-green-500/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-green-400/70 mb-0.5">
            Yes
          </div>
          <div className="text-lg font-bold text-green-400">{pct(yesPrice)}</div>
        </div>
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-red-400/70 mb-0.5">
            No
          </div>
          <div className="text-lg font-bold text-red-400">{pct(noPrice)}</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center text-[11px] text-gray-400">
        <div>
          <div className="text-gray-500 mb-0.5">Spread</div>
          <div className="font-medium text-gray-300">{pct(spread)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Vol 24h</div>
          <div className="font-medium text-gray-300">{usd(volume24h)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Liq</div>
          <div className="font-medium text-gray-300">{usd(liquidity)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-0.5">Resolves</div>
          <div className="font-medium text-gray-300">
            {timeUntil(resolutionDate ? new Date(resolutionDate) : null)}
          </div>
        </div>
      </div>
    </a>
  );
}
