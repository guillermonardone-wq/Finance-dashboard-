// ============================================================
// SIGNAL REPOSITORY — DB access layer for signals
// ============================================================

import { getDb } from './connection.js';

const JSON_PARSE_FIELDS = ['related_signal_ids', 'tags'];

function parseJson(row) {
  if (!row) return row;
  const parsed = { ...row };
  for (const f of JSON_PARSE_FIELDS) {
    if (parsed[f] && typeof parsed[f] === 'string') {
      try { parsed[f] = JSON.parse(parsed[f]); } catch {}
    }
  }
  return parsed;
}

export function findAll({ status, category, thesis_id } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM signals WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (thesis_id) { sql += ' AND thesis_id = ?'; params.push(thesis_id); }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...params).map(parseJson);
}

export function findById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM signals WHERE id = ?').get(id);
  return row ? parseJson(row) : null;
}

export function countsByStatus() {
  const db = getDb();
  const rows = db.prepare('SELECT status, COUNT(*) as count FROM signals GROUP BY status').all();
  const counts = {};
  for (const row of rows) counts[row.status] = row.count;
  return counts;
}

export function create(id, data) {
  const db = getDb();
  const now = new Date().toISOString();
  const s = data;

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

  return findById(id);
}

export function update(id, data) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM signals WHERE id = ?').get(id);
  if (!existing) return null;

  const s = data;
  const now = new Date().toISOString();
  const hasExplicitThesisId = 'thesis_id' in s;

  db.prepare(`
    UPDATE signals SET
      updated_at = ?, category = COALESCE(?, category), subcategory = COALESCE(?, subcategory),
      title = COALESCE(?, title), description = COALESCE(?, description),
      raw_source = COALESCE(?, raw_source), source_type = COALESCE(?, source_type),
      source_provider = COALESCE(?, source_provider), source_url = COALESCE(?, source_url),
      source_attribution = COALESCE(?, source_attribution),
      novelty = COALESCE(?, novelty), reliability = COALESCE(?, reliability),
      signal_strength = COALESCE(?, signal_strength),
      thesis_id = ${hasExplicitThesisId ? '?' : 'thesis_id'},
      related_signal_ids = COALESCE(?, related_signal_ids),
      status = COALESCE(?, status),
      tags = COALESCE(?, tags)
    WHERE id = ?
  `).run(
    now, s.category, s.subcategory, s.title, s.description,
    s.raw_source, s.source_type, s.source_provider, s.source_url, s.source_attribution,
    s.novelty, s.reliability, s.signal_strength,
    ...(hasExplicitThesisId ? [s.thesis_id] : []),
    s.related_signal_ids ? JSON.stringify(s.related_signal_ids) : null,
    s.status,
    s.tags ? JSON.stringify(s.tags) : null,
    id
  );

  return findById(id);
}

export function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM signals WHERE id = ?').run(id);
}
