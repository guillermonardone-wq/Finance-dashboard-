// ============================================================
// PREDICTION MARKET SERVICE — Database operations
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/connection.js';
import { predictionMarketAdapter } from './adapter.js';
import { computeAssessment, computeScoringHelpers } from './assessment.js';

// ---- PROVIDERS ----

export function getProviders() {
  return getDb().prepare('SELECT * FROM prediction_market_providers ORDER BY name').all();
}

export function getProvider(id) {
  return getDb().prepare('SELECT * FROM prediction_market_providers WHERE id = ?').get(id);
}

export function createProvider({ name, provider_key, base_url }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO prediction_market_providers (id, name, provider_key, base_url, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)`).run(id, name, provider_key, base_url || null, now, now);
  return getDb().prepare('SELECT * FROM prediction_market_providers WHERE id = ?').get(id);
}

// ---- EVENTS ----

export function getEvents(filters = {}) {
  let sql = 'SELECT e.*, p.name as provider_name FROM prediction_market_events e JOIN prediction_market_providers p ON e.provider_id = p.id WHERE 1=1';
  const params = [];

  if (filters.provider_id) { sql += ' AND e.provider_id = ?'; params.push(filters.provider_id); }
  if (filters.category) { sql += ' AND e.category = ?'; params.push(filters.category); }
  if (filters.status) { sql += ' AND e.status = ?'; params.push(filters.status); }
  sql += ' ORDER BY e.updated_at DESC';

  return getDb().prepare(sql).all(...params);
}

export function getEvent(id) {
  return getDb().prepare(`SELECT e.*, p.name as provider_name
    FROM prediction_market_events e
    JOIN prediction_market_providers p ON e.provider_id = p.id
    WHERE e.id = ?`).get(id);
}

export function createEvent(data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO prediction_market_events
    (id, provider_id, external_market_id, title, description, url, category, status,
     open_time, close_time, resolution_time, market_type, tags_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, data.provider_id, data.external_market_id || null,
    data.title, data.description || null, data.url || null,
    data.category || null, data.status || 'open',
    data.open_time || null, data.close_time || null, data.resolution_time || null,
    data.market_type || 'binary', JSON.stringify(data.tags || []),
    now, now
  );
  return getEvent(id);
}

export function updateEvent(id, data) {
  const now = new Date().toISOString();
  getDb().prepare(`UPDATE prediction_market_events SET
    title = COALESCE(?, title), description = COALESCE(?, description),
    url = COALESCE(?, url), category = COALESCE(?, category),
    status = COALESCE(?, status), close_time = COALESCE(?, close_time),
    resolution_time = COALESCE(?, resolution_time), updated_at = ?
    WHERE id = ?`).run(
    data.title, data.description, data.url, data.category,
    data.status, data.close_time, data.resolution_time, now, id
  );
  return getEvent(id);
}

// ---- SNAPSHOTS ----

export function getSnapshots(eventId, limit = 50) {
  return getDb().prepare(`SELECT * FROM prediction_market_snapshots
    WHERE prediction_market_event_id = ?
    ORDER BY observed_at DESC LIMIT ?`).all(eventId, limit);
}

export function getLatestSnapshot(eventId) {
  return getDb().prepare(`SELECT * FROM prediction_market_snapshots
    WHERE prediction_market_event_id = ?
    ORDER BY observed_at DESC LIMIT 1`).get(eventId);
}

export function createSnapshot(data) {
  const id = uuidv4();
  const normalized = predictionMarketAdapter.normalizeSnapshot(data, data.prediction_market_event_id);
  const isStale = predictionMarketAdapter.isStale(normalized.observed_at) ? 1 : 0;

  getDb().prepare(`INSERT INTO prediction_market_snapshots
    (id, prediction_market_event_id, observed_at, yes_price, no_price, implied_probability,
     volume_24h, liquidity, spread, source_attribution, raw_payload_ref, is_stale, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, normalized.prediction_market_event_id, normalized.observed_at,
    normalized.yes_price, normalized.no_price, normalized.implied_probability,
    normalized.volume_24h, normalized.liquidity, normalized.spread,
    normalized.source_attribution, normalized.raw_payload_ref, isStale,
    new Date().toISOString()
  );

  return getDb().prepare('SELECT * FROM prediction_market_snapshots WHERE id = ?').get(id);
}

