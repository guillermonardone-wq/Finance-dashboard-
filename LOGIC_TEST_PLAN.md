# Logic Model Testing Plan — Signal Forge Live Engine

## A. Test Matrix

### A1. Scoring Engine (`src/engine/scoring.js`)

| Test ID | Function | What to verify | Input category | Expected behavior |
|---|---|---|---|---|
| S-01 | `computeCompositeScore` | Perfect scores → 100 | All dimensions = 10 | composite = 100, no missing, no penalty |
| S-02 | `computeCompositeScore` | All zeros → 0 | All dimensions = 0 | composite = 0 |
| S-03 | `computeCompositeScore` | Missing dimensions penalized | 3 dimensions omitted | missingPenalty = sum(missing weights) * 0.3 |
| S-04 | `computeCompositeScore` | Clamping at 0 and 10 | Scores include -5 and 15 | Clamped to 0 and 10 respectively |
| S-05 | `computeCompositeScore` | Single dimension | Only signal_quality = 10 | contribution = 14, penalty on 11 missing dims |
| S-06 | `computeCompositeScore` | Weight sum integrity | N/A | SCORE_WEIGHTS values sum to exactly 100 |
| S-07 | `autoScoreThesis` | Signal quality auto-score | Signals with reliability values | Computes avg(reliability + strength) / 2 |
| S-08 | `autoScoreThesis` | Data freshness tiers | marketObs at various ages | <1h→10, <6h→7, <24h→5, <48h→3, >48h→1 |
| S-09 | `autoScoreThesis` | Timing precision tiers | Timelines of various spans | ≤7d→9, ≤30d→7, ≤90d→5, ≤180d→3, >180d→2 |
| S-10 | `autoScoreThesis` | Disconfirmation scoring | Various disconfirm combos | bear+opposite+evidence → up to 10 |
| S-11 | `autoScoreThesis` | Empty inputs | No signals, no marketObs | Returns empty scores object |

### A2. Gate Engine (`src/engine/gates.js`)

| Test ID | Function | What to verify | Gate tested | Expected behavior |
|---|---|---|---|---|
| G-01 | `runGates` | Hard gate blocks execution | invalidation_defined | passed=false if no invalidating_indicators and no invalidation_condition |
| G-02 | `runGates` | Hard gate blocks execution | disconfirming_case | passed=false if disconfirming_evidence is empty array |
| G-03 | `runGates` | Hard gate blocks execution | bear_case_written | passed=false if strongest_bear_case < 21 chars |
| G-04 | `runGates` | Hard gate blocks execution | time_horizon | passed=false if expected_timeline has no start or end |
| G-05 | `runGates` | Hard gate blocks execution | max_risk_defined | passed=false if executionPlan is null |
| G-06 | `runGates` | Hard gate blocks execution | expression_vehicle | passed=false if executionPlan.expression_vehicle missing or ≤3 chars |
| G-07 | `runGates` | Hard gate blocks execution | emotional_neutrality | passed=false if emotional_state = 'excited' |
| G-08 | `runGates` | Soft gate warning | min_confirming_signals | softFail if < 3 linked signals |
| G-09 | `runGates` | Soft gate warning | multi_source_evidence | softFail if < 2 source types |
| G-10 | `runGates` | Soft gate warning | sleep_on_it | softFail if thesis < 12 hours old |
| G-11 | `runGates` | Soft gate warning | assumption_load | softFail if > 5 assumptions |
| G-12 | `runGates` | Soft gate warning | probability_honesty | softFail if prob spread < 15% |
| G-13 | `runGates` | Soft gate warning | would_take_if_not_mine | softFail if answer is false |
| G-14 | `runGates` | All gates pass | Complete valid thesis | passed=true, hardFails=[], softFails=[] |
| G-15 | `runGates` | Multiple hard fails | Missing multiple hard fields | hardFails.length matches fail count |
| G-16 | `runGates` | Emotional states | Each of excited/fomo/revenge/bored | All four block via emotional_neutrality gate |
| G-17 | `runGates` | Emotional states | calm, focused, fearful, anxious | None of these block (anxious is not in the hard gate) |

### A3. Classification Engine (`src/engine/classification.js`)

| Test ID | Function | What to verify | Input | Expected behavior |
|---|---|---|---|---|
| C-01 | `classifyThesis` | Score thresholds | composite=0 | IGNORE |
| C-02 | `classifyThesis` | Score thresholds | composite=34 | IGNORE |
| C-03 | `classifyThesis` | Score thresholds | composite=35 | WATCH |
| C-04 | `classifyThesis` | Score thresholds | composite=50 | DEVELOP |
| C-05 | `classifyThesis` | Score thresholds | composite=65 | PAPER_TRADE |
| C-06 | `classifyThesis` | Score thresholds | composite=75 | SMALL_POSITION |
| C-07 | `classifyThesis` | Score thresholds | composite=85 | FULLY_QUALIFIED |
| C-08 | `classifyThesis` | Score thresholds | composite=100 | FULLY_QUALIFIED |
| C-09 | `classifyThesis` | Forced downgrade | timing_precision=3, composite=90 | Capped at WATCH |
| C-10 | `classifyThesis` | Forced downgrade | disconfirmation_robustness=3, composite=90 | Capped at DEVELOP |
| C-11 | `classifyThesis` | Forced downgrade | risk_containment=4, composite=90 | Capped at PAPER_TRADE |
| C-12 | `classifyThesis` | Forced downgrade | emotional_neutrality=3, composite=90 | QUARANTINED |
| C-13 | `classifyThesis` | Forced downgrade | data_freshness=3, composite=90 | Capped at DEVELOP |
| C-14 | `classifyThesis` | Forced downgrade | signal_quality=2, composite=90 | Capped at WATCH |
| C-15 | `classifyThesis` | Hard gate cap | hardFails.length > 0, composite=90 | Capped at DEVELOP |
| C-16 | `classifyThesis` | Soft gate penalty | 4 soft fails, composite=90 | Downgrade 2 levels from current |
| C-17 | `classifyThesis` | Assumption overload | 8 assumptions, composite=90 | Capped at WATCH |
| C-18 | `classifyThesis` | Assumption overload | 6 assumptions, composite=90 | Capped at DEVELOP |
| C-19 | `classifyThesis` | Stacked downgrades | timing=3 + data_freshness=3 | Lower of WATCH and DEVELOP = WATCH |
| C-20 | `classifyThesis` | No downgrade | All dims ≥ 5, no gate fails | classification = scoreClassification |

