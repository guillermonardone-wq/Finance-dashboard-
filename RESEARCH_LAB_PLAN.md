# Research Lab — Architecture Plan

## A. Research Lab Architecture

### Principle: Isolation with Reuse

The Research Lab is a **parallel decision environment** that imports the live engine's
pure functions but never touches live data. All simulation state lives in dedicated
tables prefixed with `research_`. The Lab cannot write to `signals`, `theses`, `trades`,
or any live table. The live engine cannot read `research_` tables.

```
┌─────────────────────────────────────────────────────────┐
│                     RESEARCH LAB                        │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Historical   │  │   Snapshot   │  │  Walk-Forward │  │
│  │  Dataset Mgr  │  │   Engine     │  │  Simulator    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         ▼                 ▼                  ▼          │
│  ┌─────────────────────────────────────────────────┐   │
│  │           research_* tables (SQLite)             │   │
│  │  research_datasets     research_snapshots        │   │
│  │  research_scenarios    research_runs             │   │
│  │  research_results      research_benchmarks       │   │
│  └─────────────────────────────────────────────────┘   │
│         │                                               │
│         │  IMPORTS (read-only, pure functions)           │
│         ▼                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  src/engine/scoring.js    (computeCompositeScore) │   │
│  │  src/engine/gates.js      (runGates)              │   │
│  │  src/engine/classification.js (classifyThesis)    │   │
│  │  src/engine/behavioral.js (runChecklist)          │   │
│  │  server/bot/governor.js   (runGovernor)           │   │
│  │  server/bot/scout.js      (scoutSignals)          │   │
│  │  server/bot/clusterer.js  (clusterSignals)        │   │
│  │  server/bot/pattern-matcher.js (matchPatterns)    │   │
│  │  server/bot/red-team.js   (generateCounterCase)   │   │
│  │  server/bot/mispricing.js (assessMispricing)      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  NEVER reads/writes: signals, theses, trades, reviews   │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
server/
  research/
    schema.sql              # Research Lab tables (research_* prefix)
    datasets.js             # Historical dataset CRUD + import
    snapshots.js            # Point-in-time snapshot generation
    simulator.js            # Walk-forward simulation engine
    replayer.js             # Event replay engine
    backtester.js           # Rule backtest engine
    benchmarks.js           # Benchmark comparison + scoring
    bias-guard.js           # Lookahead bias prevention
  routes/
    research.js             # All /api/research/* endpoints

src/
  pages/
    ResearchLab.jsx         # Lab dashboard (entry point)
    ResearchDatasets.jsx     # Dataset management
    ResearchSimulator.jsx    # Walk-forward simulation UI
    ResearchReplay.jsx       # Event replay UI
    ResearchBacktest.jsx     # Rule backtest UI
    ResearchResults.jsx      # Results browser + benchmark comparison
```

### Isolation Boundaries

| Boundary | Enforcement |
|---|---|
| Data isolation | Research tables use `research_` prefix. Research services import `getDb()` but only query `research_*` tables. |
| Logic reuse | Engine functions imported as pure functions. No side effects. No DB writes from engine layer. |
| Temporal isolation | Snapshot engine freezes state at a wall-clock cutoff. Simulator sees ONLY data with `timestamp <= cutoff`. |
| Write isolation | Research routes only write to `research_*` tables. No mutation of live `signals`, `theses`, `trades`. |
| Store isolation | Frontend uses a dedicated `useResearchStore.js` — never mixes with `useThesisStore`. |

---

## B. Historical Domain Model

### research_datasets

A dataset is a curated collection of historical signals, market observations, and
known outcomes for a specific time window. Datasets are the raw material for all
simulation types.

```sql
CREATE TABLE research_datasets (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),

  -- Identity
  name          TEXT NOT NULL,
  description   TEXT,
  tags          TEXT, -- JSON array

  -- Time window
  period_start  TEXT NOT NULL,  -- ISO date
  period_end    TEXT NOT NULL,  -- ISO date

  -- Contents (JSON arrays of normalized objects)
  signals       TEXT NOT NULL DEFAULT '[]',  -- Array of signal objects
  market_obs    TEXT NOT NULL DEFAULT '[]',  -- Array of market observation objects
  known_outcomes TEXT NOT NULL DEFAULT '[]', -- Array of outcome objects (what actually happened)

  -- Metadata
  signal_count      INTEGER NOT NULL DEFAULT 0,
  observation_count INTEGER NOT NULL DEFAULT 0,
  outcome_count     INTEGER NOT NULL DEFAULT 0,
  source_notes      TEXT,  -- Where this data came from

  status        TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'archived'))
);
```

