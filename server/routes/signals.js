import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';

const router = Router();

// GET all signals
router.get('/', (req, res) => {
  const db = getDb();
  const { status, category, thesis_id } = req.query;
  let sql = 'SELECT * FROM signals WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (thesis_id) { sql += ' AND thesis_id = ?'; params.push(thesis_id); }
  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => parseJson(r, ['related_signal_ids', 'tags'])));
});

// GET single signal
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM signals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Signal not found' });
  res.json(parseJson(row, ['related_signal_ids', 'tags']));
});

// POST create signal
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const s = req.body;

  // Validate required fields
  if (!s || !s.title || !s.title.trim()) {
    return res.status(400).json({ error: 'Signal title is required.' });
  }
  if (!s.description || !s.description.trim()) {
    return res.status(400).json({ error: 'Signal description is required.' });
  }
  if (!s.category || !s.category.trim()) {
    return res.status(400).json({ error: 'Signal category is required.' });
  }

  try {
    db.prepare(`
      INSERT INTO signals (
        id, created_at, updated_at, category, subcategory,
        title, description, raw_source, source_type, source_provider,
        source_url, source_attribution, novelty, reliability, signal_strength,
        thesis_id, related_signal_ids, status, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, now, now, s.category.trim(), s.subcategory || null,
      s.title.trim(), s.description.trim(), s.raw_source || null,
      s.source_type || 'manual', s.source_provider || null,
      s.source_url || null, s.source_attribution || 'Manual entry',
      s.novelty || 'unknown', s.reliability || 'unverified',
      s.signal_strength != null ? s.signal_strength : null,
      s.thesis_id || null,
      JSON.stringify(s.related_signal_ids || []),
      s.status || 'inbox',
      JSON.stringify(s.tags || [])
    );
  } catch (err) {
    console.error(`[Signals] POST / — DB INSERT FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }

  const created = db.prepare('SELECT * FROM signals WHERE id = ?').get(id);
  if (!created) {
    console.error(`[Signals] POST / — INSERT succeeded but SELECT returned null for id=${id}`);
    return res.status(500).json({ error: 'Signal was not saved — database write failed silently.' });
  }
  res.status(201).json(parseJson(created, ['related_signal_ids', 'tags']));
});

// PUT update signal
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM signals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Signal not found' });

  const s = req.body;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      UPDATE signals SET
        updated_at = ?, category = COALESCE(?, category), subcategory = COALESCE(?, subcategory),
        title = COALESCE(?, title), description = COALESCE(?, description),
        raw_source = COALESCE(?, raw_source), source_type = COALESCE(?, source_type),
        source_provider = COALESCE(?, source_provider), source_url = COALESCE(?, source_url),
        source_attribution = COALESCE(?, source_attribution),
        novelty = COALESCE(?, novelty), reliability = COALESCE(?, reliability),
        signal_strength = COALESCE(?, signal_strength),
        thesis_id = COALESCE(?, thesis_id),
        related_signal_ids = COALESCE(?, related_signal_ids),
        status = COALESCE(?, status),
        tags = COALESCE(?, tags)
      WHERE id = ?
    `).run(
      now, s.category, s.subcategory, s.title, s.description,
      s.raw_source, s.source_type, s.source_provider, s.source_url, s.source_attribution,
      s.novelty, s.reliability, s.signal_strength,
      s.thesis_id,
      s.related_signal_ids ? JSON.stringify(s.related_signal_ids) : null,
      s.status,
      s.tags ? JSON.stringify(s.tags) : null,
      req.params.id
    );
  } catch (err) {
    console.error(`[Signals] PUT /${req.params.id} — DB UPDATE FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }

  const updated = db.prepare('SELECT * FROM signals WHERE id = ?').get(req.params.id);
  res.json(parseJson(updated, ['related_signal_ids', 'tags']));
});

// DELETE signal
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM signals WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

function parseJson(row, fields) {
  if (!row) return row;
  const parsed = { ...row };
  for (const f of fields) {
    if (parsed[f] && typeof parsed[f] === 'string') {
      try { parsed[f] = JSON.parse(parsed[f]); } catch {}
    }
  }
  return parsed;
}

export default router;
