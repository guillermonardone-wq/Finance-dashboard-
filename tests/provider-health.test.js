// ============================================================
// PROVIDER HEALTH SERVICE — Unit tests (mocked DB)
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Build a mock knex query builder
function makeMockKnex() {
  const store = new Map(); // provider_name -> row
  const chain = {};

  chain.select = vi.fn().mockReturnThis();
  chain.where = vi.fn().mockReturnThis();
  chain.orderBy = vi.fn().mockImplementation(() => {
    return Array.from(store.values()).sort((a, b) =>
      a.provider_name.localeCompare(b.provider_name),
    );
  });
  chain.first = vi.fn().mockImplementation(() => {
    const lastWhere = chain.where.mock.calls.at(-1);
    if (lastWhere) return store.get(lastWhere[1]) || undefined;
    return undefined;
  });

  // insert().onConflict().merge() — upsert
  chain.insert = vi.fn().mockImplementation((row) => {
    const onConflict = vi.fn().mockImplementation(() => {
      const merge = vi.fn().mockImplementation((mergeData) => {
        const existing = store.get(row.provider_name);
        if (existing) {
          store.set(row.provider_name, { ...existing, ...mergeData, provider_name: row.provider_name });
        } else {
          store.set(row.provider_name, { ...row });
        }
        return Promise.resolve();
      });
      return { merge };
    });
    return { onConflict };
  });

  const knexFn = vi.fn().mockReturnValue(chain);
  knexFn.fn = { now: () => "NOW()" };

  return { knexFn, store, chain };
}

describe("provider-health service", () => {
  let recordSuccess, recordFailure, getAllProviderHealth, getProviderHealth, withHealthTracking;
  let mockKnex;

  beforeEach(async () => {
    vi.resetModules();
    mockKnex = makeMockKnex();

    vi.doMock("../server/db/connection.js", () => ({
      getKnex: () => mockKnex.knexFn,
    }));

    const mod = await import("../server/services/provider-health.js");
    recordSuccess = mod.recordSuccess;
    recordFailure = mod.recordFailure;
    getAllProviderHealth = mod.getAllProviderHealth;
    getProviderHealth = mod.getProviderHealth;
    withHealthTracking = mod.withHealthTracking;
  });

  it("recordSuccess inserts healthy record", async () => {
    await recordSuccess("fred");
    expect(mockKnex.knexFn).toHaveBeenCalledWith("provider_health");
    // Verify insert was called with healthy status
    const insertCall = mockKnex.chain.insert.mock.calls[0][0];
    expect(insertCall.provider_name).toBe("fred");
    expect(insertCall.status).toBe("healthy");
    expect(insertCall.consecutive_failures).toBe(0);
  });

  it("recordFailure increments failure count and derives status", async () => {
    // Simulate no existing record
    mockKnex.chain.first.mockResolvedValueOnce(undefined);
    await recordFailure("finnhub", new Error("timeout"));

    const insertCall = mockKnex.chain.insert.mock.calls[0][0];
    expect(insertCall.consecutive_failures).toBe(1);
    expect(insertCall.status).toBe("degraded"); // 1 failure = degraded
  });

  it("recordFailure marks down at 3+ failures", async () => {
    mockKnex.chain.first.mockResolvedValueOnce({ consecutive_failures: 2 });
    await recordFailure("finnhub", "server error");

    const insertCall = mockKnex.chain.insert.mock.calls[0][0];
    expect(insertCall.consecutive_failures).toBe(3);
    expect(insertCall.status).toBe("down"); // 3 failures = down
  });

  it("recordFailure handles string error", async () => {
    mockKnex.chain.first.mockResolvedValueOnce(undefined);
    await recordFailure("fred", "rate limited");

    const insertCall = mockKnex.chain.insert.mock.calls[0][0];
    expect(insertCall.last_error).toBe("rate limited");
  });

  it("getAllProviderHealth queries with orderBy", async () => {
    await getAllProviderHealth();
    expect(mockKnex.knexFn).toHaveBeenCalledWith("provider_health");
    expect(mockKnex.chain.select).toHaveBeenCalledWith("*");
    expect(mockKnex.chain.orderBy).toHaveBeenCalledWith("provider_name");
  });

  it("withHealthTracking records success on resolved fn", async () => {
    const fn = vi.fn().mockResolvedValue({ data: 42 });
    const result = await withHealthTracking("fred", fn);
    expect(result).toEqual({ data: 42 });
    // recordSuccess was called (insert with healthy status)
    const insertCall = mockKnex.chain.insert.mock.calls[0][0];
    expect(insertCall.status).toBe("healthy");
  });

  it("withHealthTracking records failure and rethrows on rejected fn", async () => {
    mockKnex.chain.first.mockResolvedValueOnce(undefined);
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withHealthTracking("fred", fn)).rejects.toThrow("boom");
  });
});