### Signal Object Shape (within dataset)

Each signal in `research_datasets.signals` follows the live signal schema but adds
a `known_at` timestamp — the moment this information became available. This is the
anti-lookahead field.

```javascript
{
  id: "ds-sig-001",
  known_at: "2024-01-15T14:30:00Z",   // CRITICAL: when this was knowable
  category: "energy_bottleneck",
  title: "Houthi attacks on Red Sea shipping intensify",
  description: "...",
  source_type: "news_article",
  source_provider: "reuters",
  source_attribution: "Reuters 2024-01-15",
  novelty: 7,
  reliability: 8,
  tags: ["middle-east", "shipping", "energy"]
}
```

### Market Observation Object Shape (within dataset)

```javascript
{
  id: "ds-obs-001",
  known_at: "2024-01-15T16:00:00Z",
  observation_type: "price",          // price | candle | macro_series | sentiment | news
  symbol: "CL=F",
  name: "Crude Oil WTI",
  data: { price: 72.40, change_pct: 1.8, volume: 450000 },
  provider: "historical_import",
  source_attribution: "Yahoo Finance historical"
}
```

### Known Outcome Object Shape

Outcomes are what actually happened — used ONLY for post-simulation scoring, NEVER
visible during simulation.

```javascript
{
  id: "ds-out-001",
  resolved_at: "2024-02-28T00:00:00Z",  // When outcome became clear
  category: "energy_bottleneck",
  description: "Red Sea disruption persisted, Brent rose 8% over 6 weeks",
  asset_impacts: [
    { symbol: "BZ=F", direction: "up", magnitude_pct: 8.2, period_days: 42 },
    { symbol: "ZS=F", direction: "down", magnitude_pct: -1.1, period_days: 42 }
  ],
  thesis_was_correct: true,
  mispricing_existed: true,
  optimal_entry_window: { start: "2024-01-16", end: "2024-01-22" },
  optimal_expression: "Long Brent futures or USO calls"
}
```

### research_snapshots

A snapshot is a frozen point-in-time view of a dataset. The simulator advances
through snapshots sequentially.

```sql
CREATE TABLE research_snapshots (
  id            TEXT PRIMARY KEY,
  dataset_id    TEXT NOT NULL REFERENCES research_datasets(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),

  -- Point in time
  cutoff_at     TEXT NOT NULL,  -- ISO datetime: nothing after this is visible
  step_index    INTEGER NOT NULL, -- 0-based position in the walk-forward sequence

  -- Frozen state visible at this cutoff
  visible_signals     TEXT NOT NULL DEFAULT '[]',  -- signals with known_at <= cutoff
  visible_market_obs  TEXT NOT NULL DEFAULT '[]',  -- observations with known_at <= cutoff

  -- Derived state (computed by engine at snapshot time)
  scout_result        TEXT,  -- JSON: scoutSignals() output
  clusters            TEXT,  -- JSON: clusterSignals() output
  pattern_matches     TEXT,  -- JSON: matchPatterns() per cluster
  mispricing_checks   TEXT,  -- JSON: assessMispricing() per cluster
  counter_cases       TEXT,  -- JSON: generateCounterCase() per cluster
  governor_results    TEXT,  -- JSON: runGovernor() per cluster

  -- User-side engine results (if thesis replay)
  thesis_scores       TEXT,  -- JSON: scoring results
  gate_results        TEXT,  -- JSON: gate evaluation
  classifications     TEXT,  -- JSON: classification output

  UNIQUE(dataset_id, step_index)
);
```

### research_scenarios

A scenario defines what kind of simulation to run and what rules/parameters to test.

