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
  res.json(rows.map(parseJsonFields));
});

// GET single thesis
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM theses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Thesis not found' });
  res.json(parseJsonFields(row));
});

// POST create thesis
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const t = req.body;

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
    return res.status(500).json({ error: err.message });
  }

  const created = db.prepare('SELECT * FROM theses WHERE id = ?').get(id);
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
      score_signal_quality = COALESCE(?, score_signal_quality),
      score_signal_independence = COALESCE(?, score_signal_independence),
      score_market_mispricing = COALESCE(?, score_market_mispricing),
      score_causal_clarity = COALESCE(?, score_causal_clarity),
      score_catalyst_visibility = COALESCE(?, score_catalyst_visibility),
      score_timing_precision = COALESCE(?, score_timing_precision),
      score_expression_quality = COALESCE(?, score_expression_quality),
      score_risk_containment = COALESCE(?, score_risk_containment),
      score_disconfirmation_robustness = COALESCE(?, score_disconfirmation_robustness),
      score_emotional_neutrality = COALESCE(?, score_emotional_neutrality),
      composite_score = COALESCE(?, composite_score),
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
    t.score_signal_quality, t.score_signal_independence, t.score_market_mispricing,
    t.score_causal_clarity, t.score_catalyst_visibility, t.score_timing_precision,
    t.score_expression_quality, t.score_risk_containment, t.score_disconfirmation_robustness,
    t.score_emotional_neutrality, t.composite_score,
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
