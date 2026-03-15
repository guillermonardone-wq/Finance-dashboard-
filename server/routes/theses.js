import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

// GET all theses (with optional filters)
router.get('/', (req, res) => {
  const db = getDb();
  const { status, classification } = req.query;
  let sql = 'SELECT * FROM theses WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (classification) { sql += ' AND classification = ?'; params.push(classification); }
  sql += ' ORDER BY updated_at DESC';

  const rows = db.prepare(sql).all(...params);
  console.log(`[Theses] GET / — filters: status=${status || 'all'}, returned ${rows.length} theses`);
  res.json(rows.map(parseJsonFields));
});

// GET single thesis
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM theses WHERE id = ?').get(req.params.id);
  if (!row) {
    console.log(`[Theses] GET /${req.params.id} — NOT FOUND`);
    return res.status(404).json({ error: 'Thesis not found' });
  }
  console.log(`[Theses] GET /${req.params.id} — found: "${row.title}"`);
  res.json(parseJsonFields(row));
});

// POST create thesis
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const t = req.body;

  console.log(`[Theses] POST / — title="${t?.title}", status="${t?.status}"`);

  if (!t || !t.title || !t.thesis_statement) {
    console.log('[Theses] POST / — REJECTED: missing title or thesis_statement');
    return res.status(400).json({ error: 'Title and thesis statement are required.' });
  }

  // Draft theses skip behavioral gates — rigor is enforced at classification upgrade
  const isDraft = (t.status || 'draft') === 'draft';

  if (!isDraft) {
    // Validate mandatory disconfirmation fields
    if (!t.disconfirming_evidence || !t.strongest_bear_case || !t.what_would_make_opposite_stronger) {
      return res.status(400).json({
        error: 'BEHAVIORAL GATE: You must provide disconfirming evidence, the strongest bear case, and what would make the opposite case stronger. No shortcuts.',
      });
    }

    // Validate probability range
    if (t.probability_best <= 0 || t.probability_best >= 1) {
      return res.status(400).json({
        error: 'BEHAVIORAL GATE: Probability must be between 0 and 1 exclusive. Certainty language is not allowed.',
      });
    }
  }

  try {
    db.prepare(`
      INSERT INTO theses (
        id, created_at, updated_at, title, thesis_statement, causal_chain,
        affected_assets, expected_timeline, probability_low, probability_high, probability_best,
        market_pricing_assessment, key_assumptions, alternative_explanations,
        leading_indicators, confirming_indicators, invalidating_indicators,
        coincident_indicators, lagging_indicators,
        disconfirming_evidence, strongest_bear_case, what_would_make_opposite_stronger,
        early_vs_right, status, classification, tags
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      id, now, now, t.title, t.thesis_statement,
      JSON.stringify(t.causal_chain || []),
      JSON.stringify(t.affected_assets || []),
      JSON.stringify(t.expected_timeline || {}),
      t.probability_low ?? 0.2, t.probability_high ?? 0.6, t.probability_best ?? 0.4,
      JSON.stringify(t.market_pricing_assessment || {}),
      JSON.stringify(t.key_assumptions || []),
      JSON.stringify(t.alternative_explanations || []),
      JSON.stringify(t.leading_indicators || []),
      JSON.stringify(t.confirming_indicators || []),
      JSON.stringify(t.invalidating_indicators || []),
      JSON.stringify(t.coincident_indicators || []),
      JSON.stringify(t.lagging_indicators || []),
      JSON.stringify(t.disconfirming_evidence || []),
      t.strongest_bear_case || '',
      t.what_would_make_opposite_stronger || '',
      t.early_vs_right || null,
      t.status || 'draft',
      t.classification || 'WATCH',
      JSON.stringify(t.tags || [])
    );
  } catch (err) {
    console.error(`[Theses] POST / — DB INSERT FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }

  const created = db.prepare('SELECT * FROM theses WHERE id = ?').get(id);
  if (!created) {
    console.error(`[Theses] POST / — INSERT succeeded but SELECT returned null for id=${id}`);
    return res.status(500).json({ error: 'Thesis was not saved — database write failed silently.' });
  }
  console.log(`[Theses] POST / — CREATED id=${id}`);
  res.status(201).json(parseJsonFields(created));
});