```sql
CREATE TABLE research_scenarios (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),

  -- Identity
  name          TEXT NOT NULL,
  description   TEXT,
  dataset_id    TEXT NOT NULL REFERENCES research_datasets(id),

  -- Scenario type
  scenario_type TEXT NOT NULL
    CHECK (scenario_type IN ('walk_forward', 'thesis_replay', 'event_replay', 'rule_backtest')),

  -- Configuration (JSON)
  config        TEXT NOT NULL DEFAULT '{}',
  /*
    walk_forward:  { step_size_hours: 24, scoring_weights: {...}, gate_overrides: {...} }
    thesis_replay: { thesis_template: {...}, entry_rules: {...}, exit_rules: {...} }
    event_replay:  { event_filter: { categories: [...] }, response_window_hours: 48 }
    rule_backtest: { rules_under_test: [...], baseline_rules: [...] }
  */

  -- Modified engine parameters (null = use live defaults)
  custom_weights    TEXT,  -- JSON: override SCORE_WEIGHTS for this scenario
  custom_gates      TEXT,  -- JSON: override gate thresholds
  custom_penalties  TEXT,  -- JSON: override governor penalties
  custom_routing    TEXT,  -- JSON: override routing rules

  status        TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'running', 'completed', 'failed'))
);
```

### research_runs

A run is a single execution of a scenario. Immutable after completion.

```sql
CREATE TABLE research_runs (
  id            TEXT PRIMARY KEY,
  scenario_id   TEXT NOT NULL REFERENCES research_scenarios(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,

  -- Execution
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  duration_ms   INTEGER,
  error         TEXT,

  -- Run parameters (frozen copy of scenario config at run time)
  frozen_config TEXT NOT NULL,  -- JSON snapshot of scenario config
  frozen_weights TEXT,          -- JSON snapshot of weights used
  frozen_gates   TEXT,          -- JSON snapshot of gates used

  -- Aggregate results
  total_steps       INTEGER,
  total_signals_seen INTEGER,
  total_clusters     INTEGER,
  total_escalations  INTEGER,
  total_develop      INTEGER,
  total_quarantine   INTEGER,

  -- Detailed step-by-step results
  step_results  TEXT NOT NULL DEFAULT '[]',  -- JSON array of per-step outputs

  -- Benchmark comparison
  benchmark_id  TEXT  -- optional reference to a baseline run
);
```

### research_results

Per-step results within a run. Separated for queryability.

```sql
CREATE TABLE research_results (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES research_runs(id),
  step_index    INTEGER NOT NULL,
  snapshot_id   TEXT REFERENCES research_snapshots(id),

  -- What the engine decided at this step
  cutoff_at         TEXT NOT NULL,
  signals_visible   INTEGER,
  clusters_formed   INTEGER,
  recommendations   TEXT NOT NULL DEFAULT '[]',  -- JSON: governor outputs

  -- For thesis replay: what classification would have been assigned
  thesis_score      REAL,
  thesis_class      TEXT,
  gate_pass         INTEGER,  -- 1/0
  forced_downgrades TEXT,     -- JSON

  -- Post-hoc evaluation (populated after run, using known_outcomes)
  outcome_match     TEXT,     -- JSON: did the recommendation align with actual outcome?
  score_vs_outcome  REAL,     -- -1 to 1: negative = wrong, positive = right
  timing_accuracy   TEXT,     -- early | on_time | late | missed

  UNIQUE(run_id, step_index)
);
```

### research_benchmarks

Named baselines for comparing rule changes.

```sql
CREATE TABLE research_benchmarks (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),

  name          TEXT NOT NULL,
  description   TEXT,

  -- Source
  run_id        TEXT NOT NULL REFERENCES research_runs(id),
  scenario_id   TEXT NOT NULL REFERENCES research_scenarios(id),
  dataset_id    TEXT NOT NULL REFERENCES research_datasets(id),

  -- Aggregate scores (precomputed for fast comparison)
  accuracy_score      REAL,  -- % of recommendations that matched outcomes
  precision_score     REAL,  -- % of escalations that were correct
  recall_score        REAL,  -- % of real opportunities that were escalated
  false_positive_rate REAL,  -- % of escalations that were wrong
  false_negative_rate REAL,  -- % of real opportunities missed
  avg_timing_score    REAL,  -- average timing accuracy
  overpromotion_rate  REAL,  -- % of cases where system was too aggressive
  underpromotion_rate REAL,  -- % of cases where system was too conservative

  -- Rule snapshot
  weights_used  TEXT,  -- JSON
  gates_used    TEXT,  -- JSON
  penalties_used TEXT  -- JSON
);
```

