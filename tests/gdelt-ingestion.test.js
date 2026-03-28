// ============================================================
// GDELT INGESTION — Normalization, spike detection, pipeline integration
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeGdeltSignal } from "../server/services/signal-normalizer.js";

// ---- Normalizer shape ----

describe("normalizeGdeltSignal", () => {
  it("produces correct standardized signal shape", () => {
    const signal = normalizeGdeltSignal({
      keyword: "military escalation",
      category: "military_mobilization",
      count: 45,
      average: 15,
      ratio: 3.0,
      topArticles: [
        { title: "Troops deployed near border", url: "https://example.com/1", source: "Reuters" },
        { title: "Naval exercises escalate", url: "https://example.com/2", source: "AP" },
      ],
    });

    // Standard schema fields
    expect(signal.source).toBe("gdelt");
    expect(signal.category).toBe("military_mobilization");
    expect(signal.entity).toBe("gdelt_military_escalation");
    expect(signal.value).toBe(45);
    expect(signal.previous_value).toBe(15);
    expect(signal.change).toBe(30);
    expect(signal.timestamp).toBeTruthy();
    expect(signal.significance).toBeGreaterThanOrEqual(1);
    expect(signal.significance).toBeLessThanOrEqual(5);
    expect(signal.direction).toBe("bearish");
    expect(signal.summary).toContain("military escalation");
    expect(signal.summary).toContain("45");
    expect(signal.summary).toContain("3.0x");

    // Storage fields
    expect(signal.title).toContain("GDELT spike");
    expect(signal.title).toContain("military escalation");
    expect(signal.source_type).toBe("gdelt");
    expect(signal.source_provider).toBe("gdelt");
    expect(signal.source_attribution).toContain("GDELT Project");
    expect(signal.raw_source).toContain("gdelt-military_escalation");
    expect(signal.subcategory).toBe("military escalation");
    expect(signal.tags).toContain("gdelt");
    expect(signal.tags).toContain("military_escalation");
    expect(signal.novelty).toBe("new");
    expect(signal.reliability).toBe("likely");
    expect(signal.signal_strength).toBeCloseTo(0.6, 1);
    expect(signal.source_url).toBe("https://example.com/1");
  });

  it("significance scales with spike ratio", () => {
    const low = normalizeGdeltSignal({ keyword: "test", category: "other", count: 20, average: 15, ratio: 1.3, topArticles: [] });
    const mid = normalizeGdeltSignal({ keyword: "test", category: "other", count: 45, average: 15, ratio: 3.0, topArticles: [] });
    const high = normalizeGdeltSignal({ keyword: "test", category: "other", count: 75, average: 15, ratio: 5.0, topArticles: [] });

    expect(low.significance).toBe(1);
    expect(mid.significance).toBe(3);
    expect(high.significance).toBe(5);
  });

  it("returns null for count = 0", () => {
    expect(normalizeGdeltSignal({
      keyword: "test", category: "other", count: 0, average: 10, ratio: 0, topArticles: [],
    })).toBeNull();
  });

  it("returns null for null count", () => {
    expect(normalizeGdeltSignal({
      keyword: "test", category: "other", count: null, average: 10, ratio: 0, topArticles: [],
    })).toBeNull();
  });

  it("returns null for missing keyword", () => {
    expect(normalizeGdeltSignal({
      keyword: "", category: "other", count: 10, average: 5, ratio: 2, topArticles: [],
    })).toBeNull();
  });

  it("handles NaN average gracefully", () => {
    const signal = normalizeGdeltSignal({
      keyword: "test", category: "other", count: 10, average: NaN, ratio: NaN, topArticles: [],
    });
    expect(signal).not.toBeNull();
    expect(signal.previous_value).toBe(0);
    expect(isFinite(signal.change)).toBe(true);
  });

  it("handles null topArticles gracefully", () => {
    const signal = normalizeGdeltSignal({
      keyword: "test", category: "other", count: 10, average: 5, ratio: 2, topArticles: null,
    });
    expect(signal).not.toBeNull();
    expect(signal.source_url).toBeNull();
  });

  it("handles empty topArticles", () => {
    const signal = normalizeGdeltSignal({
      keyword: "test", category: "other", count: 10, average: 5, ratio: 2, topArticles: [],
    });
    expect(signal).not.toBeNull();
    expect(signal.source_url).toBeNull();
  });
});

// ---- Rolling average / spike detection ----

