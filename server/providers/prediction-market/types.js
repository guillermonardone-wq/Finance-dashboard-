// ============================================================
// PREDICTION MARKET TYPES — Constants and validation
// ============================================================

export const LINK_TYPES = ['direct_match', 'partial_match', 'proxy', 'adjacent_signal'];

export const CONSENSUS_STATES = ['aligned', 'mildly_divergent', 'strongly_divergent', 'not_comparable'];

export const EVENT_STATUSES = ['open', 'closed', 'resolved', 'cancelled'];

export const MARKET_TYPES = ['binary', 'multiple_choice', 'scalar'];

// Staleness threshold: snapshots older than this are considered stale
export const STALE_THRESHOLD_HOURS = 6;

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
