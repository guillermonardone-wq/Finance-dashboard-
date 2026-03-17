// ============================================================
// DEAD LETTER QUEUE — Failed job tracking and retry
// ============================================================
// Uses dead_letter_queue table from Session 1a migration.
// Exponential backoff: 1m, 4m, 16m, 64m, 256m
// Max retries: 5
// ============================================================

import { getKnex } from "../db/connection.js";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 60_000; // 1 minute

function computeNextRetry(retryCount) {
  const delayMs = BASE_DELAY_MS * Math.pow(4, retryCount);
  return new Date(Date.now() + delayMs);
}

/**
 * Log a failed job into the dead letter queue.
 */
export async function logFailure(jobType, payload, error) {
  const knex = getKnex();
  const errorMsg =
    typeof error === "string" ? error : error?.message || "Unknown error";

  await knex("dead_letter_queue").insert({
    job_type: jobType,
    payload: payload != null ? JSON.stringify(payload) : null,
    error: errorMsg,
    retry_count: 0,
    next_retry: computeNextRetry(0),
  });
}

/**
 * Get all pending dead letter entries (retries not exhausted, next_retry in past).
 */
export async function getPendingRetries() {
  const knex = getKnex();
  return knex("dead_letter_queue")
    .where("retry_count", "<", MAX_RETRIES)
    .where("next_retry", "<=", knex.fn.now())
    .orderBy("next_retry", "asc");
}

/**
 * Get all dead letter entries (for the /api/system/dlq endpoint).
 */
export async function getAllEntries({ limit = 50 } = {}) {
  const knex = getKnex();
  return knex("dead_letter_queue")
    .orderBy("next_retry", "desc")
    .limit(limit);
}

/**
 * Mark a dead letter entry as retried (increment count, set next retry).
 * If max retries reached, next_retry is set far in the future (effectively dead).
 */
export async function markRetried(failedJobId, newError) {
  const knex = getKnex();
  const entry = await knex("dead_letter_queue")
    .where("failed_job_id", failedJobId)
    .first();

  if (!entry) return null;

  const newCount = entry.retry_count + 1;
  const updates = {
    retry_count: newCount,
    error: newError
      ? typeof newError === "string"
        ? newError
        : newError.message
      : entry.error,
  };

  if (newCount >= MAX_RETRIES) {
    // Push far into future — effectively dead
    updates.next_retry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  } else {
    updates.next_retry = computeNextRetry(newCount);
  }

  await knex("dead_letter_queue")
    .where("failed_job_id", failedJobId)
    .update(updates);

  return { ...entry, ...updates };
}

/**
 * Remove a dead letter entry (e.g., after successful retry).
 */
export async function removeEntry(failedJobId) {
  const knex = getKnex();
  return knex("dead_letter_queue").where("failed_job_id", failedJobId).del();
}

/**
 * Retry all pending dead letters. Calls retryFn(entry) for each.
 * retryFn should throw on failure.
 */
export async function retryDeadLetters(retryFn) {
  const pending = await getPendingRetries();
  let succeeded = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await retryFn(entry);
      await removeEntry(entry.failed_job_id);
      succeeded++;
    } catch (err) {
      await markRetried(entry.failed_job_id, err);
      failed++;
    }
  }

  if (pending.length > 0) {
    console.log(
      `[DLQ] Retried ${pending.length} entries: ${succeeded} succeeded, ${failed} failed`,
    );
  }

  return { total: pending.length, succeeded, failed };
}