---

## C. Snapshot Engine Design

### Purpose

The snapshot engine converts a raw dataset into a sequence of time-ordered
"what you could have known at time T" views. This is the anti-lookahead mechanism.

### Core Invariant

> At snapshot step N with cutoff time T, the engine may ONLY see data where
> `known_at <= T`. Any data with `known_at > T` is invisible. Outcomes are
> NEVER visible during simulation — only during post-hoc evaluation.

### Snapshot Generation Algorithm

```
generateSnapshots(dataset, stepSizeHours):

  1. Collect all unique known_at timestamps from signals + market_obs
  2. Sort ascending
  3. Determine step boundaries:
     - start = dataset.period_start
     - end = dataset.period_end
     - steps = ceil((end - start) / stepSizeHours)
  4. For each step i (0..steps-1):
     a. cutoff = start + (i * stepSizeHours)
     b. visible_signals = dataset.signals.filter(s => s.known_at <= cutoff)
     c. visible_market_obs = dataset.market_obs.filter(o => o.known_at <= cutoff)
     d. Run bot pipeline on visible data ONLY:
        - scout_result = scoutSignals(visible_signals)
        - clusters = clusterSignals(scout_result.candidates)
        - For each cluster:
          - pattern = matchPatterns(cluster)
          - mispricing = assessMispricing(cluster)  // uses only visible_market_obs
          - counter = generateCounterCase(cluster, pattern, mispricing)
          - governor = runGovernor({ cluster, pattern, mispricing, counter })
     e. Persist snapshot with all computed state
  5. Return snapshot sequence
```

### Bias Guard Rules

The `bias-guard.js` module enforces these rules at the service layer:

| Rule | Enforcement |
|---|---|
| No future signals | Filter: `known_at <= cutoff`. Hard error if violated. |
| No future prices | Market obs filtered by `known_at`. Cannot query live market routes. |
| No outcome leakage | `known_outcomes` array is NEVER passed to any engine function. Only used by `benchmarks.js` after the run completes. |
| No live DB access | Research services never query `signals`, `theses`, `market_observations` tables. Only `research_*` tables. |
| Deterministic replay | Same dataset + same config = same results. No random seeds, no external API calls during simulation. |

### Snapshot Diff

Each snapshot also stores a diff from the previous step — what NEW information arrived:

```javascript
{
  new_signals: [...],         // signals where known_at is in (prev_cutoff, this_cutoff]
  new_market_obs: [...],      // observations in the same window
  cluster_changes: [...],     // clusters that changed membership or strength
  recommendation_changes: [...] // recommendations that changed state
}
```

This powers the event replay UI — showing what changed and why.

---

## D. Walk-Forward Simulation Framework

### Concept

Walk-forward simulation advances through time step by step, running the full
decision engine at each step with only the information available at that moment.
After all steps complete, results are compared against known outcomes.

### Simulation Loop

```
runWalkForward(scenario):

  1. Load dataset
  2. Load or generate snapshots (cache if step_size matches)
  3. Resolve engine configuration:
     - weights = scenario.custom_weights || SCORE_WEIGHTS (live defaults)
     - gates = scenario.custom_gates || GATE_DEFINITIONS (live defaults)
     - penalties = scenario.custom_penalties || PENALTIES (live defaults)
  4. Create run record (status: running)
  5. For each snapshot in order:
     a. Reconstruct visible state
     b. Run bot pipeline with scenario's engine config
     c. If thesis_replay: run scoring → gates → classification on thesis template
     d. Record step result:
        {
          step_index, cutoff_at,
          signals_visible, clusters_formed,
          recommendations: [{ cluster_id, state, why_not_higher, penalties }],
          thesis_score, thesis_class (if thesis replay)
        }
  6. Post-hoc evaluation:
     - For each step result, compare recommendations against known_outcomes
     - Compute: outcome_match, score_vs_outcome, timing_accuracy
  7. Aggregate:
     - accuracy, precision, recall, false positive/negative rates
     - overpromotion_rate, underpromotion_rate
     - timing distribution
  8. Mark run completed, persist results
```

