// ============================================================
// PREDICTION MARKET TYPES — Constants and validation
// ============================================================

export const LINK_TYPES = ['direct_match', 'partial_match', 'proxy', 'adjacent_signal'];

export const CONSENSUS_STATES = ['aligned', 'mildly_divergent', 'strongly_divergent', 'not_comparable'];

export const EVENT_STATUSES = ['open', 'closed', 'resolved', 'cancelled'];

export const MARKET_TYPES = ['binary', 'multiple_choice', 'scalar'];

// Staleness thresholds (graduated)
export const STALE_THRESHOLD_HOURS = 6;       // soft stale: reduced weight
export const VERY_STALE_THRESHOLD_HOURS = 24; // heavily reduced weight
export const EXCLUDED_THRESHOLD_HOURS = 48;   // hard cutoff: excluded entirely

// Thin market thresholds
export const THIN_MARKET_LIQUIDITY = 10000;   // USD
export const THIN_MARKET_VOLUME_24H = 5000;   // USD

// Divergence thresholds for consensus state
export const DIVERGENCE_ALIGNED = 0.10;          // < 10% = aligned
export const DIVERGENCE_MILDLY_DIVERGENT = 0.25; // 10-25% = mildly divergent
// > 25% = strongly divergent

// Wording match below this = not comparable
export const WORDING_MATCH_FLOOR = 0.3;

// Maximum scoring influence (bounded modifier for market_confirmation_divergence)
export const MAX_SCORING_MODIFIER = 2.0;

// Link type weight multipliers — mechanical enforcement of type separation
export const LINK_TYPE_WEIGHTS = {
  direct_match: 1.0,
  partial_match: 0.7,
  proxy: 0.4,
  adjacent_signal: 0.0,  // display only, never enters aggregation
};

// Minimum scorable contracts: need at least this many with weight > MIN_CONTRACT_WEIGHT
export const MIN_SCORABLE_CONTRACTS = 2;
export const MIN_CONTRACT_WEIGHT = 0.1;

// PM scoring confidence floor for score suggestion
export const PM_CONFIDENCE_FLOOR = 0.4;