### A4. Behavioral Checklist (`src/engine/behavioral.js`)

| Test ID | Function | What to verify | Input | Expected behavior |
|---|---|---|---|---|
| B-01 | `runChecklist` | All pass | All correct answers | passed=true, blocks=[], score=100 |
| B-02 | `runChecklist` | Emotional block | emotional_state='fomo' | passed=false, block on emotional_state |
| B-03 | `runChecklist` | Narrative block | real_mispricing='narrative_only' | passed=false, block on real_mispricing |
| B-04 | `runChecklist` | Text too short | invalidation_defined='no' (3 chars) | passed=false, block (minLength=20) |
| B-05 | `runChecklist` | Warning not block | independent_signals=2 | passed=true, warning present, score still counts |
| B-06 | `runChecklist` | Warn on excitement | process_not_excitement='mostly_process' | passed=true, warning present |
| B-07 | `runChecklist` | Unanswered items | Empty answers object | passed=false, 12 blocks |
| B-08 | `getMaxPositionSize` | Sizing rules | FULLY_QUALIFIED, $100k capital | maxDollars=5000, maxPercent=5 |
| B-09 | `getMaxPositionSize` | Sizing rules | QUARANTINED, $100k capital | maxDollars=0, maxPercent=0 |
| B-10 | `getMaxPositionSize` | Sizing rules | WATCH, any capital | maxDollars=0 |

### A5. Bot Governor (`server/bot/governor.js`)

| Test ID | Function | What to verify | Input condition | Expected behavior |
|---|---|---|---|---|
| GOV-01 | `runGovernor` | Rule A fires | 1 source, no market, no pattern | LOG_ONLY |
| GOV-02 | `runGovernor` | Rule B fires | Strong cluster, dupe-heavy, low mispricing | WATCH |
| GOV-03 | `runGovernor` | Rule C fires | Pattern ≥ 0.6 match, ≥ 3 missing confirms | WATCH |
| GOV-04 | `runGovernor` | Rule D fires | High novelty, fully_repriced | LOG_ONLY |
| GOV-05 | `runGovernor` | Rule E fires | Novelty > 0.7, < 3 sources, confidence < 0.4 | QUARANTINE |
| GOV-06 | `runGovernor` | Rule F fires | ≥ 3 sources, pattern ≥ 0.5, mispricing ≥ 0.4, counter < 7 | DEVELOP_THESIS |
| GOV-07 | `runGovernor` | Rule G fires | Stale data penalty applied | WATCH |
| GOV-08 | `runGovernor` | One-source penalty | independent_source_count = 1 | one_source penalty applied, capped at WATCH |
| GOV-09 | `runGovernor` | Duplicate penalty | 5 signals, 1 independent source | duplicate_heavy penalty, capped at WATCH |
| GOV-10 | `runGovernor` | Already-priced cap | market_reaction_state = 'fully_repriced' | market_already_priced penalty, capped at LOG_ONLY |
| GOV-11 | `runGovernor` | Red-team dominance | counter case quality = 8, current above WATCH | Downgraded to WATCH |
| GOV-12 | `runGovernor` | Red-team non-dominant | counter case quality = 5 | No red-team downgrade |
| GOV-13 | `runGovernor` | Excitement-evidence cap | Novelty > 0.7, < 3 sources, mispricing < 0.4 | QUARANTINE via penalty |
| GOV-14 | `runGovernor` | Escalation triggers | ≥ 3 recent signals, ≥ 5 total, state ≥ WATCH | ESCALATE |
| GOV-15 | `runGovernor` | No rule matches | Ambiguous inputs | Defaults to LOG_ONLY |
| GOV-16 | `runGovernor` | Penalty stacking | Multiple penalties fire | Each caps independently, lowest cap wins |
| GOV-17 | `runGovernor` | Governor never upgrades | After penalty caps at WATCH, nothing elevates it | State stays at WATCH or lower |

---

## B. Scenario Test Cases

### Scenario 1: "Perfect Thesis — Full Pipeline Pass"

**Tests:** Scoring correctness, gate pass, classification accuracy, position sizing

**Input:**
```javascript
const scores = {
  signal_quality: 9, signal_independence: 8, causal_chain_clarity: 8,
  market_mispricing_likelihood: 9, catalyst_visibility: 7, timing_precision: 8,
  expression_quality: 8, risk_containment: 9, disconfirmation_robustness: 7,
  emotional_neutrality: 8, data_freshness: 9, market_confirmation_divergence: 7,
};
const thesis = {
  id: 'test-1',
  invalidating_indicators: ['CPI prints below 2%'],
  disconfirming_evidence: ['Fed signals dovish pivot', 'Wage growth slows'],
  strongest_bear_case: 'Inflation is transitory and the market knows it already',
  expected_timeline: { start: '2026-04-01', end: '2026-06-01' },
  probability_low: 0.4, probability_high: 0.7,
  key_assumptions: ['CPI stays elevated', 'Fed holds rates'],
  created_at: '2026-03-01T00:00:00Z', // > 12 hours ago
};
const executionPlan = {
  expression_vehicle: 'TLT puts',
  max_risk_dollars: 5000,
  max_risk_percent: 2,
};
const signals = [
  { thesis_id: 'test-1', status: 'linked', source_type: 'news_feed', category: 'central_bank_action' },
  { thesis_id: 'test-1', status: 'linked', source_type: 'government_data', category: 'policy_shock' },
  { thesis_id: 'test-1', status: 'linked', source_type: 'market_data', category: 'market_complacency' },
];
const checklistAnswers = {
  opposite_case: true,
  invalidation_defined: 'If CPI drops below 2.5% for two consecutive months',
  timing_bounded: true,
  real_mispricing: 'measurable',
  clean_vehicle: true,
  risk_capped: true,
  independent_signals: 4,
  data_fresh: true,
  process_not_excitement: 'process',
  would_take_if_not_mine: true,
  early_vs_right: 'If breakevens drop below 2% without CPI confirmation, I am wrong not early',
  emotional_state: 'calm',
};
```

