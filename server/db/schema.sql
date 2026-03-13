-- ============================================================
-- MACRO DECISION ENGINE — SQLite Schema
-- Single-user, local-first, decision-quality-optimized
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- SIGNALS: Raw observations from any source
-- ============================================================
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'geopolitical_escalation', 'military_mobilization', 'commodity_chokepoint',
    'sanctions_risk', 'shipping_disruption', 'energy_bottleneck',
    'policy_shock', 'currency_instability', 'market_complacency',
    'central_bank_action', 'election_political', 'supply_chain',
    'technology_disruption', 'credit_stress', 'other'
  )),
  subcategory TEXT,

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  raw_source TEXT,               -- original text/link
  source_type TEXT NOT NULL CHECK (source_type IN (
    'manual', 'news_feed', 'market_data', 'social', 'government',
    'satellite', 'shipping', 'analyst', 'other'
  )),
  source_provider TEXT,          -- which data provider surfaced this
  source_url TEXT,
  source_attribution TEXT,       -- human-readable attribution

  -- Assessment
  novelty TEXT NOT NULL DEFAULT 'unknown' CHECK (novelty IN ('new', 'developing', 'known', 'stale', 'unknown')),
  reliability TEXT NOT NULL DEFAULT 'unverified' CHECK (reliability IN ('verified', 'likely', 'unverified', 'disputed', 'false')),
  signal_strength REAL CHECK (signal_strength BETWEEN 0 AND 1),

  -- Linkage
  thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
  related_signal_ids TEXT,       -- JSON array of related signal IDs

  -- Status
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'reviewing', 'linked', 'noise', 'archived')),
  tags TEXT                      -- JSON array of string tags
);

-- ============================================================
-- THESES: Structured macro views
-- ============================================================
CREATE TABLE IF NOT EXISTS theses (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Core thesis
  title TEXT NOT NULL,
  thesis_statement TEXT NOT NULL,
  causal_chain TEXT NOT NULL,          -- JSON array of causal steps
  affected_assets TEXT NOT NULL,       -- JSON array of {asset, direction, mechanism}
  expected_timeline TEXT NOT NULL,     -- JSON: {start, end, basis}

  -- Probability & pricing
  probability_low REAL NOT NULL CHECK (probability_low BETWEEN 0 AND 1),
  probability_high REAL NOT NULL CHECK (probability_high BETWEEN 0 AND 1),
  probability_best REAL NOT NULL CHECK (probability_best BETWEEN 0 AND 1),
  market_pricing_assessment TEXT NOT NULL, -- JSON: {description, implied_prob, gap_size}
  key_assumptions TEXT NOT NULL,       -- JSON array of strings
  alternative_explanations TEXT NOT NULL, -- JSON array of strings

  -- Evidence
  leading_indicators TEXT,             -- JSON array of {indicator, current_state, target_state}
  confirming_indicators TEXT,          -- JSON array
  invalidating_indicators TEXT,        -- JSON array
  coincident_indicators TEXT,          -- JSON array
  lagging_indicators TEXT,             -- JSON array

  -- Disconfirmation (MANDATORY)
  disconfirming_evidence TEXT NOT NULL, -- JSON array of counter-evidence
  strongest_bear_case TEXT NOT NULL,
  what_would_make_opposite_stronger TEXT NOT NULL,
  early_vs_right TEXT,                 -- "what evidence shows I'm early, not right?"

  -- Scoring (computed by engine)
  score_signal_quality REAL,
  score_signal_independence REAL,
  score_market_mispricing REAL,
  score_causal_clarity REAL,
  score_catalyst_visibility REAL,
  score_timing_precision REAL,
  score_expression_quality REAL,
  score_risk_containment REAL,
  score_disconfirmation_robustness REAL,
  score_emotional_neutrality REAL,
  composite_score REAL,

  -- Classification
  classification TEXT NOT NULL DEFAULT 'WATCH' CHECK (classification IN (
    'IGNORE', 'WATCH', 'DEVELOP', 'PAPER_TRADE', 'SMALL_POSITION', 'FULLY_QUALIFIED'
  )),
  classification_reason TEXT,          -- why engine classified this way
  previous_classifications TEXT,       -- JSON array of {date, classification, reason}

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft', 'active', 'quarantined', 'approved', 'executing', 'closed', 'invalidated', 'archived'
  )),
  quarantine_reason TEXT,
  quarantine_until TEXT,               -- datetime: "sleep on it" delay

  tags TEXT
);