// ---- LINKS ----

export function getLinksForThesis(thesisId) {
  const links = getDb().prepare(`SELECT l.*, e.title as event_title, e.description as event_description,
    e.url as event_url, e.status as event_status, e.category as event_category,
    p.name as provider_name
    FROM thesis_prediction_links l
    JOIN prediction_market_events e ON l.prediction_market_event_id = e.id
    JOIN prediction_market_providers p ON e.provider_id = p.id
    WHERE l.thesis_id = ?
    ORDER BY l.link_confidence DESC`).all(thesisId);

  // Attach latest snapshot to each link
  for (const link of links) {
    link.latest_snapshot = getLatestSnapshot(link.prediction_market_event_id) || null;
  }

  return links;
}

export function getLinksForEvent(eventId) {
  return getDb().prepare(`SELECT l.*, t.title as thesis_title
    FROM thesis_prediction_links l
    JOIN theses t ON l.thesis_id = t.id
    WHERE l.prediction_market_event_id = ?`).all(eventId);
}

export function createLink(data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO thesis_prediction_links
    (id, thesis_id, prediction_market_event_id, link_confidence, link_type,
     wording_match_score, wording_mismatch_flag, rationale, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, data.thesis_id, data.prediction_market_event_id,
    data.link_confidence ?? 0.3, data.link_type || 'partial_match',
    data.wording_match_score ?? 0.5, data.wording_mismatch_flag ? 1 : 0,
    data.rationale || null, now, now
  );
  return getDb().prepare('SELECT * FROM thesis_prediction_links WHERE id = ?').get(id);
}

export function updateLink(id, data) {
  const now = new Date().toISOString();
  getDb().prepare(`UPDATE thesis_prediction_links SET
    link_confidence = COALESCE(?, link_confidence),
    link_type = COALESCE(?, link_type),
    wording_match_score = COALESCE(?, wording_match_score),
    wording_mismatch_flag = COALESCE(?, wording_mismatch_flag),
    rationale = COALESCE(?, rationale),
    updated_at = ?
    WHERE id = ?`).run(
    data.link_confidence, data.link_type, data.wording_match_score,
    data.wording_mismatch_flag != null ? (data.wording_mismatch_flag ? 1 : 0) : null,
    data.rationale, now, id
  );
  return getDb().prepare('SELECT * FROM thesis_prediction_links WHERE id = ?').get(id);
}

export function deleteLink(id) {
  getDb().prepare('DELETE FROM thesis_prediction_links WHERE id = ?').run(id);
}

// ---- ASSESSMENTS ----

export function computeAndStoreAssessment(thesisId) {
  const db = getDb();
  const thesis = db.prepare('SELECT * FROM theses WHERE id = ?').get(thesisId);
  if (!thesis) return null;

  // Parse JSON fields
  const parsed = { ...thesis };
  try { parsed.probability_low = thesis.probability_low; } catch {}
  try { parsed.probability_high = thesis.probability_high; } catch {}

  const links = getLinksForThesis(thesisId);
  const assessment = computeAssessment(parsed, links);
  const helpers = computeScoringHelpers(assessment);

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO prediction_market_assessments
    (id, thesis_id, assessed_at, thesis_probability_low, thesis_probability_high,
     prediction_market_implied_probability, divergence_score, consensus_state,
     wording_warning, liquidity_warning, thin_market_penalty, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, thesisId, now,
    assessment.thesis_probability_low, assessment.thesis_probability_high,
    assessment.prediction_market_implied_probability,
    assessment.divergence_score, assessment.consensus_state,
    assessment.wording_warning ? 1 : 0, assessment.liquidity_warning ? 1 : 0,
    assessment.thin_market_penalty, assessment.notes, now
  );

  return {
    assessment: { id, ...assessment },
    scoring_helpers: helpers,
    contracts: assessment.contracts,
  };
}

export function getAssessmentsForThesis(thesisId, limit = 10) {
  return getDb().prepare(`SELECT * FROM prediction_market_assessments
    WHERE thesis_id = ? ORDER BY assessed_at DESC LIMIT ?`).all(thesisId, limit);
}

export function getLatestAssessment(thesisId) {
  return getDb().prepare(`SELECT * FROM prediction_market_assessments
    WHERE thesis_id = ? ORDER BY assessed_at DESC LIMIT 1`).get(thesisId);
}