**Expected Outputs:**
```
computeCompositeScore(scores):
  composite = (9*14 + 8*9 + 8*11 + 9*14 + 7*8 + 8*8 + 8*9 + 9*9 + 7*6 + 8*4 + 9*4 + 7*4) / 10
            = (126 + 72 + 88 + 126 + 56 + 64 + 72 + 81 + 42 + 32 + 36 + 28) / 10
            = 823 / 10 = 82.3
  missing = [], missingPenalty = 0

runGates(thesis, executionPlan, signals, checklistAnswers):
  passed = true
  hardFails = []
  softFails = []  (3 signals, 3 source types, > 12h old, 2 assumptions, spread=0.3)

classifyThesis(82.3, scores, gateResult, thesis):
  scoreClassification = SMALL_POSITION (75-84)
  No forced downgrades (all dims ≥ 4, risk_containment=9 ≥ 5, signal_quality=9 ≥ 3)
  No assumption overload (2 assumptions)
  classification = SMALL_POSITION

getMaxPositionSize('SMALL_POSITION', 100000):
  maxDollars = 2000, maxPercent = 2
```

---

### Scenario 2: "Exciting Narrative, No Disconfirmation — Hard Gate Block"

**Tests:** Hard gate enforcement, forced downgrade, disconfirmation robustness

**Input:**
```javascript
const scores = {
  signal_quality: 8, signal_independence: 7, causal_chain_clarity: 7,
  market_mispricing_likelihood: 8, catalyst_visibility: 9, timing_precision: 7,
  expression_quality: 7, risk_containment: 8, disconfirmation_robustness: 2,
  emotional_neutrality: 7, data_freshness: 8, market_confirmation_divergence: 6,
};
const thesis = {
  id: 'test-2',
  invalidating_indicators: [],         // EMPTY — hard gate fail
  disconfirming_evidence: [],           // EMPTY — hard gate fail
  strongest_bear_case: 'Short.',        // 6 chars — hard gate fail (< 21)
  expected_timeline: { start: '2026-04-01', end: '2026-06-01' },
  probability_low: 0.6, probability_high: 0.7, // spread = 0.1 < 0.15 — soft fail
  key_assumptions: ['A', 'B'],
  created_at: new Date().toISOString(), // just created — soft fail (< 12h)
};
const executionPlan = { expression_vehicle: 'CL futures', max_risk_dollars: 3000 };
const signals = [{ thesis_id: 'test-2', status: 'linked', source_type: 'news_feed' }]; // only 1 — soft fail
```

**Expected Outputs:**
```
computeCompositeScore(scores):
  composite = (8*14 + 7*9 + 7*11 + 8*14 + 9*8 + 7*8 + 7*9 + 8*9 + 2*6 + 7*4 + 8*4 + 6*4) / 10
            = (112 + 63 + 77 + 112 + 72 + 56 + 63 + 72 + 12 + 28 + 32 + 24) / 10
            = 723 / 10 = 72.3

runGates:
  hardFails = [invalidation_defined, disconfirming_case, bear_case_written]  // 3 hard fails
  softFails = [min_confirming_signals, multi_source_evidence, sleep_on_it, probability_honesty]
  passed = false

classifyThesis(72.3, scores, gateResult, thesis):
  scoreClassification = PAPER_TRADE (65-74)
  Step 2: Hard gate failures → cap at DEVELOP
  Step 3: disconfirmation_robustness=2 < 4 → cap at DEVELOP (already there)
  Step 5: 4 soft fails → floor(4/2)=2 level downgrade from DEVELOP(idx=2) → IGNORE(idx=0)
  classification = IGNORE

getMaxPositionSize('IGNORE', any):
  maxDollars = 0
```

---

### Scenario 3: "FOMO Emotional State — Quarantine Override"

**Tests:** Emotional neutrality gate, QUARANTINED forced downgrade, position sizing = 0

**Input:**
```javascript
const scores = {
  signal_quality: 9, signal_independence: 9, causal_chain_clarity: 9,
  market_mispricing_likelihood: 9, catalyst_visibility: 9, timing_precision: 9,
  expression_quality: 9, risk_containment: 9, disconfirmation_robustness: 9,
  emotional_neutrality: 2,  // LOW — triggers QUARANTINE forced downgrade
  data_freshness: 9, market_confirmation_divergence: 9,
};
const checklistAnswers = { emotional_state: 'fomo' };  // blocks hard gate
```

**Expected Outputs:**
```
computeCompositeScore(scores):
  composite = (9*14 + 9*9 + 9*11 + 9*14 + 9*8 + 9*8 + 9*9 + 9*9 + 9*6 + 2*4 + 9*4 + 9*4) / 10
            = (126+81+99+126+72+72+81+81+54+8+36+36) / 10
            = 872 / 10 = 87.2

runGates:
  emotional_neutrality hard gate FAILS (fomo is in dangerous list)
  passed = false

classifyThesis(87.2, scores, gateResult, thesis):
  scoreClassification = FULLY_QUALIFIED (≥ 85)
  Step 2: Hard gate fail → cap at DEVELOP
  Step 3: emotional_neutrality=2 < 4 → QUARANTINED (overrides everything)
  classification = QUARANTINED

getMaxPositionSize('QUARANTINED', 100000):
  maxDollars = 0, maxPercent = 0
```

---

### Scenario 4: "Single Source Bot Signal — Governor Caps at WATCH"

**Tests:** One-source penalty, governor cap behavior, why_not_higher populated

