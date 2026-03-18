// ============================================================
// SCHEDULER + INGESTION STATUS — Unified pipeline tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Ingestion status tests (no mocks needed) ----

describe("ingestion-status", () => {
  let ingestionStatus;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../server/services/ingestion-status.js");
    ingestionStatus = mod.ingestionStatus;
  });

  it("getStatus returns correct shape", () => {
    const status = ingestionStatus.getStatus();
    expect(status).toHaveProperty("lastRun");
    expect(status).toHaveProperty("lastSuccess");
    expect(status).toHaveProperty("lastError");
    expect(status).toHaveProperty("signalsIngestedCount");
    expect(status).toHaveProperty("totalRuns");
    expect(status).toHaveProperty("totalErrors");
  });

  it("markStarted updates lastRun and totalRuns", () => {
    ingestionStatus.markStarted();
    const status = ingestionStatus.getStatus();
    expect(status.lastRun).toBeTruthy();
    expect(status.totalRuns).toBeGreaterThanOrEqual(1);
  });

  it("markSuccess updates lastSuccess and clears lastError", () => {
    ingestionStatus.markError("some error");
    ingestionStatus.markSuccess(5);
    const status = ingestionStatus.getStatus();
    expect(status.lastSuccess).toBeTruthy();
    expect(status.lastError).toBeNull();
    expect(status.signalsIngestedCount).toBeGreaterThanOrEqual(5);
  });

  it("markError records error with timestamp", () => {
    ingestionStatus.markError("provider timeout");
    const status = ingestionStatus.getStatus();
    expect(status.lastError).toBeTruthy();
    expect(status.lastError.message).toBe("provider timeout");
    expect(status.lastError.timestamp).toBeTruthy();
    expect(status.totalErrors).toBeGreaterThanOrEqual(1);
  });
});

// ---- Ingestion-status endpoint test ----

