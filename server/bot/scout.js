// ============================================================
// SIGNAL SCOUT — Detects candidate signals from normalized inputs
// ============================================================
// The Scout is the entry point of the bot pipeline.
// It takes raw normalized data (signals, news, market observations)
// and produces CandidateSignal objects.
//
// Key behaviors:
// - deduplicate near-identical headlines
// - penalize dramatic language without operational content
// - penalize single-source signals
// - assign preliminary categories and urgency
// - mandatory source attribution
// ============================================================

import { validateCandidateSignal, SIGNAL_CATEGORIES } from "./types.js";

// Dramatic language patterns that inflate perceived importance
const DRAMATIC_PATTERNS = [
  /\bbreaking\b/i,
  /\bshocking\b/i,
  /\bunprecedented\b/i,
  /\bcrisis\b/i,
  /\bcollapse\b/i,
  /\bsurge\b/i,
  /\bplunge\b/i,
  /\bskyrocket\b/i,
  /\bexplode\b/i,
  /\bcrash\b/i,
  /\btumble\b/i,
  /\bsoar\b/i,
  /\bmassive\b/i,
  /\bhistoric\b/i,
  /\bbloodbath\b/i,
  /\bcatastroph/i,
  /\bdoomsday\b/i,
  /\bapocalyp/i,
];

// Category keyword mapping for auto-categorization
const CATEGORY_KEYWORDS = {
  geopolitical_escalation: [
    "geopolitical",
    "escalation",
    "conflict",
    "tensions",
    "confrontation",
    "diplomacy",
    "summit",
  ],
  military_mobilization: [
    "military",
    "troops",
    "deployment",
    "mobilization",
    "navy",
    "carrier",
    "missile",
    "strike",
    "defense",
    "army",
    "forces",
  ],
  commodity_chokepoint: [
    "chokepoint",
    "strait",
    "canal",
    "pipeline",
    "route",
    "passage",
    "hormuz",
    "suez",
    "malacca",
    "bosphorus",
  ],
  sanctions_risk: [
    "sanction",
    "embargo",
    "restriction",
    "blacklist",
    "ban",
    "tariff",
    "penalty",
  ],
  shipping_disruption: [
    "shipping",
    "tanker",
    "vessel",
    "maritime",
    "port",
    "freight",
    "cargo",
    "shipping lane",
  ],
  energy_bottleneck: [
    "energy",
    "oil",
    "gas",
    "lng",
    "crude",
    "opec",
    "refinery",
    "petroleum",
    "barrel",
  ],
  policy_shock: [
    "policy",
    "regulation",
    "legislation",
    "executive order",
    "reform",
    "deregulation",
  ],
  currency_instability: [
    "currency",
    "forex",
    "yen",
    "yuan",
    "euro",
    "dollar",
    "devaluation",
    "depreciation",
    "fx",
  ],
  market_complacency: [
    "complacency",
    "volatility low",
    "implied vol",
    "risk premium",
    "overvalued",
  ],
  central_bank_action: [
    "central bank",
    "fed",
    "ecb",
    "boj",
    "pboc",
    "rate decision",
    "interest rate",
    "quantitative",
    "tightening",
    "easing",
    "yield curve",
  ],
  election_political: [
    "election",
    "vote",
    "referendum",
    "parliament",
    "congress",
    "president",
    "prime minister",
  ],
  supply_chain: [
    "supply chain",
    "shortage",
    "inventory",
    "backlog",
    "logistics",
    "semiconductor",
  ],
  credit_stress: [
    "credit",
    "default",
    "spread",
    "cds",
    "downgrade",
    "bankruptcy",
    "distress",
    "debt",
  ],
  conflict_kinetic: [
    "attack",
    "bombing",
    "invasion",
    "war",
    "combat",
    "drone",
    "airstrike",
    "casualt",
  ],
};