### Simulation Modes

#### 1. Walk-Forward (default)
Steps through time at fixed intervals. Tests how the engine would have reacted
as information arrived.

Config:
```javascript
{
  step_size_hours: 24,       // advance 24h per step
  scoring_weights: null,     // null = use live defaults
  gate_overrides: null       // null = use live defaults
}
```

#### 2. Thesis Replay
Takes a thesis template and replays it through historical data to see how the
scoring/classification would have evolved over time.

Config:
```javascript
{
  thesis_template: {
    thesis_statement: "Hormuz Strait disruption will spike Brent above $90",
    causal_chain: [...],
    affected_assets: ["BZ=F", "CL=F"],
    key_assumptions: [...]
  },
  step_size_hours: 24,
  auto_score: true     // run autoScoreThesis at each step with visible signals/obs
}
```

#### 3. Event Replay
Replays a specific event category to study how signals clustered, when the bot
would have escalated, and whether that was early/late/correct.

Config:
```javascript
{
  event_filter: {
    categories: ["energy_bottleneck", "commodity_chokepoint"],
    geography: ["middle-east"]
  },
  response_window_hours: 48,  // how long after first signal to measure response
  step_size_hours: 6          // finer granularity for event replay
}
```

#### 4. Rule Backtest
Runs the same dataset twice: once with baseline rules, once with modified rules.
Compares results to measure the impact of rule changes.

Config:
```javascript
{
  baseline: {
    weights: { ...SCORE_WEIGHTS },
    penalties: { ...PENALTIES },
    routing: { ...ROUTING_RULES }
  },
  variant: {
    weights: { ...SCORE_WEIGHTS, signal_quality: 18, emotional_neutrality: 0 },
    penalties: { ...modified_penalties },
    routing: { ...modified_routing }
  }
}
```

### Custom Engine Overrides

The simulator wraps live engine functions with parameter injection:

```javascript
// Scoring with custom weights
function simulatedScore(scores, customWeights) {
  // Temporarily use custom weights, then restore
  return computeCompositeScoreWith(scores, customWeights || SCORE_WEIGHTS);
}

// Governor with custom penalties/routing
function simulatedGovernor(inputs, customPenalties, customRouting) {
  return runGovernorWith(inputs, {
    penalties: customPenalties || PENALTIES,
    routing: customRouting || ROUTING_RULES
  });
}
```

This requires the engine functions to accept optional config parameters.
The simulator passes overrides; live code passes nothing (gets defaults).

---

## E. Benchmark / Evaluation Framework

### Post-Hoc Scoring

After a simulation run completes, the evaluator compares each step's recommendations
against known outcomes.

```
evaluateRun(run, dataset):

  outcomes = dataset.known_outcomes

  For each step_result in run:
    For each recommendation in step_result.recommendations:
      matching_outcome = findOutcome(recommendation, outcomes)
      if matching_outcome:
        outcome_match = {
          recommended_state: recommendation.state,
          actual_correct: matching_outcome.thesis_was_correct,
          mispricing_existed: matching_outcome.mispricing_existed,
          was_promoted: state >= DEVELOP_THESIS,
          should_have_promoted: actual_correct && mispricing_existed,
          timing: compareTimestamp(step_result.cutoff_at, matching_outcome.optimal_entry_window)
        }
```

### Metrics Computed

| Metric | Formula | Meaning |
|---|---|---|
| Accuracy | correct_calls / total_calls | Overall correctness |
| Precision | true_escalations / all_escalations | When we escalated, were we right? |
| Recall | true_escalations / all_real_opportunities | Did we catch real opportunities? |
| False Positive Rate | wrong_escalations / all_escalations | Overpromotion |
| False Negative Rate | missed_opportunities / all_real_opportunities | Underpromotion |
| Avg Timing Score | mean(timing_accuracy) | early/on_time/late distribution |
| Overpromotion Rate | promoted_but_wrong / total_promoted | System too aggressive |
| Underpromotion Rate | real_but_not_promoted / total_real | System too conservative |
| Penalty Effectiveness | penalties_that_prevented_bad_calls / total_penalties | Are penalties helping? |
| Governor Override Rate | governor_downgrades / total_recommendations | How often does the governor intervene? |