describe("GET /ingestion-status route", () => {
  it("returns ingestion status from the system router", async () => {
    vi.resetModules();

    vi.doMock("../server/db/connection.js", () => ({
      getKnex: () => ({ raw: vi.fn() }),
    }));
    vi.doMock("../server/services/provider-health.js", () => ({
      getAllProviderHealth: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("../server/services/dead-letter.js", () => ({
      getAllEntries: vi.fn().mockResolvedValue([]),
    }));

    const routerMod = await import("../server/routes/system.js");
    const router = routerMod.default;

    // Find the /ingestion-status handler
    let handler;
    for (const layer of router.stack) {
      if (layer.route?.path === "/ingestion-status" && layer.route.methods.get) {
        handler = layer.route.stack[0].handle;
        break;
      }
    }

    expect(handler).toBeTruthy();

    const res = { statusCode: 200, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (body) => { res.body = body; return res; };

    handler({}, res);

    expect(res.body).toHaveProperty("lastRun");
    expect(res.body).toHaveProperty("lastSuccess");
    expect(res.body).toHaveProperty("lastError");
    expect(res.body).toHaveProperty("signalsIngestedCount");
  });
});

// ---- Scheduler uses only runIngestionPipeline ----

describe("scheduler unified", () => {
  it("scheduler module does NOT import legacy functions", async () => {
    const fs = await import("fs");
    const schedulerSource = fs.readFileSync(
      new URL("../server/services/scheduler.js", import.meta.url),
      "utf-8",
    );

    // Must NOT contain legacy function names
    expect(schedulerSource).not.toContain("newsToSignal");
    expect(schedulerSource).not.toContain("checkFredSignals");
    expect(schedulerSource).not.toContain("checkGdeltSignals");
    expect(schedulerSource).not.toContain("categorizeNews");
    expect(schedulerSource).not.toContain("extractArticles");
    expect(schedulerSource).not.toContain("fetchPrices");
    expect(schedulerSource).not.toContain("fetchNews");
    expect(schedulerSource).not.toContain("fetchMacro");

    // Must contain unified pipeline
    expect(schedulerSource).toContain("runIngestionPipeline");
    expect(schedulerSource).toContain("ingestionStatus");
  });

  it("scheduler exports startScheduler function", async () => {
    vi.resetModules();

    // Mock everything the scheduler imports
    vi.doMock("../server/services/signal-ingestion.js", () => ({
      runIngestionPipeline: vi.fn().mockResolvedValue({
        sources: [], totalIngested: 0, totalSkipped: 0, totalErrors: 0,
      }),
    }));
    vi.doMock("../server/services/ingestion-status.js", () => ({
      ingestionStatus: {
        markStarted: vi.fn(),
        markSuccess: vi.fn(),
        markError: vi.fn(),
        getStatus: vi.fn().mockReturnValue({}),
      },
    }));
    vi.doMock("../server/config.js", () => ({
      default: { refresh: { ingestion: 900 } },
    }));
    vi.doMock("../server/services/dead-letter.js", () => ({
      logFailure: vi.fn().mockResolvedValue(undefined),
    }));

    const mod = await import("../server/services/scheduler.js");
    expect(typeof mod.startScheduler).toBe("function");
  });
});

// ---- Legacy files still exist but are NOT imported by scheduler ----

describe("legacy isolation", () => {
  it("fred-signals.js exists but is not imported by scheduler", async () => {
    const fs = await import("fs");

    // fred-signals.js still exists (used by ingestion pipeline internally)
    const exists = fs.existsSync(
      new URL("../server/services/fred-signals.js", import.meta.url),
    );
    expect(exists).toBe(true);

    // But scheduler does not import it
    const schedulerSource = fs.readFileSync(
      new URL("../server/services/scheduler.js", import.meta.url),
      "utf-8",
    );
    expect(schedulerSource).not.toContain("fred-signals");
    expect(schedulerSource).not.toContain("gdelt-signals");
  });
});

// ---- World Bank hardening ----

describe("World Bank normalization hardening", () => {
  let normalizeWorldBankSignal;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../server/services/signal-normalizer.js");
    normalizeWorldBankSignal = mod.normalizeWorldBankSignal;
  });

  it("returns null for null value", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "USA", value: null, previousValue: null, date: "2025",
    });
    expect(result).toBeNull();
  });

  it("returns null for NaN value", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "USA", value: NaN, previousValue: null, date: "2025",
    });
    expect(result).toBeNull();
  });

  it("returns null for undefined value", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "USA", value: undefined, previousValue: null, date: "2025",
    });
    expect(result).toBeNull();
  });

  it("returns null for missing country", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "", value: 5.0, previousValue: null, date: "2025",
    });
    expect(result).toBeNull();
  });

  it("returns null for Infinity value", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "USA", value: Infinity, previousValue: null, date: "2025",
    });
    expect(result).toBeNull();
  });

  it("handles string-like numbers", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "USA", value: "3.5", previousValue: "3.0", date: "2025",
    });
    expect(result).not.toBeNull();
    expect(result.value).toBe(3.5);
    expect(result.previous_value).toBe(3.0);
    expect(result.change).toBeCloseTo(0.5);
  });

  it("handles valid data correctly", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "NY.GDP", indicatorName: "GDP", category: "policy_shock",
      country: "USA", value: 2.5, previousValue: 2.1, date: "2025",
    });
    expect(result).not.toBeNull();
    expect(result.entity).toBe("NY.GDP_USA");
    expect(result.value).toBe(2.5);
  });

  it("falls back to indicatorCode when indicatorName missing", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "NY.GDP", indicatorName: null, category: "other",
      country: "USA", value: 2.5, previousValue: null, date: "2025",
    });
    expect(result).not.toBeNull();
    expect(result.summary).toContain("NY.GDP");
  });

  it("uses current date when date is missing", () => {
    const result = normalizeWorldBankSignal({
      indicatorCode: "TEST", indicatorName: "Test", category: "other",
      country: "USA", value: 1.0, previousValue: null, date: null,
    });
    expect(result).not.toBeNull();
    expect(result.timestamp).toBeTruthy();
  });
});

// ---- Mock mode ----

describe("INGESTION_MODE=mock", () => {
  it("config.js declares ingestionMode field", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/config.js", import.meta.url),
      "utf-8",
    );
    expect(source).toContain("ingestionMode");
    expect(source).toContain("INGESTION_MODE");
    // Default should be "live"
    expect(source).toMatch(/envStr\("INGESTION_MODE",\s*"live"\)/);
  });

  it("ingestion pipeline checks ingestionMode and returns early in mock mode", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );
    expect(source).toContain('config.ingestionMode === "mock"');
    expect(source).toContain("Mock mode");
    // The early return should produce 4 sources with 0 counts
    expect(source).toContain("totalIngested: 0");
  });
});
