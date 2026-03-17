// ============================================================
// PREDICTION MARKET SERVICE — Database operations (Knex)
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../../db/connection.js";
import { predictionMarketAdapter } from "./adapter.js";
import { computeAssessment, computeScoringHelpers } from "./assessment.js";

// ---- PROVIDERS ----

export async function getProviders() {
  return getKnex()("prediction_market_providers").orderBy("name");
}

export async function getProvider(id) {
  return getKnex()("prediction_market_providers").where("id", id).first();
}

export async function createProvider({ name, provider_key, base_url }) {
  const knex = getKnex();
  const id = uuidv4();
  const now = new Date().toISOString();
  await knex("prediction_market_providers").insert({
    id,
    name,
    provider_key,
    base_url: base_url || null,
    active: true,
    created_at: now,
    updated_at: now,
  });
  return knex("prediction_market_providers").where("id", id).first();
}

// ---- EVENTS ----

export async function getEvents(filters = {}) {
  const knex = getKnex();
  let query = knex("prediction_market_events as e")
    .join("prediction_market_providers as p", "e.provider_id", "p.id")
    .select("e.*", "p.name as provider_name");

  if (filters.provider_id) query = query.where("e.provider_id", filters.provider_id);
  if (filters.category) query = query.where("e.category", filters.category);
  if (filters.status) query = query.where("e.status", filters.status);

  return query.orderBy("e.updated_at", "desc");
}

export async function getEvent(id) {
  return getKnex()("prediction_market_events as e")
    .join("prediction_market_providers as p", "e.provider_id", "p.id")
    .select("e.*", "p.name as provider_name")
    .where("e.id", id)
    .first();
}

export async function createEvent(data) {
  const knex = getKnex();
  const id = uuidv4();
  const now = new Date().toISOString();
  await knex("prediction_market_events").insert({
    id,
    provider_id: data.provider_id,
    external_market_id: data.external_market_id || null,
    title: data.title,
    description: data.description || null,
    url: data.url || null,
    category: data.category || null,
    status: data.status || "open",
    open_time: data.open_time || null,
    close_time: data.close_time || null,
    resolution_time: data.resolution_time || null,
    market_type: data.market_type || "binary",
    tags_json: data.tags || [],
    created_at: now,
    updated_at: now,
  });
  return getEvent(id);
}

export async function updateEvent(id, data) {
  const knex = getKnex();
  const now = new Date().toISOString();
  const updates = { updated_at: now };
  if (data.title != null) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.url !== undefined) updates.url = data.url;
  if (data.category !== undefined) updates.category = data.category;
  if (data.status != null) updates.status = data.status;
  if (data.close_time !== undefined) updates.close_time = data.close_time;
  if (data.resolution_time !== undefined) updates.resolution_time = data.resolution_time;

  await knex("prediction_market_events").where("id", id).update(updates);
  return getEvent(id);
}

// ---- SNAPSHOTS ----

export async function getSnapshots(eventId, limit = 50) {
  return getKnex()("prediction_market_snapshots")
    .where("prediction_market_event_id", eventId)
    .orderBy("observed_at", "desc")
    .limit(limit);
}

export async function getLatestSnapshot(eventId) {
  return getKnex()("prediction_market_snapshots")
    .where("prediction_market_event_id", eventId)
    .orderBy("observed_at", "desc")
    .first();
}

export async function createSnapshot(data) {
  const knex = getKnex();
  const id = uuidv4();
  const normalized = predictionMarketAdapter.normalizeSnapshot(
    data,
    data.prediction_market_event_id,
  );
  const isStale = predictionMarketAdapter.isStale(normalized.observed_at);

  await knex("prediction_market_snapshots").insert({
    id,
    prediction_market_event_id: normalized.prediction_market_event_id,
    observed_at: normalized.observed_at,
    yes_price: normalized.yes_price,
    no_price: normalized.no_price,
    implied_probability: normalized.implied_probability,
    volume_24h: normalized.volume_24h,
    liquidity: normalized.liquidity,
    spread: normalized.spread,
    source_attribution: normalized.source_attribution,
    raw_payload_ref: normalized.raw_payload_ref,
    is_stale: isStale,
    created_at: new Date().toISOString(),
  });

  return knex("prediction_market_snapshots").where("id", id).first();
}