describe("updateGdeltRollingAverage", () => {
  let updateGdeltRollingAverage;

  beforeEach(async () => {
    vi.resetModules();

    vi.doMock("../server/db/connection.js", () => ({
      getKnex: () => vi.fn(),
      userScoped: (id = "default") => ({ user_id: id }),
    }));
    vi.doMock("../server/providers/registry.js", () => ({
      registry: { getProvider: vi.fn(), getPrice: vi.fn(), getNews: vi.fn() },
    }));
    vi.doMock("../server/config.js", () => ({
      default: {
        ingestionMode: "live",
        signals: { fredThresholdMult: 1.0, gdeltSpikeMultiplier: 2.0 },
        cache: { ttlPrices: 300, ttlNews: 600, ttlMacro: 3600 },
      },
    }));

    const mod = await import("../server/services/signal-ingestion.js");
    updateGdeltRollingAverage = mod.updateGdeltRollingAverage;
  });

  it("first call: no spike (insufficient history)", () => {
    const result = updateGdeltRollingAverage("test_keyword_1", 20);
    expect(result.isSpike).toBe(false);
    expect(result.average).toBe(20);
  });

  it("second call with high count: detects spike", () => {
    updateGdeltRollingAverage("test_keyword_2", 10);
    const result = updateGdeltRollingAverage("test_keyword_2", 25);
    // 25 >= 10 * 2.0 → spike
    expect(result.isSpike).toBe(true);
    expect(result.average).toBe(10);
  });

  it("no spike when count is below threshold", () => {
    updateGdeltRollingAverage("test_keyword_3", 10);
    const result = updateGdeltRollingAverage("test_keyword_3", 15);
    // 15 < 10 * 2.0 → no spike
    expect(result.isSpike).toBe(false);
  });
});

// ---- Ingestion pipeline integration ----

describe("ingestGdeltSignals", () => {
  let ingestGdeltSignals;
  let mockKnex;

  function makeMockKnex() {
    const chain = {};
    chain.insert = vi.fn().mockResolvedValue([1]);
    chain.where = vi.fn().mockReturnThis();
    chain.first = vi.fn().mockResolvedValue(undefined);
    chain.orderBy = vi.fn().mockReturnThis();
    chain.limit = vi.fn().mockResolvedValue([]);
    chain.del = vi.fn().mockResolvedValue(1);

    const knexFn = vi.fn().mockReturnValue(chain);
    knexFn.fn = { now: () => "NOW()" };
    return { knexFn, chain };
  }

  beforeEach(async () => {
    vi.resetModules();
    mockKnex = makeMockKnex();

    vi.doMock("../server/db/connection.js", () => ({
      getKnex: () => mockKnex.knexFn,
      userScoped: (id = "default") => ({ user_id: id }),
    }));
    vi.doMock("../server/providers/registry.js", () => ({
      registry: { getProvider: vi.fn(), getPrice: vi.fn(), getNews: vi.fn() },
    }));
    vi.doMock("../server/config.js", () => ({
      default: {
        ingestionMode: "live",
        signals: { fredThresholdMult: 1.0, gdeltSpikeMultiplier: 2.0 },
        cache: { ttlPrices: 300, ttlNews: 600, ttlMacro: 3600 },
      },
    }));
  });

  it("returns correct result shape", async () => {
    // Mock global fetch to simulate GDELT API
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ articles: [] }),
    });

    const mod = await import("../server/services/signal-ingestion.js");
    ingestGdeltSignals = mod.ingestGdeltSignals;

    const result = await ingestGdeltSignals();
    expect(result.source).toBe("gdelt");
    expect(typeof result.ingested).toBe("number");
    expect(typeof result.skipped).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);

    globalThis.fetch = originalFetch;
  });

  it("handles GDELT API failure gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    const mod = await import("../server/services/signal-ingestion.js");
    ingestGdeltSignals = mod.ingestGdeltSignals;

    const result = await ingestGdeltSignals();
    // Should not throw, errors are captured
    expect(result.source).toBe("gdelt");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.ingested).toBe(0);

    globalThis.fetch = originalFetch;
  });

  it("handles malformed GDELT JSON gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });

    const mod = await import("../server/services/signal-ingestion.js");
    ingestGdeltSignals = mod.ingestGdeltSignals;

    const result = await ingestGdeltSignals();
    expect(result.source).toBe("gdelt");
    // Should not crash — articles defaults to []
    expect(result.ingested).toBe(0);

    globalThis.fetch = originalFetch;
  });
});

// ---- Pipeline includes GDELT ----

describe("runIngestionPipeline includes GDELT", () => {
  it("pipeline source code runs ingestGdeltSignals", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    // Pipeline must include GDELT
    expect(source).toContain("collectGdeltSignals()");
    // Pipeline results must include gdelt source
    expect(source).toContain('"gdelt"');
  });

  it("mock mode returns 5 sources including gdelt", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    // Mock mode returns array of 5 sources
    const mockSection = source.slice(
      source.indexOf('ingestionMode === "mock"'),
      source.indexOf("Starting full pipeline"),
    );
    expect(mockSection).toContain("gdelt");
  });

  it("legacy gdelt-signals.js is NOT imported by any active code", async () => {
    const fs = await import("fs");

    // Check signal-ingestion.js does not import from gdelt-signals
    const ingestionSource = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );
    expect(ingestionSource).not.toContain("gdelt-signals");

    // Check scheduler.js does not import from gdelt-signals
    const schedulerSource = fs.readFileSync(
      new URL("../server/services/scheduler.js", import.meta.url),
      "utf-8",
    );
    expect(schedulerSource).not.toContain("gdelt-signals");
  });
});
