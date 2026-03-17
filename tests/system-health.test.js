// ============================================================
// SYSTEM HEALTH ROUTES — Response shape tests
// ============================================================
// Validates the system router handlers produce correct shapes
// without requiring a running database.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB and services before importing router
vi.mock("../server/db/connection.js", () => {
  const raw = vi.fn();
  return {
    getKnex: () => ({ raw }),
    __mockRaw: raw,
  };
});

vi.mock("../server/services/provider-health.js", () => ({
  getAllProviderHealth: vi.fn(),
}));

vi.mock("../server/services/dead-letter.js", () => ({
  getAllEntries: vi.fn(),
}));

import { getKnex, __mockRaw } from "../server/db/connection.js";
import { getAllProviderHealth } from "../server/services/provider-health.js";
import { getAllEntries } from "../server/services/dead-letter.js";

// Import the router and build a mini test harness
import router from "../server/routes/system.js";

function findHandler(method, path) {
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    ) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`No ${method.toUpperCase()} ${path} handler found`);
}

function makeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (body) => { r.body = body; return r; };
  return r;
}

describe("GET /health", () => {
  const handler = findHandler("get", "/health");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct shape when DB and providers are healthy", async () => {
    __mockRaw.mockResolvedValue(true);
    getAllProviderHealth.mockResolvedValue([
      { provider_name: "fred", status: "healthy", last_check: "2026-01-01", consecutive_failures: 0, last_error: null },
    ]);

    const res = makeRes();
    await handler({}, res);

    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("db", "connected");
    expect(res.body).toHaveProperty("providers");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body.providers.fred).toEqual({
      status: "healthy",
      lastCheck: "2026-01-01",
      consecutiveFailures: 0,
      lastError: null,
    });
  });

  it("returns degraded when a provider is degraded", async () => {
    __mockRaw.mockResolvedValue(true);
    getAllProviderHealth.mockResolvedValue([
      { provider_name: "fred", status: "degraded", last_check: null, consecutive_failures: 2, last_error: "timeout" },
    ]);

    const res = makeRes();
    await handler({}, res);
    expect(res.body.status).toBe("degraded");
  });

  it("returns down when DB is unreachable", async () => {
    __mockRaw.mockRejectedValue(new Error("ECONNREFUSED"));
    getAllProviderHealth.mockResolvedValue([]);

    const res = makeRes();
    await handler({}, res);
    expect(res.body.status).toBe("down");
    expect(res.body.db).toBe("error");
  });
});

describe("GET /providers", () => {
  const handler = findHandler("get", "/providers");

  it("returns provider health array", async () => {
    const data = [{ provider_name: "finnhub", status: "healthy" }];
    getAllProviderHealth.mockResolvedValue(data);

    const res = makeRes();
    await handler({}, res);
    expect(res.body).toEqual(data);
  });

  it("returns 500 on service error", async () => {
    getAllProviderHealth.mockRejectedValue(new Error("db down"));
    const res = makeRes();
    await handler({}, res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /dlq", () => {
  const handler = findHandler("get", "/dlq");

  it("returns entries with default limit", async () => {
    getAllEntries.mockResolvedValue([]);
    const req = { query: {} };
    const res = makeRes();
    await handler(req, res);
    expect(getAllEntries).toHaveBeenCalledWith({ limit: 50 });
    expect(res.body).toEqual([]);
  });

  it("passes custom limit", async () => {
    getAllEntries.mockResolvedValue([{ id: 1 }]);
    const req = { query: { limit: "10" } };
    const res = makeRes();
    await handler(req, res);
    expect(getAllEntries).toHaveBeenCalledWith({ limit: 10 });
  });
});