**Input:**
```javascript
const governorInputs = {
  cluster: {
    id: 'cluster-4',
    signal_count: 1,
    independent_source_count: 1,
    cluster_strength: 'weak',
    cluster_novelty: 0.5,
    confidence_range: { low: 0.2, high: 0.5, best: 0.3 },
  },
  candidateSignals: [{
    source_refs: [{ type: 'news_feed', attribution: 'Reuters' }],
    penalties: [],
  }],
  patternMatch: { match_score: 0.6, pattern_name: 'energy_chokepoint_disruption', missing_confirmations: ['naval deployment'] },
  mispricingAssessment: {
    market_reaction_state: 'no_reaction',
    implied_mispricing_likelihood: 0.5,
    stale_data_penalty_applied: false,
  },
  counterCase: { reasoning_quality_score: 4, strongest_opposing_case: 'Could be routine exercise' },
};
```

**Expected Outputs:**
```
runGovernor(governorInputs):
  Rule A check: singleSource=true, noMarket=false (has assessment), noPattern=false (0.6≥0.3) → does NOT match
  Rule B check: strongCluster=false (weak) → does NOT match
  Rule C check: strongPattern=true (0.6≥0.6), missingCritical=false (1<3) → does NOT match
  No rules match → default LOG_ONLY

  Penalties:
    one_source: applies (independent=1 ≤ 1) → cap at WATCH → but LOG_ONLY < WATCH, no override
    (LOG_ONLY is index 1, WATCH is index 2 — currentIndex 1 is NOT > capIndex 2)

  recommended_state = LOG_ONLY
  penalties_applied includes 'one_source'
  why_not_higher includes 'Single-source signals are unreliable'
```

---

### Scenario 5: "Already-Priced Event — Governor Forces LOG_ONLY"

**Tests:** Market-already-priced penalty, Rule D, prevents acting on stale opportunities

**Input:**
```javascript
const governorInputs = {
  cluster: {
    id: 'cluster-5',
    signal_count: 5,
    independent_source_count: 4,
    cluster_strength: 'strong',
    cluster_novelty: 0.8,
    confidence_range: { low: 0.5, high: 0.8, best: 0.7 },
  },
  candidateSignals: [/* 5 signals, none with dramatic penalty */],
  patternMatch: { match_score: 0.7, pattern_name: 'sanctions_escalation', missing_confirmations: ['formal announcement'] },
  mispricingAssessment: {
    market_reaction_state: 'fully_repriced',
    implied_mispricing_likelihood: 0.1,
    stale_data_penalty_applied: false,
  },
  counterCase: { reasoning_quality_score: 4, strongest_opposing_case: 'Market has already moved...' },
};
```

**Expected Outputs:**
```
runGovernor(governorInputs):
  Rule A: singleSource=false → skip
  Rule B: strongCluster=true, duplicateHeavy=false (4/5=0.8 ≥ 0.4), lowMispricing=true (0.1<0.3)
         → duplicateHeavy check fails → skip
  Rule C: strongPattern=true (0.7≥0.6), missingCritical=false (1<3) → skip
  Rule D: highNovelty=true (0.8>0.6), repriced=true → MATCH
  recommended_state = LOG_ONLY

  Penalties:
    market_already_priced: applies (fully_repriced) → cap at LOG_ONLY (already there)

  recommended_state = LOG_ONLY
  why_not_higher includes 'market has already repriced'
```

---

### Scenario 6: "Duplicate-Inflated Cluster — Governor Exposes False Confidence"

**Tests:** Duplicate-heavy penalty, volume ≠ confirmation, cap at WATCH

**Input:**
```javascript
const governorInputs = {
  cluster: {
    id: 'cluster-6',
    signal_count: 8,
    independent_source_count: 2,  // 2/8 = 0.25 < 0.4 → inflated
    cluster_strength: 'moderate',
    cluster_novelty: 0.5,
    duplicate_penalty_applied: false,
    confidence_range: { low: 0.3, high: 0.6, best: 0.45 },
  },
  candidateSignals: Array(8).fill({
    source_refs: [{ type: 'news_feed', attribution: 'AP' }],
    penalties: [],
  }),
  patternMatch: { match_score: 0.5, pattern_name: 'geopolitical_crisis_escalation', missing_confirmations: ['diplomatic breakdown'] },
  mispricingAssessment: {
    market_reaction_state: 'no_reaction',
    implied_mispricing_likelihood: 0.2,
    stale_data_penalty_applied: false,
  },
  counterCase: { reasoning_quality_score: 5, strongest_opposing_case: 'Diplomatic channels still open...' },
};
```

**Expected Outputs:**
```
runGovernor(governorInputs):
  Rule A: singleSource=false (2) → skip
  Rule B: strongCluster=true (moderate), duplicateHeavy=true (2 < 8*0.4=3.2), lowMispricing=true (0.2<0.3) → MATCH
  recommended_state = WATCH

  Penalties:
    duplicate_heavy: applies (8 signals, 2 independent, 2 < 8*0.4) → cap at WATCH (already there)

  recommended_state = WATCH
  why_not_higher includes 'Volume of coverage ≠ independent confirmation'
```

---

### Scenario 7: "Red-Team Dominates — Governor Overrides DEVELOP_THESIS to WATCH"

**Tests:** Red-team dominance check (quality ≥ 7), governor override, cannot stay above WATCH

**Input:**
```javascript
const governorInputs = {
  cluster: {
    id: 'cluster-7',
    signal_count: 5,
    independent_source_count: 4,
    cluster_strength: 'strong',
    cluster_novelty: 0.5,
    confidence_range: { low: 0.4, high: 0.7, best: 0.6 },
  },
  candidateSignals: Array(5).fill({
    source_refs: [{ type: 'news_feed', attribution: 'Reuters' }],
    penalties: [],
  }),
  patternMatch: { match_score: 0.6, pattern_name: 'central_bank_surprise', missing_confirmations: ['rate decision'] },
  mispricingAssessment: {
    market_reaction_state: 'early_reaction',
    implied_mispricing_likelihood: 0.5,
    stale_data_penalty_applied: false,
  },
  counterCase: {
    reasoning_quality_score: 8,  // ≥ 7 → triggers red-team dominance
    strongest_opposing_case: 'Forward guidance was clear, market expectations are well-anchored, and the committee minutes showed consensus. A surprise is extremely unlikely and the evidence base relies on one dissenter quote.',
    circular_logic_detected: false,
  },
};
```