// Geography extraction keywords
const GEOGRAPHY_KEYWORDS = {
  "Middle East": [
    "iran",
    "israel",
    "saudi",
    "gulf",
    "hormuz",
    "yemen",
    "houthi",
    "iraq",
    "syria",
    "lebanon",
  ],
  "East Asia": [
    "china",
    "japan",
    "taiwan",
    "korea",
    "boj",
    "pboc",
    "yen",
    "yuan",
  ],
  Europe: ["eu", "ecb", "germany", "france", "uk", "nato", "ukraine", "russia"],
  "North America": ["us", "fed", "canada", "mexico", "usmca"],
  "Southeast Asia": [
    "asean",
    "indonesia",
    "vietnam",
    "philippines",
    "malacca",
    "singapore",
  ],
  Africa: ["africa", "nigeria", "south africa", "congo", "sahel"],
  "South America": ["brazil", "argentina", "venezuela", "chile"],
  "Central Asia": ["kazakhstan", "uzbekistan", "turkmenistan", "caspian"],
};

// Market symbol suggestions based on keywords
const SYMBOL_KEYWORDS = {
  CL: ["oil", "crude", "wti", "petroleum", "opec", "barrel"],
  NG: ["natural gas", "lng", "gas pipeline"],
  GC: ["gold", "precious metal", "safe haven"],
  DX: ["dollar", "usd", "greenback"],
  "USD/JPY": ["yen", "boj", "japan", "carry trade"],
  "EUR/USD": ["euro", "ecb", "eurozone"],
  SPY: ["s&p", "equity", "stock market", "wall street"],
  TLT: ["treasury", "bond", "yield", "duration"],
  VIX: ["volatility", "vix", "fear", "complacency"],
  EEM: ["emerging market", "em", "developing"],
  USO: ["oil etf", "crude oil"],
  XLE: ["energy sector", "energy stocks"],
};

/**
 * Process a batch of raw signals/news/observations into CandidateSignals.
 * @param {Array} rawInputs - Array of { type, data } from signals/news/market_observations
 * @returns {{ candidates: Array, duplicates_removed: number, penalties_applied: number }}
 */
export function scoutSignals(rawInputs) {
  const candidates = [];
  const seenTitles = new Map(); // for deduplication
  let duplicates_removed = 0;
  let penalties_applied = 0;

  for (const input of rawInputs) {
    const candidate = processInput(input);
    if (!candidate) continue;

    // Deduplication: check title similarity
    const normalizedTitle = normalizeForDedup(candidate.title);
    if (seenTitles.has(normalizedTitle)) {
      duplicates_removed++;
      // Merge into existing — increase source count but don't create duplicate
      const existing = seenTitles.get(normalizedTitle);
      existing.source_refs = [
        ...new Set([...existing.source_refs, ...candidate.source_refs]),
      ];
      continue;
    }

    // Apply penalties
    const penalties = [];

    // Dramatic language check
    const dramaticCount = DRAMATIC_PATTERNS.filter((p) =>
      p.test(candidate.title + " " + candidate.summary),
    ).length;
    if (dramaticCount >= 2) {
      penalties.push({
        id: "dramatic_language",
        severity: Math.min(0.3, dramaticCount * 0.08),
        reason: `${dramaticCount} dramatic language markers detected. Dramatic ≠ operationally significant.`,
      });
      candidate.novelty_score = Math.max(
        0,
        (candidate.novelty_score || 0.5) - dramaticCount * 0.05,
      );
      penalties_applied++;
    }

    // Single source check
    if (candidate.source_refs.length <= 1) {
      penalties.push({
        id: "single_source",
        severity: 0.2,
        reason: "Only one source. Cannot verify independently.",
      });
      penalties_applied++;
    }

    // Missing attribution
    if (!candidate.source_refs.some((s) => s.attribution)) {
      penalties.push({
        id: "no_attribution",
        severity: 0.1,
        reason: "No source attribution. Cannot assess reliability.",
      });
      penalties_applied++;
    }

    candidate.penalties = penalties;
    seenTitles.set(normalizedTitle, candidate);
    candidates.push(candidate);
  }

  // Validate all candidates
  const validated = candidates.map((c) => {
    const result = validateCandidateSignal(c);
    return result.normalized;
  });

  return {
    candidates: validated,
    duplicates_removed,
    penalties_applied,
    total_processed: rawInputs.length,
  };
}

