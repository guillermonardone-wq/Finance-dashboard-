import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

const JSON_FIELDS = [
  'signals_that_mattered', 'signals_that_were_noise', 'signals_missed',
  'process_violations', 'playbook_additions', 'rule_changes',
];

// GET all reviews
router.get('/', (req, res) => {
  const db = getDb();
  const { thesis_id } = req.query;
  let sql = 'SELECT * FROM reviews WHERE 1=1';
  const params = [];
  if (thesis_id) { sql += ' AND thesis_id = ?'; params.push(thesis_id); }
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => parseJson(r)));
});

// GET single review
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Review not found' });
  res.json(parseJson(row));
});

// POST create review
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const r = req.body;

  // Force process honesty
  if (r.process_followed === undefined || r.process_followed === null) {
    return res.status(400).json({
      error: 'REVIEW GATE: You must explicitly answer whether process was followed. Honest post-mortems are mandatory.',
    });
  }
  if (!r.lessons_learned || r.lessons_learned.trim().length < 20) {
    return res.status(400).json({
      error: 'REVIEW GATE: Lessons learned must be substantive (>20 chars). Shallow reviews defeat the purpose.',
    });
  }

  db.prepare(`
    INSERT INTO reviews (
      id, thesis_id, trade_id, created_at, outcome, outcome_description,
      signals_that_mattered, signals_that_were_noise, signals_missed,
      process_followed, process_violations, sizing_appropriate,
      timing_appropriate, early_confirmation_accurate,
      emotional_state_during, overconfidence_detected,
      narrative_attachment_detected, confirmation_bias_detected,
      lessons_learned, playbook_additions, rule_changes,
      process_score, analysis_score, execution_score, overall_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, r.thesis_id, r.trade_id || null, now,
    r.outcome, r.outcome_description,
    JSON.stringify(r.signals_that_mattered || []),
    JSON.stringify(r.signals_that_were_noise || []),
    JSON.stringify(r.signals_missed || []),
    r.process_followed ? 1 : 0,
    JSON.stringify(r.process_violations || []),
    r.sizing_appropriate != null ? (r.sizing_appropriate ? 1 : 0) : null,
    r.timing_appropriate != null ? (r.timing_appropriate ? 1 : 0) : null,
    r.early_confirmation_accurate != null ? (r.early_confirmation_accurate ? 1 : 0) : null,
    r.emotional_state_during || null,
    r.overconfidence_detected ? 1 : 0,
    r.narrative_attachment_detected ? 1 : 0,
    r.confirmation_bias_detected ? 1 : 0,
    r.lessons_learned,
    JSON.stringify(r.playbook_additions || []),
    JSON.stringify(r.rule_changes || []),
    r.process_score, r.analysis_score, r.execution_score, r.overall_score
  );

  const created = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  res.status(201).json(parseJson(created));
});

function parseJson(row) {
  if (!row) return row;
  const parsed = { ...row };
  for (const f of JSON_FIELDS) {
    if (parsed[f] && typeof parsed[f] === 'string') {
      try { parsed[f] = JSON.parse(parsed[f]); } catch {}
    }
  }
  return parsed;
}

export default router;