**Expected Outputs:**
```
runGovernor(governorInputs):
  Rule A: skip (4 sources)
  Rule B: skip (not duplicate heavy: 4/5=0.8 ≥ 0.4)
  Rule C: skip (strong pattern but only 1 missing confirmation < 3)
  Rule D: skip (not repriced)
  Rule E: skip (novelty 0.5 ≤ 0.7)
  Rule F: multiSource=true (4≥3), strongPattern=true (0.6≥0.5), mispricingPlausible=true (0.5≥0.4),
          redTeamNotDominant=false (8 ≥ 7) → DOES NOT MATCH (redTeamNotDominant fails)
  Rule G: skip (not stale)
  No rule matches → default LOG_ONLY

  Step 3: Red-team dominance check:
    counterQuality=8 ≥ 7, BUT LOG_ONLY is NOT > WATCH (it's less)
    So red-team override does NOT fire (already below WATCH)

  recommended_state = LOG_ONLY

  governor_overrides = [] (red-team check condition: BOT_STATES.indexOf(LOG_ONLY) > BOT_STATES.indexOf(WATCH) is false)
```

Wait — let me reconsider. Rule F fails because redTeamNotDominant is false. So no rule matches and we get LOG_ONLY. The red-team dominance step (Step 3) then checks if current state > WATCH, but LOG_ONLY(idx=1) is NOT > WATCH(idx=2), so no additional downgrade. The red-team dominance is already encoded in Rule F preventing the DEVELOP_THESIS assignment. **This is correct behavior — the Governor prevented overpromotion by not matching Rule F when red-team is dominant.**

---

### Scenario 8: "Stale Data with Strong Pattern — Governor Caps at WATCH"

**Tests:** Stale data penalty, Rule G, data_freshness enforcement

**Input:**
```javascript
const governorInputs = {
  cluster: {
    id: 'cluster-8',
    signal_count: 4,
    independent_source_count: 3,
    cluster_strength: 'moderate',
    cluster_novelty: 0.5,
    confidence_range: { low: 0.3, high: 0.6, best: 0.5 },
  },
  candidateSignals: Array(4).fill({
    source_refs: [{ type: 'news_feed', attribution: 'Bloomberg' }],
    penalties: [],
  }),
  patternMatch: { match_score: 0.6, pattern_name: 'energy_chokepoint_disruption', missing_confirmations: ['insurance rate spike'] },
  mispricingAssessment: {
    market_reaction_state: 'no_reaction',
    implied_mispricing_likelihood: 0.5,
    stale_data_penalty_applied: true,
    data_freshness_hours: 52,
  },
  counterCase: { reasoning_quality_score: 4, strongest_opposing_case: 'Routine disruption...' },
};
```

**Expected Outputs:**
```
runGovernor(governorInputs):
  Rule A: skip (3 sources)
  Rule B: skip (not duplicate heavy)
  Rule C: skip (1 missing < 3)
  Rule D: skip (not repriced)
  Rule E: skip (novelty 0.5 ≤ 0.7)
  Rule F: multiSource=true, strongPattern=true, mispricingPlausible=true, redTeamNotDominant=true
          → MATCH → DEVELOP_THESIS

  Penalties:
    stale_data: applies (stale_data_penalty_applied=true) → cap at WATCH
    → DEVELOP_THESIS(idx=3) > WATCH(idx=2) → governor_override from DEVELOP_THESIS to WATCH

  Rule G would also match (stale=true) but Rule F matched first.

  recommended_state = WATCH
  penalties_applied includes stale_data
  governor_overrides includes { from: 'DEVELOP_THESIS', to: 'WATCH' }
  why_not_higher includes 'stale'
```

---

### Scenario 9: "Excitement-Evidence Imbalance — Quarantined"

**Tests:** excitement_evidence_imbalance penalty, the exact user vulnerability pattern

**Input:**
```javascript
const governorInputs = {
  cluster: {
    id: 'cluster-9',
    signal_count: 2,
    independent_source_count: 2,
    cluster_strength: 'emerging',
    cluster_novelty: 0.85,  // HIGH
    confidence_range: { low: 0.2, high: 0.5, best: 0.35 },
  },
  candidateSignals: [{
    source_refs: [{ type: 'news_feed', attribution: 'Twitter' }],
    penalties: [{ id: 'dramatic_language', severity: 0.2 }],
  }, {
    source_refs: [{ type: 'news_feed', attribution: 'ZeroHedge' }],
    penalties: [{ id: 'dramatic_language', severity: 0.24 }],
  }],
  patternMatch: null,
  mispricingAssessment: {
    market_reaction_state: 'no_reaction',
    implied_mispricing_likelihood: 0.2,
    stale_data_penalty_applied: false,
  },
  counterCase: { reasoning_quality_score: 6, strongest_opposing_case: 'This is speculative...' },
};
```

**Expected Outputs:**
```
runGovernor(governorInputs):
  Rule A: singleSource=false (2), noMarket=false, noPattern=true (null) → not all conditions met → skip
  Rule E: highNovelty=true (0.85>0.7), lowEvidence=true (2<3), lowConfidence=true (0.35<0.4) → MATCH
  recommended_state = QUARANTINE

  Penalties:
    excitement_evidence_imbalance: highNovelty=true(0.85>0.7), weakEvidence=true(2<3),
      weakMispricing=true(0.2<0.4), strongCounter=true(6≥6) → applies → cap at QUARANTINE (already there)
    dramatic_language: 2/2=100% > 50% → applies as warn (no cap)
    missing_market_check: mispricingAssessment exists → does NOT apply
    missing_disconfirmation: counterCase exists and is substantive → does NOT apply

  recommended_state = QUARANTINE
  why_not_higher includes 'exciting but under-validated' or 'Quarantined until evidence improves'
```