// PUT update thesis
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM theses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Thesis not found' });

  const t = req.body;
  const now = new Date().toISOString();

  // Track classification changes
  let prevClassifications = [];
  try { prevClassifications = JSON.parse(existing.previous_classifications || '[]'); } catch {}
  if (t.classification && t.classification !== existing.classification) {
    prevClassifications.push({
      date: now,
      from: existing.classification,
      to: t.classification,
      reason: t.classification_reason || 'manual change',
    });
  }

  // Set calibration snapshot on first scoring
  let scoreAtCreation = existing.score_at_creation;
  let classificationAtCreation = existing.classification_at_creation;
  if (t.composite_score != null && scoreAtCreation == null) {
    scoreAtCreation = t.composite_score;
    classificationAtCreation = t.classification || existing.classification;
  }

  // Set score_at_approval when transitioning to approved
  let scoreAtApproval = existing.score_at_approval;
  if (t.status === 'approved' && existing.status !== 'approved' && t.composite_score != null) {
    scoreAtApproval = t.composite_score;
  }

  db.prepare(`
    UPDATE theses SET
      updated_at = ?, title = COALESCE(?, title), thesis_statement = COALESCE(?, thesis_statement),
      causal_chain = COALESCE(?, causal_chain), affected_assets = COALESCE(?, affected_assets),
      expected_timeline = COALESCE(?, expected_timeline),
      probability_low = COALESCE(?, probability_low), probability_high = COALESCE(?, probability_high),
      probability_best = COALESCE(?, probability_best),
      market_pricing_assessment = COALESCE(?, market_pricing_assessment),
      key_assumptions = COALESCE(?, key_assumptions),
      alternative_explanations = COALESCE(?, alternative_explanations),
      leading_indicators = COALESCE(?, leading_indicators),
      confirming_indicators = COALESCE(?, confirming_indicators),
      invalidating_indicators = COALESCE(?, invalidating_indicators),
      coincident_indicators = COALESCE(?, coincident_indicators),
      lagging_indicators = COALESCE(?, lagging_indicators),
      disconfirming_evidence = COALESCE(?, disconfirming_evidence),
      strongest_bear_case = COALESCE(?, strongest_bear_case),
      what_would_make_opposite_stronger = COALESCE(?, what_would_make_opposite_stronger),
      early_vs_right = COALESCE(?, early_vs_right),

      -- Evidence layer scores
      score_signal_quality = COALESCE(?, score_signal_quality),
      score_signal_independence = COALESCE(?, score_signal_independence),
      score_evidence_freshness = COALESCE(?, score_evidence_freshness),
      score_data_reliability = COALESCE(?, score_data_reliability),
      score_evidence_quantity = COALESCE(?, score_evidence_quantity),
      score_evidence_layer = COALESCE(?, score_evidence_layer),

      -- Structure layer scores
      score_causal_chain_clarity = COALESCE(?, score_causal_chain_clarity),
      score_internal_consistency = COALESCE(?, score_internal_consistency),
      score_counter_case_robustness = COALESCE(?, score_counter_case_robustness),
      score_assumption_load = COALESCE(?, score_assumption_load),
      score_timing_clarity = COALESCE(?, score_timing_clarity),
      score_structure_layer = COALESCE(?, score_structure_layer),

      -- Market Edge layer scores
      score_market_awareness = COALESCE(?, score_market_awareness),
      score_prediction_market_divergence = COALESCE(?, score_prediction_market_divergence),
      score_asset_reaction_gaps = COALESCE(?, score_asset_reaction_gaps),
      score_liquidity_sensitivity = COALESCE(?, score_liquidity_sensitivity),
      score_catalyst_clarity = COALESCE(?, score_catalyst_clarity),
      score_market_edge_layer = COALESCE(?, score_market_edge_layer),

      -- Composite, penalties, confidence
      composite_score = COALESCE(?, composite_score),
      penalty_total = COALESCE(?, penalty_total),
      penalty_details = COALESCE(?, penalty_details),
      confidence_level = COALESCE(?, confidence_level),
      confidence_factors = COALESCE(?, confidence_factors),

      -- Calibration
      score_at_creation = COALESCE(?, score_at_creation),
      score_at_approval = COALESCE(?, score_at_approval),
      classification_at_creation = COALESCE(?, classification_at_creation),
      final_outcome = COALESCE(?, final_outcome),

      -- Classification and status
      classification = COALESCE(?, classification),
      classification_reason = COALESCE(?, classification_reason),
      previous_classifications = ?,
      status = COALESCE(?, status),
      quarantine_reason = COALESCE(?, quarantine_reason),
      quarantine_until = COALESCE(?, quarantine_until),
      tags = COALESCE(?, tags)
    WHERE id = ?
  `).run(
    now, t.title, t.thesis_statement,
    t.causal_chain ? JSON.stringify(t.causal_chain) : null,
    t.affected_assets ? JSON.stringify(t.affected_assets) : null,
    t.expected_timeline ? JSON.stringify(t.expected_timeline) : null,
    t.probability_low, t.probability_high, t.probability_best,
    t.market_pricing_assessment ? JSON.stringify(t.market_pricing_assessment) : null,
    t.key_assumptions ? JSON.stringify(t.key_assumptions) : null,
    t.alternative_explanations ? JSON.stringify(t.alternative_explanations) : null,
    t.leading_indicators ? JSON.stringify(t.leading_indicators) : null,
    t.confirming_indicators ? JSON.stringify(t.confirming_indicators) : null,
    t.invalidating_indicators ? JSON.stringify(t.invalidating_indicators) : null,
    t.coincident_indicators ? JSON.stringify(t.coincident_indicators) : null,
    t.lagging_indicators ? JSON.stringify(t.lagging_indicators) : null,
    t.disconfirming_evidence ? JSON.stringify(t.disconfirming_evidence) : null,
    t.strongest_bear_case, t.what_would_make_opposite_stronger, t.early_vs_right,

    // Evidence layer
    t.score_signal_quality, t.score_signal_independence,
    t.score_evidence_freshness, t.score_data_reliability,
    t.score_evidence_quantity, t.score_evidence_layer,

    // Structure layer
    t.score_causal_chain_clarity, t.score_internal_consistency,
    t.score_counter_case_robustness, t.score_assumption_load,
    t.score_timing_clarity, t.score_structure_layer,

    // Market Edge layer
    t.score_market_awareness, t.score_prediction_market_divergence,
    t.score_asset_reaction_gaps, t.score_liquidity_sensitivity,
    t.score_catalyst_clarity, t.score_market_edge_layer,

    // Composite, penalties, confidence
    t.composite_score,
    t.penalty_total,
    t.penalty_details ? JSON.stringify(t.penalty_details) : null,
    t.confidence_level,
    t.confidence_factors ? JSON.stringify(t.confidence_factors) : null,

    // Calibration
    scoreAtCreation, scoreAtApproval, classificationAtCreation,
    t.final_outcome ? JSON.stringify(t.final_outcome) : null,

    // Classification and status
    t.classification, t.classification_reason,
    JSON.stringify(prevClassifications),
    t.status, t.quarantine_reason, t.quarantine_until,
    t.tags ? JSON.stringify(t.tags) : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM theses WHERE id = ?').get(req.params.id);
  res.json(parseJsonFields(updated));
});

// DELETE thesis
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM theses WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// Parse JSON fields from DB row
function parseJsonFields(row) {
  if (!row) return row;
  const jsonFields = [
    'causal_chain', 'affected_assets', 'expected_timeline', 'market_pricing_assessment',
    'key_assumptions', 'alternative_explanations', 'leading_indicators', 'confirming_indicators',
    'invalidating_indicators', 'coincident_indicators', 'lagging_indicators',
    'disconfirming_evidence', 'previous_classifications', 'tags',
    'penalty_details', 'confidence_factors', 'final_outcome',
  ];
  const parsed = { ...row };
  for (const field of jsonFields) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try { parsed[field] = JSON.parse(parsed[field]); } catch { /* leave as string */ }
    }
  }
  return parsed;
}

export default router;