function processInput(input) {
  const { type, data } = input;

  if (!data) return null;

  let candidate = {
    title: "",
    summary: "",
    detected_at: new Date().toISOString(),
    source_refs: [],
    entities: [],
    geographies: [],
    categories: [],
    novelty_score: 0.5,
    urgency_score: "medium",
    confidence_range: { low: 0.2, high: 0.6, best: 0.4 },
    linked_market_symbols: [],
    linked_macro_series: [],
    notes: "",
  };

  switch (type) {
    case "signal":
      candidate.title = data.title || "";
      candidate.summary = data.description || "";
      candidate.detected_at = data.created_at || new Date().toISOString();
      candidate.source_refs = [
        {
          type: data.source_type,
          attribution: data.source_attribution,
          url: data.source_url,
        },
      ];
      candidate.categories = data.category ? [data.category] : [];
      candidate.novelty_score =
        data.novelty === "new"
          ? 0.8
          : data.novelty === "developing"
            ? 0.6
            : 0.3;
      candidate.confidence_range = {
        low: Math.max(0, (data.signal_strength || 0.5) - 0.2),
        high: Math.min(1, (data.signal_strength || 0.5) + 0.2),
        best: data.signal_strength || 0.5,
      };
      break;

    case "news":
      candidate.title = data.title || data.headline || "";
      candidate.summary = data.description || data.summary || "";
      candidate.detected_at =
        data.publishedAt || data.published_at || new Date().toISOString();
      candidate.source_refs = [
        {
          type: "news_feed",
          attribution:
            data.source_attribution ||
            data.source ||
            data.source_name ||
            "Unknown",
          url: data.url,
        },
      ];
      if (data.symbols) candidate.linked_market_symbols = data.symbols;
      break;

    case "market_observation":
      if (data.observation_type === "news") {
        const payload =
          typeof data.data === "string" ? JSON.parse(data.data) : data.data;
        candidate.title = payload.title || data.name || "";
        candidate.summary = payload.description || "";
        candidate.source_refs = [
          {
            type: "market_data",
            attribution: data.source_attribution || data.provider,
          },
        ];
      } else {
        return null; // only news-type observations become candidate signals
      }
      break;

    default:
      return null;
  }

  if (!candidate.title) return null;

  // Auto-categorize from content
  const text = (candidate.title + " " + candidate.summary).toLowerCase();
  if (candidate.categories.length === 0) {
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        candidate.categories.push(cat);
      }
    }
    if (candidate.categories.length === 0) candidate.categories = ["other"];
  }

  // Extract geographies
  for (const [geo, keywords] of Object.entries(GEOGRAPHY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      candidate.geographies.push(geo);
    }
  }

  // Suggest linked market symbols
  if (candidate.linked_market_symbols.length === 0) {
    for (const [symbol, keywords] of Object.entries(SYMBOL_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) {
        candidate.linked_market_symbols.push(symbol);
      }
    }
  }

  // Urgency estimation
  const urgencyKeywords = {
    critical: [
      "breaking",
      "imminent",
      "emergency",
      "immediate",
      "attack underway",
    ],
    high: ["escalation", "strike", "missile", "mobiliz", "invasion", "default"],
    medium: ["tension", "concern", "warning", "risk", "pressure"],
  };
  for (const [level, keywords] of Object.entries(urgencyKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      candidate.urgency_score = level;
      break;
    }
  }

  return candidate;
}

function normalizeForDedup(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .sort()
    .join(" ");
}