---

### Scenario 10: "Score 90, All Dimensions Strong, But 8 Assumptions"

**Tests:** Assumption overload caps classification regardless of score

**Input:**
```javascript
const scores = {
  signal_quality: 9, signal_independence: 9, causal_chain_clarity: 9,
  market_mispricing_likelihood: 9, catalyst_visibility: 9, timing_precision: 9,
  expression_quality: 9, risk_containment: 9, disconfirmation_robustness: 9,
  emotional_neutrality: 9, data_freshness: 9, market_confirmation_divergence: 9,
};
const thesis = {
  key_assumptions: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'],  // 8 > 7
};
const gateResult = { passed: true, hardFails: [], softFails: [] };
```

**Expected Outputs:**
```
computeCompositeScore(scores):
  composite = 90  (all 9s: 9/10 * 100 = 90)

classifyThesis(90, scores, gateResult, thesis):
  scoreClassification = FULLY_QUALIFIED (≥ 85)
  No forced downgrades (all dims ≥ 4)
  Assumption overload: 8 > 7 → cap at WATCH
  classification = WATCH  (from FULLY_QUALIFIED!)
  downgrades = [{ from: 'FULLY_QUALIFIED', to: 'WATCH', reason: '8 assumptions...' }]
```

---

## C. Highest-Risk Edge Cases

### C1. CRITICAL: Emotional neutrality = 3 with score 95

The forced downgrade for emotional_neutrality < 4 sends to QUARANTINED. But what if the gate also fails? Both the gate cap (→ DEVELOP) and the forced downgrade (→ QUARANTINED) apply. **QUARANTINED should win** because the classification code checks `target === 'QUARANTINED'` as a special case (line 136 of classification.js).

**Risk:** If ordering matters and the gate cap to DEVELOP is applied before the QUARANTINED check, the QUARANTINED might not fire if the code short-circuits. **Verify:** emotional_neutrality < 4 ALWAYS produces QUARANTINED regardless of order.

### C2. CRITICAL: All dimensions null/undefined

If a brand new thesis has zero scores, `computeCompositeScore({})` should return composite=0 with 12 missing dimensions and `missingPenalty = 100 * 0.3 = 30`. But composite is `Math.max(0, 0 - 30) = 0`. **Verify:** no negative composite scores.

### C3. HIGH: Soft gate penalty overflows below IGNORE

With 14 soft failures (not realistic but possible if code changes), `floor(14/2)=7` level downgrade. From IGNORE(idx=0), `Math.max(0, 0-7)=0` → IGNORE. **Verify:** classification never goes below IGNORE (index 0).

### C4. HIGH: Stacked forced downgrades — lowest wins

If timing_precision=3 (→WATCH), AND data_freshness=3 (→DEVELOP), AND signal_quality=2 (→WATCH): The code iterates FORCED_DOWNGRADES in order. timing_precision caps at WATCH first, then data_freshness would cap at DEVELOP but WATCH < DEVELOP so no change, then signal_quality caps at WATCH (already there). **Verify:** The `lowerClassification` function correctly returns the lower of two states.

### C5. HIGH: Governor penalty cap_at vs routing rule interaction

If Rule F routes to DEVELOP_THESIS but both `one_source` (cap WATCH) and `market_already_priced` (cap LOG_ONLY) apply, the penalties process sequentially. After one_source, state is WATCH. After market_already_priced, WATCH(idx=2) > LOG_ONLY(idx=1), so state becomes LOG_ONLY. **Verify:** penalties correctly compound to the lowest cap.

### C6. MEDIUM: Bear case exactly 21 characters

The gate checks `strongest_bear_case.length > 20`. A 21-character string passes; a 20-character string fails. **Verify:** boundary is correct at 21 chars.

### C7. MEDIUM: Probability spread exactly 0.15

The gate checks `spread >= 0.15`. A spread of exactly 0.15 should pass. **Verify:** `>=` not `>`.

### C8. MEDIUM: Checklist with number answer = 0

`independent_signals: 0`. The code checks `num < item.warningThreshold (3)`. 0 < 3 is true → warning. But warnings don't block. **Verify:** 0 independent signals produces a warning but does NOT block execution via checklist.

### C9. MEDIUM: Governor escalation + penalty interaction

If escalation conditions are met AND penalties cap at LOG_ONLY, the escalation check (Step 4) requires `BOT_STATES.indexOf(recommended_state) >= BOT_STATES.indexOf('WATCH')`. LOG_ONLY is index 1, WATCH is index 2. 1 >= 2 is false. **Verify:** Escalation is blocked when state is below WATCH.

### C10. LOW: Score dimension = 10.5 (out of range)

`computeCompositeScore` clamps: `Math.max(0, Math.min(10, rawScore))`. 10.5 → 10. **Verify:** clamping works for all out-of-range values.

### C11. CRITICAL: getMaxPositionSize with unknown classification

If classification is misspelled or undefined, `POSITION_SIZING_RULES[undefined]` returns undefined. The function returns `{ maxDollars: 0, maxPercent: 0 }`. **Verify:** unknown classification = zero position size, never non-zero.

---

## D. Priority Automated Tests

### Tier 1 — Implement First (Action-State Safety)

These tests prevent real capital from being deployed incorrectly. A failure here means the system could allow trades it should block.

| Priority | Test IDs | Module | Why first |
|---|---|---|---|
| P0 | C-12 | classification | emotional_neutrality < 4 MUST produce QUARANTINED. This is the primary behavioral safeguard. |
| P0 | G-07, G-16 | gates | All 4 dangerous emotional states (excited/fomo/revenge/bored) MUST hard-block. |
| P0 | B-08, B-09, B-10 | behavioral | Position sizing MUST be 0 for all non-action states. |
| P0 | C-15 | classification | Any hard gate failure MUST cap at DEVELOP (no execution). |
| P0 | C-11 | classification | QUARANTINED overrides ALL other classifications. |
| P0 | Scenario 3 | integration | Full pipeline: FOMO → hard gate fail → QUARANTINED → $0 position size. |