-- ============================================================
-- EXECUTION PLANS: How to express a thesis
-- ============================================================
CREATE TABLE IF NOT EXISTS execution_plans (
  id TEXT PRIMARY KEY,
  thesis_id TEXT NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Vehicle
  expression_vehicle TEXT NOT NULL,    -- e.g., "long CL futures", "buy OTM puts on XYZ"
  asset_symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'spread', 'hedge')),

  -- Sizing
  max_risk_dollars REAL,
  max_risk_percent REAL,
  position_size_units REAL,
  position_size_notional REAL,
  sizing_rationale TEXT,

  -- Entry / Exit
  entry_logic TEXT NOT NULL,           -- description of when to enter
  entry_price_target REAL,
  stop_loss REAL,
  take_profit_1 REAL,
  take_profit_2 REAL,
  exit_logic TEXT NOT NULL,
  time_stop TEXT,                      -- auto-exit date if thesis hasn't played out
  invalidation_condition TEXT NOT NULL,

  -- Gate status
  gate_passed INTEGER NOT NULL DEFAULT 0,
  gate_results TEXT,                   -- JSON: full checklist results
  gate_passed_at TEXT,

  -- Execution
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_gate', 'approved', 'executing', 'partially_filled',
    'filled', 'closed', 'cancelled', 'invalidated'
  )),
  execution_notes TEXT
);

-- ============================================================
-- CHECKLIST RESULTS: Pre-trade gate evaluations
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_results (
  id TEXT PRIMARY KEY,
  execution_plan_id TEXT NOT NULL REFERENCES execution_plans(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Individual gate checks (1 = passed, 0 = failed, NULL = skipped)
  gate_min_confirming_signals INTEGER,
  gate_confirming_signal_count INTEGER,
  gate_disconfirming_case_written INTEGER,
  gate_time_horizon_defined INTEGER,
  gate_invalidation_defined INTEGER,
  gate_max_risk_set INTEGER,
  gate_expression_vehicle_defined INTEGER,
  gate_entry_logic_defined INTEGER,
  gate_exit_logic_defined INTEGER,
  gate_position_sizing_rule INTEGER,
  gate_emotional_state_check TEXT CHECK (gate_emotional_state_check IN (
    'calm', 'excited', 'anxious', 'fearful', 'revenge', 'fomo', 'bored'
  )),
  gate_emotional_state_passed INTEGER,
  gate_sleep_on_it INTEGER,            -- did mandatory delay pass?
  gate_sleep_on_it_until TEXT,
  gate_confidence_vs_evidence INTEGER, -- is confidence justified by evidence quality?
  gate_not_narrative_attached INTEGER,
  gate_asymmetry_confirmed INTEGER,

  -- Overall
  total_gates INTEGER NOT NULL,
  gates_passed INTEGER NOT NULL,
  gates_failed INTEGER NOT NULL,
  overall_passed INTEGER NOT NULL DEFAULT 0,
  failure_reasons TEXT,                -- JSON array of why it failed
  override_requested INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  override_approved INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TRADES: Actual positions taken
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  execution_plan_id TEXT NOT NULL REFERENCES execution_plans(id),
  thesis_id TEXT NOT NULL REFERENCES theses(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Position
  asset_symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price REAL NOT NULL,
  entry_date TEXT NOT NULL,
  size_units REAL NOT NULL,
  size_notional REAL NOT NULL,

  -- Current state
  current_price REAL,
  unrealized_pnl REAL,
  unrealized_pnl_percent REAL,

  -- Close
  exit_price REAL,
  exit_date TEXT,
  realized_pnl REAL,
  realized_pnl_percent REAL,

  -- Meta
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'partially_closed', 'closed', 'stopped_out', 'time_stopped', 'invalidated'
  )),
  close_reason TEXT,
  notes TEXT
);