### Benchmark Comparison

When two runs use the same dataset, the system can diff them:

```
compareBenchmarks(baseline_run, variant_run):

  return {
    accuracy_delta:       variant.accuracy - baseline.accuracy,
    precision_delta:      variant.precision - baseline.precision,
    recall_delta:         variant.recall - baseline.recall,
    false_positive_delta: variant.fp_rate - baseline.fp_rate,

    // Per-step comparison
    step_diffs: [
      {
        step_index: 0,
        baseline_state: "WATCH",
        variant_state: "DEVELOP_THESIS",
        outcome_favors: "variant",  // or "baseline" or "neither"
        reason: "Variant caught this 12h earlier due to lower timing_precision threshold"
      },
      ...
    ],

    // Rule impact analysis
    rule_impacts: [
      {
        rule_changed: "signal_quality weight: 14 → 18",
        steps_affected: 4,
        net_accuracy_impact: +0.03,
        false_positive_impact: +0.01
      }
    ]
  }
```

### Saved Benchmarks

A run can be saved as a named benchmark for future comparison:

- "Default Rules — Red Sea 2024" (baseline)
- "Higher Signal Weight — Red Sea 2024" (variant A)
- "Stricter Governor — Red Sea 2024" (variant B)

Each benchmark stores the exact rule configuration used, so comparisons are
always apples-to-apples.

---

## F. Page Structure for the Research Lab

### Navigation

Add to AppShell sidebar:
```javascript
{ to: '/research', label: 'Research Lab', icon: '⬡' }
```

### Pages

#### 1. `/research` — ResearchLab.jsx (Dashboard)

The lab entry point. Shows:

```
┌─────────────────────────────────────────────────────┐
│  RESEARCH LAB                                       │
│  Historical simulation. No lookahead. No shortcuts. │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  Datasets    │ │  Scenarios  │ │  Benchmarks │  │
│  │  3 ready     │ │  2 active   │ │  4 saved    │  │
│  └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                     │
│  RECENT RUNS                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Red Sea Walk-Forward   ✓ completed  82% acc │   │
│  │ BoJ Surprise Replay    ✓ completed  67% acc │   │
│  │ Stricter Governor Test ● running    step 14 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  QUICK ACTIONS                                      │
│  [New Dataset]  [New Scenario]  [Compare Runs]      │
└─────────────────────────────────────────────────────┘
```

#### 2. `/research/datasets` — ResearchDatasets.jsx

Dataset management. Create, import, edit, and validate historical datasets.

Sections:
- Dataset list with status badges (draft / ready / archived)
- Create form: name, period, description
- Signal editor: add/edit/import signals with mandatory `known_at` timestamps
- Market observation editor: add/import price/macro data with `known_at`
- Outcome editor: add known outcomes (only used for post-hoc evaluation)
- Validation: checks for temporal consistency, missing known_at, gaps

#### 3. `/research/simulator` — ResearchSimulator.jsx

Walk-forward simulation configuration and execution.

Sections:
- Scenario builder: select dataset, choose mode (walk-forward / thesis replay / event replay / rule backtest)
- Engine overrides panel: adjust weights, gates, penalties with live preview of changes vs defaults
- Run controls: start, pause, cancel
- Live progress: step-by-step advancement with current snapshot state
- Timeline scrubber: after completion, scrub through steps to see what the engine saw and decided at each point

#### 4. `/research/replay` — ResearchReplay.jsx

Event replay focused view. Steps through a historical event showing:

```
┌─────────────────────────────────────────────────────┐
│  EVENT REPLAY: Red Sea Shipping Crisis              │
│  Jan 12 - Feb 15 2024                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  TIMELINE  ○───●───○───○───○───○───○───○           │
│            Jan12  Jan15  Jan18  ...                  │
│                    ▲ YOU ARE HERE                    │
│                                                     │
│  NEW INFORMATION AT THIS STEP                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ + Reuters: "Second tanker struck in Bab..."  │   │
│  │ + CL=F price: $72.40 (+1.8%)                │   │
│  │ + Shipping rates: Baltic Dirty +12%          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ENGINE DECISION                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⚡ ESCALATE — Energy Chokepoint Disruption   │   │
│  │ Cluster: 4 signals, 3 independent sources   │   │
│  │ Pattern: 72% match                          │   │
│  │ WHY NOT HIGHER: Missing naval deployment     │   │
│  │   confirmation and insurance rate data       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  WHAT ACTUALLY HAPPENED (post-hoc)                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ Brent +8.2% over next 42 days               │   │
│  │ Optimal entry: Jan 16-22                    │   │
│  │ This step: ON TIME ✓                        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [◄ Prev Step]                     [Next Step ►]    │
└─────────────────────────────────────────────────────┘
```

#### 5. `/research/backtest` — ResearchBacktest.jsx

Rule comparison UI. Side-by-side view of baseline vs variant rules.

Sections:
- Rule editor: two columns (baseline left, variant right)
- Weight sliders with diff highlighting
- Gate toggle overrides
- Penalty enable/disable switches
- Run both button
- Results comparison table with delta highlighting
- Per-step diff viewer: "At step 7, baseline said WATCH but variant said DEVELOP_THESIS. Outcome favors: variant."

#### 6. `/research/results` — ResearchResults.jsx

Results browser and benchmark management.

Sections:
- Run history with filterable list
- Detailed run view: aggregate metrics + step-by-step breakdown
- Benchmark save/load
- Multi-run comparison chart (accuracy, precision, recall across runs)
- Export results as JSON

### Routing

```javascript
// In App.jsx, add under the AppShell route:
<Route path="/research" element={<ResearchLab />} />
<Route path="/research/datasets" element={<ResearchDatasets />} />
<Route path="/research/simulator" element={<ResearchSimulator />} />
<Route path="/research/replay" element={<ResearchReplay />} />
<Route path="/research/backtest" element={<ResearchBacktest />} />
<Route path="/research/results" element={<ResearchResults />} />
```

---

## Engine Modifications Required

To support custom parameter injection without altering live behavior, the following
engine functions need an optional `config` parameter:

| Function | Change |
|---|---|
| `computeCompositeScore(scores)` | Add optional second arg: `computeCompositeScore(scores, weights = SCORE_WEIGHTS)` |
| `runGates(thesis, plan, signals, checklist)` | Add optional fifth arg: `runGates(..., gateConfig = GATE_DEFINITIONS)` |
| `classifyThesis(score, dims, gates, thesis)` | Add optional fifth arg: `classifyThesis(..., config = { thresholds: CLASSIFICATIONS, downgrades: FORCED_DOWNGRADES })` |
| `runGovernor(inputs)` | Add optional second arg: `runGovernor(inputs, config = { penalties: PENALTIES, routing: ROUTING_RULES })` |

These changes are additive — no default parameter means live behavior is unchanged.
The Research Lab passes custom configs; live code passes nothing.

---

## Summary

| Component | Files | Purpose |
|---|---|---|
| Schema | `server/research/schema.sql` | 6 tables: datasets, snapshots, scenarios, runs, results, benchmarks |
| Dataset Manager | `server/research/datasets.js` | CRUD, import, validation for historical data |
| Snapshot Engine | `server/research/snapshots.js` | Time-ordered frozen views with bias prevention |
| Bias Guard | `server/research/bias-guard.js` | Enforces no-lookahead, no-live-data, deterministic replay |
| Simulator | `server/research/simulator.js` | Walk-forward loop with custom engine config injection |
| Replayer | `server/research/replayer.js` | Event-focused step-through with diff tracking |
| Backtester | `server/research/backtester.js` | Dual-run rule comparison |
| Benchmarks | `server/research/benchmarks.js` | Post-hoc evaluation, metric computation, comparison |
| API Routes | `server/routes/research.js` | All /api/research/* endpoints |
| Pages | `src/pages/Research*.jsx` (6) | Dashboard, Datasets, Simulator, Replay, Backtest, Results |
| Store | `src/store/useResearchStore.js` | Dedicated Zustand store for lab state |