### Tier 2 — Implement Second (Forced Downgrade Correctness)

| Priority | Test IDs | Module | Why second |
|---|---|---|---|
| P1 | C-09 through C-14 | classification | All 6 forced downgrade rules must fire at correct thresholds. |
| P1 | C-17, C-18 | classification | Assumption overload caps (>7→WATCH, >5→DEVELOP). |
| P1 | C-19 | classification | Stacked downgrades resolve to lowest. |
| P1 | Scenario 2 | integration | Missing disconfirmation → hard gate + forced downgrade → IGNORE. |
| P1 | Scenario 10 | integration | Score 90 + 8 assumptions → WATCH (not FULLY_QUALIFIED). |

### Tier 3 — Implement Third (Bot Governor Safety)

| Priority | Test IDs | Module | Why third |
|---|---|---|---|
| P2 | GOV-08, GOV-09 | governor | Single source and duplicate penalties must cap at WATCH. |
| P2 | GOV-10 | governor | Already-priced must cap at LOG_ONLY. |
| P2 | GOV-11 | governor | Red-team dominance (quality ≥ 7) must prevent promotion past WATCH. |
| P2 | GOV-13 | governor | Excitement-evidence imbalance must quarantine. |
| P2 | GOV-17 | governor | Governor NEVER upgrades — only caps/downgrades. |
| P2 | Scenario 5, 7, 8, 9 | integration | Already-priced, red-team dominance, stale data, excitement traps. |

### Tier 4 — Implement Fourth (Scoring Correctness)

| Priority | Test IDs | Module | Why fourth |
|---|---|---|---|
| P3 | S-01, S-02, S-03 | scoring | Perfect, zero, and missing-dimension cases. |
| P3 | S-04 | scoring | Clamping at boundaries. |
| P3 | S-06 | scoring | Weights sum to 100. |
| P3 | S-08, S-09 | scoring | Auto-score tier boundaries for freshness and timing. |

### Recommended test runner: Vitest

Already Vite-based. Add `vitest` as devDependency. Test files: `src/engine/__tests__/scoring.test.js`, `gates.test.js`, `classification.test.js`, `behavioral.test.js`, `server/bot/__tests__/governor.test.js`.

---

## E. Sample Fixtures Needed

### E1. Thesis Fixtures

```javascript
// fixtures/theses.js

export const COMPLETE_THESIS = {
  id: 'thesis-complete',
  title: 'Test thesis — fully validated',
  invalidating_indicators: ['CPI below 2%', 'Fed cuts 50bp'],
  invalidation_condition: 'Two consecutive CPI prints below 2.5%',
  disconfirming_evidence: ['Bond market prices 100bp cuts', 'Wage growth decelerating'],
  strongest_bear_case: 'Inflation is already moderating and the market knows it. Forward breakevens have been declining for 3 months.',
  what_would_make_opposite_stronger: 'If next CPI prints below 3% with core declining, the entire thesis collapses.',
  expected_timeline: { start: '2026-04-01', end: '2026-06-01', basis: 'FOMC cycle' },
  probability_low: 0.35,
  probability_high: 0.65,
  probability_best: 0.5,
  key_assumptions: ['CPI stays above 3%', 'Fed holds rates'],
  alternative_explanations: ['Seasonal adjustment errors', 'Supply-side normalization'],
  causal_chain: ['Sticky services inflation', 'Fed forced to hold', 'Long end reprices', 'Equity multiple compression'],
  created_at: '2026-03-01T00:00:00Z',
};

export const EMPTY_THESIS = {
  id: 'thesis-empty',
  title: 'Empty thesis',
  invalidating_indicators: [],
  disconfirming_evidence: [],
  strongest_bear_case: '',
  expected_timeline: {},
  probability_low: 0.5,
  probability_high: 0.55,
  key_assumptions: [],
  created_at: new Date().toISOString(),
};

export const OVERLOADED_THESIS = {
  id: 'thesis-overloaded',
  title: 'Too many assumptions',
  ...COMPLETE_THESIS,
  id: 'thesis-overloaded',
  key_assumptions: ['A1','A2','A3','A4','A5','A6','A7','A8'],
};

export const EMOTIONAL_THESIS = {
  ...COMPLETE_THESIS,
  id: 'thesis-emotional',
};
```

### E2. Score Fixtures

```javascript
// fixtures/scores.js

export const PERFECT_SCORES = {
  signal_quality: 10, signal_independence: 10, causal_chain_clarity: 10,
  market_mispricing_likelihood: 10, catalyst_visibility: 10, timing_precision: 10,
  expression_quality: 10, risk_containment: 10, disconfirmation_robustness: 10,
  emotional_neutrality: 10, data_freshness: 10, market_confirmation_divergence: 10,
};

export const ZERO_SCORES = {
  signal_quality: 0, signal_independence: 0, causal_chain_clarity: 0,
  market_mispricing_likelihood: 0, catalyst_visibility: 0, timing_precision: 0,
  expression_quality: 0, risk_containment: 0, disconfirmation_robustness: 0,
  emotional_neutrality: 0, data_freshness: 0, market_confirmation_divergence: 0,
};

export const BORDERLINE_SCORES = {
  signal_quality: 5, signal_independence: 5, causal_chain_clarity: 5,
  market_mispricing_likelihood: 5, catalyst_visibility: 5, timing_precision: 5,
  expression_quality: 5, risk_containment: 5, disconfirmation_robustness: 5,
  emotional_neutrality: 5, data_freshness: 5, market_confirmation_divergence: 5,
};
// composite = 5/10 * 100 = 50 → DEVELOP

export const LOW_EMOTIONAL_SCORES = {
  ...PERFECT_SCORES,
  emotional_neutrality: 3,  // triggers QUARANTINE forced downgrade
};

export const LOW_TIMING_SCORES = {
  ...PERFECT_SCORES,
  timing_precision: 3,  // caps at WATCH
};

export const LOW_DISCONFIRMATION_SCORES = {
  ...PERFECT_SCORES,
  disconfirmation_robustness: 3,  // caps at DEVELOP
};

export const LOW_RISK_SCORES = {
  ...PERFECT_SCORES,
  risk_containment: 4,  // caps at PAPER_TRADE
};

export const LOW_FRESHNESS_SCORES = {
  ...PERFECT_SCORES,
  data_freshness: 3,  // caps at DEVELOP
};

export const LOW_SIGNAL_QUALITY_SCORES = {
  ...PERFECT_SCORES,
  signal_quality: 2,  // caps at WATCH
};
```