// ---- LINKS ----

export async function getLinksForThesis(thesisId) {
  const knex = getKnex();
  const links = await knex("thesis_prediction_links as l")
    .join("prediction_market_events as e", "l.prediction_market_event_id", "e.id")
    .join("prediction_market_providers as p", "e.provider_id", "p.id")
    .select(
      "l.*",
      "e.title as event_title",
      "e.description as event_description",
      "e.url as event_url",
      "e.status as event_status",
      "e.category as event_category",
      "p.name as provider_name",
    )
    .where("l.thesis_id", thesisId)
    .orderBy("l.link_confidence", "desc");

  // Attach latest snapshot to each link
  for (const link of links) {
    link.latest_snapshot =
      (await getLatestSnapshot(link.prediction_market_event_id)) || null;
  }

  return links;
}

export async function getLinksForEvent(eventId) {
  return getKnex()("thesis_prediction_links as l")
    .join("theses as t", "l.thesis_id", "t.id")
    .select("l.*", "t.title as thesis_title")
    .where("l.prediction_market_event_id", eventId);
}

export async function createLink(data) {
  const knex = getKnex();
  const id = uuidv4();
  const now = new Date().toISOString();
  await knex("thesis_prediction_links").insert({
    id,
    thesis_id: data.thesis_id,
    prediction_market_event_id: data.prediction_market_event_id,
    link_confidence: data.link_confidence ?? 0.3,
    link_type: data.link_type || "partial_match",
    wording_match_score: data.wording_match_score ?? 0.5,
    wording_mismatch_flag: !!data.wording_mismatch_flag,
    rationale: data.rationale || null,
    created_at: now,
    updated_at: now,
  });
  return knex("thesis_prediction_links").where("id", id).first();
}

export async function updateLink(id, data) {
  const knex = getKnex();
  const now = new Date().toISOString();
  const updates = { updated_at: now };
  if (data.link_confidence != null) updates.link_confidence = data.link_confidence;
  if (data.link_type != null) updates.link_type = data.link_type;
  if (data.wording_match_score != null) updates.wording_match_score = data.wording_match_score;
  if (data.wording_mismatch_flag != null) updates.wording_mismatch_flag = !!data.wording_mismatch_flag;
  if (data.rationale !== undefined) updates.rationale = data.rationale;

  await knex("thesis_prediction_links").where("id", id).update(updates);
  return knex("thesis_prediction_links").where("id", id).first();
}

export async function deleteLink(id) {
  await getKnex()("thesis_prediction_links").where("id", id).del();
}

// ---- ASSESSMENTS ----

export async function computeAndStoreAssessment(thesisId) {
  const knex = getKnex();
  const thesis = await knex("theses").where("id", thesisId).first();
  if (!thesis) return null;

  const links = await getLinksForThesis(thesisId);
  const assessment = computeAssessment(thesis, links);
  const helpers = computeScoringHelpers(assessment);

  const id = uuidv4();
  const now = new Date().toISOString();

  await knex("prediction_market_assessments").insert({
    id,
    thesis_id: thesisId,
    assessed_at: now,
    thesis_probability_low: assessment.thesis_probability_low,
    thesis_probability_high: assessment.thesis_probability_high,
    prediction_market_implied_probability: assessment.prediction_market_implied_probability,
    divergence_score: assessment.divergence_score,
    consensus_state: assessment.consensus_state,
    wording_warning: !!assessment.wording_warning,
    liquidity_warning: !!assessment.liquidity_warning,
    thin_market_penalty: assessment.thin_market_penalty,
    notes: assessment.notes,
    created_at: now,
  });

  return {
    assessment: { id, ...assessment },
    scoring_helpers: helpers,
    contracts: assessment.contracts,
  };
}

export async function getAssessmentsForThesis(thesisId, limit = 10) {
  return getKnex()("prediction_market_assessments")
    .where("thesis_id", thesisId)
    .orderBy("assessed_at", "desc")
    .limit(limit);
}

export async function getLatestAssessment(thesisId) {
  return getKnex()("prediction_market_assessments")
    .where("thesis_id", thesisId)
    .orderBy("assessed_at", "desc")
    .first();
}
