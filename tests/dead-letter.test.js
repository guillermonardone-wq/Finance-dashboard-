// ============================================================
// DEAD LETTER QUEUE SERVICE — Unit tests (mocked DB)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a mock knex query builder for DLQ
function makeMockKnex() {
  const rows = [];
  const chain = {};

  chain.insert = vi.fn().mockResolvedValue([1]);
  chain.where = vi.fn().mockReturnThis();
  chain.orderBy = vi.fn().mockReturnThis();
  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(rows));
  chain.first = vi.fn().mockImplementation(() => rows[0] || undefined);
  chain.update = vi.fn().mockResolvedValue(1);
  chain.del = vi.fn().mockResolvedValue(1);

  const knexFn = vi.fn().mockReturnValue(chain);
  knexFn.fn = { now: () => "NOW()" };

  return { knexFn, chain, rows };
}

describe("dead-letter service", () => {
  let logFailure, getPendingRetries, getAllEntries, markRetried, removeEntry, retryDeadLetters;
  let mockKnex;

  beforeEach(async () => {
    vi.resetModules();
    mockKnex = makeMockKnex();

    vi.doMock("../server/db/connection.js", () => ({
      getKnex: () => mockKnex.knexFn,
    }));

    const mod = await import("../server/services/dead-letter.js");
    logFailure = mod.logFailure;
    getPendingRetries = mod.getPendingRetries;
    getAllEntries = mod.getAllEntries;
    markRetried = mod.markRetried;
    removeEntry = mod.removeEntry;
    retryDeadLetters = mod.retryDeadLetters;
  });

  it("logFailure inserts with retry_count 0 and computed next_retry", async () => {
    await logFailure("price_fetch", { symbol: "AAPL" }, new Error("timeout"));

    expect(mockKnex.knexFn).toHaveBeenCalledWith("dead_letter_queue");
    const row = mockKnex.chain.insert.mock.calls[0][0];
    expect(row.job_type).toBe("price_fetch");
    expect(row.error).toBe("timeout");
    expect(row.retry_count).toBe(0);
    expect(row.next_retry).toBeInstanceOf(Date);
    // next_retry should be ~1 minute from now (BASE_DELAY_MS * 4^0 = 60s)
    const delayMs = row.next_retry.getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(55_000);
    expect(delayMs).toBeLessThan(65_000);
  });

  it("logFailure serializes payload to JSON string", async () => {
    await logFailure("news_fetch", { source: "fred" }, "error msg");
    const row = mockKnex.chain.insert.mock.calls[0][0];
    expect(row.payload).toBe(JSON.stringify({ source: "fred" }));
  });

  it("logFailure handles null payload", async () => {
    await logFailure("macro_fetch", null, "fail");
    const row = mockKnex.chain.insert.mock.calls[0][0];
    expect(row.payload).toBeNull();
  });

  it("logFailure handles string error", async () => {
    await logFailure("test", {}, "string error");
    const row = mockKnex.chain.insert.mock.calls[0][0];
    expect(row.error).toBe("string error");
  });

  it("getAllEntries passes limit and orders by next_retry desc", async () => {
    await getAllEntries({ limit: 25 });
    expect(mockKnex.chain.orderBy).toHaveBeenCalledWith("next_retry", "desc");
    expect(mockKnex.chain.limit).toHaveBeenCalledWith(25);
  });

  it("getAllEntries defaults to limit 50", async () => {
    await getAllEntries();
    expect(mockKnex.chain.limit).toHaveBeenCalledWith(50);
  });

  it("markRetried returns null for missing entry", async () => {
    mockKnex.chain.first.mockResolvedValueOnce(undefined);
    const result = await markRetried("nonexistent-id", "err");
    expect(result).toBeNull();
  });

  it("markRetried increments retry_count and computes next backoff", async () => {
    mockKnex.chain.first.mockResolvedValueOnce({
      failed_job_id: "abc",
      retry_count: 1,
      error: "old error",
    });
    const result = await markRetried("abc", "new error");
    expect(result.retry_count).toBe(2);
    expect(result.error).toBe("new error");
    expect(result.next_retry).toBeInstanceOf(Date);
    // 60000 * 4^2 = 960000ms = 16 minutes
    const delayMs = result.next_retry.getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(900_000);
    expect(delayMs).toBeLessThan(1_020_000);
  });

  it("markRetried pushes to far future at max retries (5)", async () => {
    mockKnex.chain.first.mockResolvedValueOnce({
      failed_job_id: "abc",
      retry_count: 4,
      error: "old",
    });
    const result = await markRetried("abc", "still failing");
    expect(result.retry_count).toBe(5);
    // Should be ~1 year in the future
    const delayMs = result.next_retry.getTime() - Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    expect(delayMs).toBeGreaterThan(oneYearMs - 60_000);
  });

  it("removeEntry deletes by failed_job_id", async () => {
    await removeEntry("abc-123");
    expect(mockKnex.chain.where).toHaveBeenCalledWith("failed_job_id", "abc-123");
    expect(mockKnex.chain.del).toHaveBeenCalled();
  });

  it("retryDeadLetters calls retryFn for each pending entry", async () => {
    // getPendingRetries returns entries via chained where().where().orderBy()
    mockKnex.chain.orderBy.mockResolvedValueOnce([
      { failed_job_id: "a", job_type: "test", retry_count: 0 },
      { failed_job_id: "b", job_type: "test", retry_count: 1 },
    ]);

    const retryFn = vi.fn().mockResolvedValue(undefined);
    const result = await retryDeadLetters(retryFn);

    expect(retryFn).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("retryDeadLetters handles mixed success/failure", async () => {
    mockKnex.chain.orderBy.mockResolvedValueOnce([
      { failed_job_id: "a", job_type: "test", retry_count: 0 },
      { failed_job_id: "b", job_type: "test", retry_count: 0 },
    ]);
    // Mock for markRetried's .first() call
    mockKnex.chain.first.mockResolvedValueOnce({
      failed_job_id: "b",
      retry_count: 0,
      error: "old",
    });

    const retryFn = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("still broken"));

    const result = await retryDeadLetters(retryFn);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
  });
});