### E3. Gate Input Fixtures

```javascript
// fixtures/gate-inputs.js

export const VALID_EXECUTION_PLAN = {
  expression_vehicle: 'TLT puts, June 2026 expiry',
  max_risk_dollars: 5000,
  max_risk_percent: 2,
};

export const EMPTY_EXECUTION_PLAN = null;

export const VALID_SIGNALS = (thesisId) => [
  { thesis_id: thesisId, status: 'linked', source_type: 'news_feed', category: 'central_bank_action' },
  { thesis_id: thesisId, status: 'linked', source_type: 'government_data', category: 'policy_shock' },
  { thesis_id: thesisId, status: 'linked', source_type: 'market_data', category: 'market_complacency' },
];

export const SINGLE_SIGNAL = (thesisId) => [
  { thesis_id: thesisId, status: 'linked', source_type: 'news_feed', category: 'other' },
];

export const PASSING_CHECKLIST = {
  opposite_case: true,
  invalidation_defined: 'If CPI drops below 2.5% for two consecutive months this is invalidated',
  timing_bounded: true,
  real_mispricing: 'measurable',
  clean_vehicle: true,
  risk_capped: true,
  independent_signals: 5,
  data_fresh: true,
  process_not_excitement: 'process',
  would_take_if_not_mine: true,
  early_vs_right: 'If breakevens drop below 2% without CPI confirmation, I am wrong not early',
  emotional_state: 'calm',
};

export const FOMO_CHECKLIST = { ...PASSING_CHECKLIST, emotional_state: 'fomo' };
export const EXCITED_CHECKLIST = { ...PASSING_CHECKLIST, emotional_state: 'excited' };
export const REVENGE_CHECKLIST = { ...PASSING_CHECKLIST, emotional_state: 'revenge' };
export const BORED_CHECKLIST = { ...PASSING_CHECKLIST, emotional_state: 'bored' };
export const ANXIOUS_CHECKLIST = { ...PASSING_CHECKLIST, emotional_state: 'anxious' };
```

### E4. Governor Input Fixtures

```javascript
// fixtures/governor-inputs.js

export const SINGLE_SOURCE_CLUSTER = {
  id: 'cluster-single',
  signal_count: 1,
  independent_source_count: 1,
  cluster_strength: 'weak',
  cluster_novelty: 0.4,
  confidence_range: { low: 0.1, high: 0.4, best: 0.25 },
};

export const STRONG_MULTI_SOURCE_CLUSTER = {
  id: 'cluster-strong',
  signal_count: 5,
  independent_source_count: 4,
  cluster_strength: 'strong',
  cluster_novelty: 0.5,
  confidence_range: { low: 0.4, high: 0.7, best: 0.6 },
};

export const DUPLICATE_INFLATED_CLUSTER = {
  id: 'cluster-dupes',
  signal_count: 10,
  independent_source_count: 2,
  cluster_strength: 'moderate',
  cluster_novelty: 0.5,
  duplicate_penalty_applied: false,
  confidence_range: { low: 0.3, high: 0.6, best: 0.45 },
};

export const EXCITING_THIN_CLUSTER = {
  id: 'cluster-exciting',
  signal_count: 2,
  independent_source_count: 2,
  cluster_strength: 'emerging',
  cluster_novelty: 0.85,
  confidence_range: { low: 0.2, high: 0.5, best: 0.35 },
};

export const FULLY_REPRICED_MISPRICING = {
  market_reaction_state: 'fully_repriced',
  implied_mispricing_likelihood: 0.1,
  stale_data_penalty_applied: false,
};

export const STALE_MISPRICING = {
  market_reaction_state: 'no_reaction',
  implied_mispricing_likelihood: 0.5,
  stale_data_penalty_applied: true,
  data_freshness_hours: 52,
};

export const PLAUSIBLE_MISPRICING = {
  market_reaction_state: 'early_reaction',
  implied_mispricing_likelihood: 0.5,
  stale_data_penalty_applied: false,
};

export const STRONG_PATTERN = {
  match_score: 0.7,
  pattern_name: 'energy_chokepoint_disruption',
  missing_confirmations: ['insurance rate spike'],
};

export const WEAK_COUNTER = {
  reasoning_quality_score: 3,
  strongest_opposing_case: 'Unlikely to escalate based on historical precedent and current diplomatic activity.',
};

export const DOMINANT_COUNTER = {
  reasoning_quality_score: 8,
  strongest_opposing_case: 'The evidence relies entirely on a single leaked document with no independent verification. Historical parallel is weak — the 2019 case had 5 additional precursors absent here.',
  circular_logic_detected: false,
};
```

### E5. Checklist Answer Fixtures

(Already included in E3 above as PASSING_CHECKLIST, FOMO_CHECKLIST, etc.)

### File Layout

```
tests/
  fixtures/
    theses.js
    scores.js
    gate-inputs.js
    governor-inputs.js
  engine/
    scoring.test.js        # S-01 through S-11
    gates.test.js          # G-01 through G-17
    classification.test.js # C-01 through C-20
    behavioral.test.js     # B-01 through B-10
  bot/
    governor.test.js       # GOV-01 through GOV-17
  integration/
    scenarios.test.js      # Scenarios 1-10
  edge-cases/
    edge-cases.test.js     # C1-C11 edge cases
```