-- ============================================================
-- REVIEWS: Post-mortem analysis
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  thesis_id TEXT NOT NULL REFERENCES theses(id),
  trade_id TEXT REFERENCES trades(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Outcome
  outcome TEXT NOT NULL CHECK (outcome IN (
    'correct_right_reason', 'correct_wrong_reason', 'correct_lucky',
    'incorrect_bad_thesis', 'incorrect_bad_execution', 'incorrect_bad_timing',
    'mixed', 'too_early_to_tell'
  )),
  outcome_description TEXT NOT NULL,

  -- Signal review
  signals_that_mattered TEXT,          -- JSON array
  signals_that_were_noise TEXT,        -- JSON array
  signals_missed TEXT,                 -- JSON array

  -- Process review
  process_followed INTEGER NOT NULL,   -- 0 or 1
  process_violations TEXT,             -- JSON array of what was broken
  sizing_appropriate INTEGER,
  timing_appropriate INTEGER,
  early_confirmation_accurate INTEGER,

  -- Behavioral review
  emotional_state_during TEXT,
  overconfidence_detected INTEGER,
  narrative_attachment_detected INTEGER,
  confirmation_bias_detected INTEGER,

  -- Lessons
  lessons_learned TEXT NOT NULL,       -- free text
  playbook_additions TEXT,             -- JSON: what to add to the playbook
  rule_changes TEXT,                   -- JSON: suggested rule modifications

  -- Scores
  process_score REAL CHECK (process_score BETWEEN 0 AND 10),
  analysis_score REAL CHECK (analysis_score BETWEEN 0 AND 10),
  execution_score REAL CHECK (execution_score BETWEEN 0 AND 10),
  overall_score REAL CHECK (overall_score BETWEEN 0 AND 10)
);

-- ============================================================
-- PLAYBOOK: Reusable patterns and rules
-- ============================================================
CREATE TABLE IF NOT EXISTS playbook_entries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  title TEXT NOT NULL,
  category TEXT NOT NULL,              -- e.g., "energy_chokepoint", "sanctions_escalation"
  pattern_description TEXT NOT NULL,
  trigger_conditions TEXT NOT NULL,    -- JSON array
  typical_assets TEXT NOT NULL,        -- JSON array
  typical_timeline TEXT,
  historical_examples TEXT,            -- JSON array
  success_rate_estimate REAL,
  key_lessons TEXT,                    -- JSON array
  common_mistakes TEXT,                -- JSON array
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired', 'draft'))
);

-- ============================================================
-- MARKET OBSERVATIONS: Normalized market data snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS market_observations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Source tracking (FIRST-CLASS)
  provider TEXT NOT NULL,              -- which provider adapter
  provider_raw_id TEXT,                -- provider's own ID for this data
  source_attribution TEXT NOT NULL,    -- e.g., "Alpha Vantage - Daily Prices"
  fetched_at TEXT NOT NULL,

  -- Normalized data
  observation_type TEXT NOT NULL CHECK (observation_type IN (
    'price', 'candle', 'macro_series', 'macro_event', 'news',
    'sentiment', 'volatility', 'flow', 'positioning', 'calendar_event'
  )),
  symbol TEXT,                         -- ticker/series identifier
  name TEXT,                           -- human-readable name
  data TEXT NOT NULL,                  -- JSON: normalized payload per type
  metadata TEXT,                       -- JSON: provider-specific extras

  -- Linkage
  thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
  signal_id TEXT REFERENCES signals(id) ON DELETE SET NULL
);

-- ============================================================
-- PROVIDER CACHE: Rate-limit-friendly caching
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_signals_category ON signals(category);
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_thesis ON signals(thesis_id);
CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at);

CREATE INDEX IF NOT EXISTS idx_theses_status ON theses(status);
CREATE INDEX IF NOT EXISTS idx_theses_classification ON theses(classification);
CREATE INDEX IF NOT EXISTS idx_theses_score ON theses(composite_score);

CREATE INDEX IF NOT EXISTS idx_exec_plans_thesis ON execution_plans(thesis_id);
CREATE INDEX IF NOT EXISTS idx_exec_plans_status ON execution_plans(status);

CREATE INDEX IF NOT EXISTS idx_trades_thesis ON trades(thesis_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

CREATE INDEX IF NOT EXISTS idx_reviews_thesis ON reviews(thesis_id);

CREATE INDEX IF NOT EXISTS idx_market_obs_type ON market_observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_market_obs_symbol ON market_observations(symbol);
CREATE INDEX IF NOT EXISTS idx_market_obs_provider ON market_observations(provider);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON provider_cache(expires_at);
