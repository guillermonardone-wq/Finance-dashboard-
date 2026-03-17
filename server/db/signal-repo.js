// ============================================================
// SIGNAL REPOSITORY — Knex-based DB access layer for signals
// ============================================================

import { getKnex, userScoped } from "./connection.js";

export async function findAll({ status, category, thesis_id } = {}, userId = "default") {
  const knex = getKnex();
  let query = knex("signals").where(userScoped(userId));
  if (status) query = query.where("status", status);
  if (category) query = query.where("category", category);
  if (thesis_id) query = query.where("thesis_id", thesis_id);
  return query.orderBy("created_at", "desc");
}

export async function findById(id, userId = "default") {
  const knex = getKnex();
  return knex("signals").where({ id, ...userScoped(userId) }).first() || null;
}

export async function countsByStatus(userId = "default") {
  const knex = getKnex();
  const rows = await knex("signals")
    .where(userScoped(userId))
    .groupBy("status")
    .select("status")
    .count("* as count");
  const counts = {};
  for (const row of rows) counts[row.status] = parseInt(row.count);
  return counts;
}

export async function create(id, data, userId = "default") {
  const knex = getKnex();
  const now = new Date().toISOString();
  const s = data;

  const row = {
    id,
    user_id: userId,
    created_at: now,
    updated_at: now,
    category: s.category.trim(),
    subcategory: s.subcategory || null,
    title: s.title.trim(),
    description: s.description.trim(),
    raw_source: s.raw_source || null,
    source_type: s.source_type || "manual",
    source_provider: s.source_provider || null,
    source_url: s.source_url || null,
    source_attribution: s.source_attribution || "Manual entry",
    novelty: s.novelty || "unknown",
    reliability: s.reliability || "unverified",
    signal_strength: s.signal_strength != null ? s.signal_strength : null,
    thesis_id: s.thesis_id || null,
    related_signal_ids: s.related_signal_ids || [],
    status: s.status || "inbox",
    tags: s.tags || [],
  };

  await knex("signals").insert(row);
  return findById(id, userId);
}

export async function update(id, data, userId = "default") {
  const knex = getKnex();
  const existing = await knex("signals").where({ id, ...userScoped(userId) }).first();
  if (!existing) return null;

  const now = new Date().toISOString();
  const s = data;

  const updates = { updated_at: now };

  if (s.category != null) updates.category = s.category;
  if (s.subcategory !== undefined) updates.subcategory = s.subcategory;
  if (s.title != null) updates.title = s.title;
  if (s.description != null) updates.description = s.description;
  if (s.raw_source !== undefined) updates.raw_source = s.raw_source;
  if (s.source_type != null) updates.source_type = s.source_type;
  if (s.source_provider !== undefined) updates.source_provider = s.source_provider;
  if (s.source_url !== undefined) updates.source_url = s.source_url;
  if (s.source_attribution !== undefined) updates.source_attribution = s.source_attribution;
  if (s.novelty != null) updates.novelty = s.novelty;
  if (s.reliability != null) updates.reliability = s.reliability;
  if (s.signal_strength !== undefined) updates.signal_strength = s.signal_strength;
  if ("thesis_id" in s) updates.thesis_id = s.thesis_id;
  if (s.related_signal_ids !== undefined) updates.related_signal_ids = s.related_signal_ids;
  if (s.status != null) updates.status = s.status;
  if (s.tags !== undefined) updates.tags = s.tags;

  await knex("signals").where({ id }).update(updates);
  return findById(id, userId);
}

export async function remove(id, userId = "default") {
  const knex = getKnex();
  await knex("signals").where({ id, ...userScoped(userId) }).del();
}
