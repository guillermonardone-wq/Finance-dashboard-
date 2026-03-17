// ============================================================
// PROVIDER HEALTH SERVICE — Track provider availability
// ============================================================
// Uses the provider_health table from Session 1a migration.
// Wraps provider calls with success/failure tracking.
// Threshold: 1-2 failures → degraded, 3+ → down.
// ============================================================

import { getKnex } from "../db/connection.js";

const DEGRADED_THRESHOLD = 1;
const DOWN_THRESHOLD = 3;

function deriveStatus(consecutiveFailures) {
  if (consecutiveFailures >= DOWN_THRESHOLD) return "down";
  if (consecutiveFailures >= DEGRADED_THRESHOLD) return "degraded";
  return "healthy";
}

/**
 * Record a successful provider call. Resets failure count.
 */
export async function recordSuccess(providerName) {
  const knex = getKnex();
  await knex("provider_health")
    .insert({
      provider_name: providerName,
      last_check: knex.fn.now(),
      status: "healthy",
      last_error: null,
      consecutive_failures: 0,
    })
    .onConflict("provider_name")
    .merge({
      last_check: knex.fn.now(),
      status: "healthy",
      last_error: null,
      consecutive_failures: 0,
    });
}

/**
 * Record a failed provider call. Increments failure count and derives status.
 */
export async function recordFailure(providerName, error) {
  const knex = getKnex();
  const errorMsg =
    typeof error === "string" ? error : error?.message || "Unknown error";

  // Get current failure count
  const existing = await knex("provider_health")
    .where("provider_name", providerName)
    .first();

  const failures = (existing?.consecutive_failures || 0) + 1;
  const status = deriveStatus(failures);

  await knex("provider_health")
    .insert({
      provider_name: providerName,
      last_check: knex.fn.now(),
      status,
      last_error: errorMsg,
      consecutive_failures: failures,
    })
    .onConflict("provider_name")
    .merge({
      last_check: knex.fn.now(),
      status,
      last_error: errorMsg,
      consecutive_failures: failures,
    });
}

/**
 * Get health status for all tracked providers.
 */
export async function getAllProviderHealth() {
  const knex = getKnex();
  return knex("provider_health").select("*").orderBy("provider_name");
}

/**
 * Get health status for a single provider.
 */
export async function getProviderHealth(providerName) {
  const knex = getKnex();
  return knex("provider_health").where("provider_name", providerName).first();
}

/**
 * Wrap an async provider call with health tracking.
 * Returns the result on success, throws on failure (after recording).
 */
export async function withHealthTracking(providerName, fn) {
  try {
    const result = await fn();
    await recordSuccess(providerName);
    return result;
  } catch (err) {
    await recordFailure(providerName, err).catch((dbErr) =>
      console.error(`[ProviderHealth] Failed to record failure for ${providerName}:`, dbErr.message),
    );
    throw err;
  }
}
