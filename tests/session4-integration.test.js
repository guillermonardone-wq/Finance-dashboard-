// ============================================================
// SESSION 4 INTEGRATION TESTS
// ============================================================
// Tests for: ACLED, GDELT baseline, Polymarket wire, unified pipeline
// ============================================================

import { describe, it, expect } from "vitest";

// ================================================================
// 1. ACLED NORMALIZATION SHAPE
// ================================================================

describe("ACLED normalizer", () => {
  let normalizeAcledSignal;

  it("loads normalizer", async () => {
    const mod = await import("../server/services/signal-normalizer.js");
    normalizeAcledSignal = mod.normalizeAcledSignal;
    expect(normalizeAcledSignal).toBeTypeOf("function");
  });

  it("produces correct signal shape", () => {
    const signal = normalizeAcledSignal({
      country: "Ukraine",
      region: "Eastern Europe",
      totalEvents: 30,
      totalFatalities: 50,
      eventTypes: ["Battles", "Explosions/Remote violence"],
      topActors: ["Military Forces of Russia", "Military Forces of Ukraine"],
      latestDate: "2026-03-15",
    });

    expect(signal).not.toBeNull();
    expect(signal.source).toBe("acled");
    expect(signal.category).toBe("geopolitical_escalation");
    expect(signal.entity).toBe("acled_ukraine");
    expect(signal.value).toBe(30);
    expect(signal.direction).toBe("bearish");
    expect(signal.significance).toBe(4); // 50 fatalities → sig 4
    expect(signal.title).toContain("Ukraine");
    expect(signal.title).toContain("30 events");
    expect(signal.title).toContain("50 fatalities");
    expect(signal.summary).toContain("Eastern Europe");
    expect(signal.summary).toContain("Battles");
    expect(signal.raw_source).toContain("acled-ukraine-2026-03-15");
    expect(signal.reliability).toBe("verified");
    expect(signal.tags).toContain("acled");
    expect(signal.source_provider).toBe("acled");
  });

  it("high intensity → significance 5", () => {
    const signal = normalizeAcledSignal({
      country: "Syria",
      region: "Western Asia",
      totalEvents: 60,
      totalFatalities: 120,
      eventTypes: ["Battles"],
      topActors: [],
      latestDate: "2026-03-10",
    });
    expect(signal.significance).toBe(5);
  });

  it("low intensity → significance 2", () => {
    const signal = normalizeAcledSignal({
      country: "Lebanon",
      region: "Western Asia",
      totalEvents: 6,
      totalFatalities: 12,
      eventTypes: ["Protests"],
      topActors: [],
      latestDate: "2026-03-10",
    });
    expect(signal.significance).toBe(2);
  });

  it("returns null for missing country", () => {
    const signal = normalizeAcledSignal({
      country: null,
      region: "Western Asia",
      totalEvents: 10,
      totalFatalities: 5,
      eventTypes: [],
      topActors: [],
      latestDate: "2026-03-10",
    });
    expect(signal).toBeNull();
  });

  it("returns null for missing totalEvents", () => {
    const signal = normalizeAcledSignal({
      country: "Iraq",
      region: "Western Asia",
      totalEvents: null,
      totalFatalities: 5,
      eventTypes: [],
      topActors: [],
      latestDate: "2026-03-10",
    });
    expect(signal).toBeNull();
  });

  it("signal_strength scales with events/fatalities", () => {
    const high = normalizeAcledSignal({
      country: "Sudan",
      region: "Northern Africa",
      totalEvents: 100,
      totalFatalities: 200,
      eventTypes: ["Battles"],
      topActors: [],
      latestDate: "2026-03-10",
    });
    const low = normalizeAcledSignal({
      country: "Chad",
      region: "Northern Africa",
      totalEvents: 5,
      totalFatalities: 3,
      eventTypes: ["Protests"],
      topActors: [],
      latestDate: "2026-03-10",
    });
    expect(high.signal_strength).toBeGreaterThan(low.signal_strength);
  });
});

// ================================================================
// 2. ACLED MALFORMED PAYLOAD SAFETY
// ================================================================

describe("ACLED provider safety", () => {
  let parseAcledRow, aggregateByCountry, detectIntensitySpikes;

  it("loads ACLED provider", async () => {
    const mod = await import("../server/providers/acled.js");
    parseAcledRow = mod.parseAcledRow;
    aggregateByCountry = mod.aggregateByCountry;
    detectIntensitySpikes = mod.detectIntensitySpikes;
    expect(parseAcledRow).toBeTypeOf("function");
    expect(aggregateByCountry).toBeTypeOf("function");
    expect(detectIntensitySpikes).toBeTypeOf("function");
  });

  it("parseAcledRow returns null for null input", () => {
    expect(parseAcledRow(null)).toBeNull();
  });

  it("parseAcledRow returns null for missing critical fields", () => {
    expect(parseAcledRow({})).toBeNull();
    expect(parseAcledRow({ event_id_cnty: "1" })).toBeNull(); // missing date, type, country
    expect(parseAcledRow({ event_id_cnty: "1", event_date: "2026-01-01" })).toBeNull(); // missing type, country
  });

  it("parseAcledRow handles malformed fatalities", () => {
    const row = parseAcledRow({
      event_id_cnty: "IRQ123",
      event_date: "2026-03-10",
      event_type: "Battles",
      country: "Iraq",
      fatalities: "not-a-number",
    });
    expect(row).not.toBeNull();
    expect(row.fatalities).toBe(0);
  });

  it("parseAcledRow handles negative fatalities", () => {
    const row = parseAcledRow({
      event_id_cnty: "IRQ124",
      event_date: "2026-03-10",
      event_type: "Battles",
      country: "Iraq",
      fatalities: -5,
    });
    expect(row.fatalities).toBe(0);
  });

  it("parseAcledRow handles invalid coordinates", () => {
    const row = parseAcledRow({
      event_id_cnty: "IRQ125",
      event_date: "2026-03-10",
      event_type: "Battles",
      country: "Iraq",
      latitude: 999, // invalid
      longitude: "abc", // invalid
    });
    expect(row.latitude).toBeNull();
    expect(row.longitude).toBeNull();
  });

  it("parseAcledRow parses valid coordinates", () => {
    const row = parseAcledRow({
      event_id_cnty: "IRQ126",
      event_date: "2026-03-10",
      event_type: "Battles",
      country: "Iraq",
      latitude: 33.3,
      longitude: 44.4,
    });
    expect(row.latitude).toBe(33.3);
    expect(row.longitude).toBe(44.4);
  });

  it("aggregateByCountry groups correctly", () => {
    const events = [
      { country: "Iraq", region: "Western Asia", event_type: "Battles", fatalities: 5, actor1: "A", event_date: "2026-03-10" },
      { country: "Iraq", region: "Western Asia", event_type: "Explosions/Remote violence", fatalities: 3, actor1: "A", event_date: "2026-03-11" },
      { country: "Syria", region: "Western Asia", event_type: "Battles", fatalities: 10, actor1: "B", event_date: "2026-03-10" },
    ];
    const aggs = aggregateByCountry(events);
    expect(aggs.size).toBe(2);

    const iraq = aggs.get("Iraq");
    expect(iraq.totalEvents).toBe(2);
    expect(iraq.totalFatalities).toBe(8);
    expect(iraq.eventTypes).toContain("Battles");
    expect(iraq.eventTypes).toContain("Explosions/Remote violence");
    expect(iraq.latestDate).toBe("2026-03-11");
  });

  it("detectIntensitySpikes filters by thresholds", () => {
    const events = [];
    // Iraq: 10 events, 15 fatalities — should trigger
    for (let i = 0; i < 10; i++) {
      events.push({ country: "Iraq", region: "Western Asia", event_type: "Battles", fatalities: i < 5 ? 3 : 0, actor1: "A", event_date: "2026-03-10" });
    }
    // France: 2 events, 0 fatalities — should not trigger
    for (let i = 0; i < 2; i++) {
      events.push({ country: "France", region: "Western Europe", event_type: "Protests", fatalities: 0, actor1: "C", event_date: "2026-03-10" });
    }

    const aggs = aggregateByCountry(events);
    const spikes = detectIntensitySpikes(aggs, { minEvents: 5, minFatalities: 10 });
    const countries = spikes.map((s) => s.country);
    expect(countries).toContain("Iraq");
    expect(countries).not.toContain("France");
  });
});

// ================================================================
// 3. GDELT BASELINE WARMUP BEHAVIOR
// ================================================================

describe("GDELT baseline warmup", () => {
  it("warmGdeltBaseline is exported and callable", async () => {
    const mod = await import("../server/services/signal-ingestion.js");
    expect(mod.warmGdeltBaseline).toBeTypeOf("function");
  });

  it("warmGdeltBaseline returns structured result", async () => {
    // In test environment (no real DB), it should fail gracefully
    const mod = await import("../server/services/signal-ingestion.js");
    const result = await mod.warmGdeltBaseline();
    expect(result).toHaveProperty("warmed");
    expect(result).toHaveProperty("reason");
    // Should either be warmed:false (no db) or warmed:true (has history)
    expect(typeof result.warmed).toBe("boolean");
  });
});

// ================================================================
// 4. POLYMARKET WIRE SCORING INPUT SHAPE
// ================================================================

describe("Polymarket scoring wire", () => {
  let getPolymarketScoringInput, getPolymarketWireStatus;

  it("loads polymarket wire module", async () => {
    const mod = await import("../server/services/polymarket-scoring-wire.js");
    getPolymarketScoringInput = mod.getPolymarketScoringInput;
    getPolymarketWireStatus = mod.getPolymarketWireStatus;
    expect(getPolymarketScoringInput).toBeTypeOf("function");
    expect(getPolymarketWireStatus).toBeTypeOf("function");
  });

  it("getPolymarketScoringInput returns correct no-data shape", async () => {
    // With no real DB, should return graceful no-data response
    const result = await getPolymarketScoringInput("nonexistent-thesis-id");
    expect(result).toHaveProperty("available");
    expect(result).toHaveProperty("divergence_score");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("implied_probability");
    expect(result).toHaveProperty("consensus_state");
    expect(result).toHaveProperty("commentary");
    expect(result).toHaveProperty("qualifying_contracts");
    expect(result).toHaveProperty("warnings");
    expect(result.available).toBe(false);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("getPolymarketWireStatus returns correct shape", async () => {
    const result = await getPolymarketWireStatus();
    expect(result).toHaveProperty("available");
    expect(result).toHaveProperty("provider");
    expect(result).toHaveProperty("eventCount");
    expect(typeof result.available).toBe("boolean");
  });
});

// ================================================================
// 5. ACTIVE INGESTION PATH — UNIFIED PIPELINE
// ================================================================

describe("unified ingestion pipeline integrity", () => {
  it("scheduler imports only from signal-ingestion.js", async () => {
    const fs = await import("fs");
    const schedulerSource = fs.readFileSync(
      new URL("../server/services/scheduler.js", import.meta.url),
      "utf-8",
    );

    // Must import from signal-ingestion
    expect(schedulerSource).toContain("signal-ingestion.js");

    // Must NOT import from legacy files
    expect(schedulerSource).not.toContain("fred-signals");
    expect(schedulerSource).not.toContain("gdelt-signals");

    // Must import warmGdeltBaseline
    expect(schedulerSource).toContain("warmGdeltBaseline");
  });

  it("signal-ingestion.js imports ACLED normalizer", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    expect(source).toContain("normalizeAcledSignal");
    expect(source).toContain("ingestAcledSignals");
    expect(source).toContain("warmGdeltBaseline");
  });

  it("runIngestionPipeline includes ACLED in mock mode", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    // Mock mode section should list acled
    expect(source).toContain('"acled"');
  });

  it("pipeline calls all 6 sources in parallel", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    // Should destructure 6 results
    expect(source).toContain("ingestAcledSignals(userId)");
    expect(source).toContain("ingestFredSignals(userId)");
    expect(source).toContain("ingestWorldBankSignals(userId)");
    expect(source).toContain("ingestMarketSignals(userId)");
    expect(source).toContain("ingestNewsSignals(userId)");
    expect(source).toContain("ingestGdeltSignals(userId)");
  });

  it("legacy files are in legacy/ folder, not in active services/", async () => {
    const fs = await import("fs");

    const legacyFred = fs.existsSync(
      new URL("../server/services/legacy/fred-signals.js", import.meta.url),
    );
    const legacyGdelt = fs.existsSync(
      new URL("../server/services/legacy/gdelt-signals.js", import.meta.url),
    );
    expect(legacyFred).toBe(true);
    expect(legacyGdelt).toBe(true);

    const activeFred = fs.existsSync(
      new URL("../server/services/fred-signals.js", import.meta.url),
    );
    const activeGdelt = fs.existsSync(
      new URL("../server/services/gdelt-signals.js", import.meta.url),
    );
    expect(activeFred).toBe(false);
    expect(activeGdelt).toBe(false);
  });

  it("ingestion-status tracks per-source status", async () => {
    const { ingestionStatus } = await import("../server/services/ingestion-status.js");

    // Mark some source statuses
    ingestionStatus.markSourceStatus("gdelt", { status: "ok", lastCount: 5, baselineWarmed: true });
    ingestionStatus.markSourceStatus("acled", { status: "ok", lastCount: 3 });
    ingestionStatus.markSourceStatus("polymarket", { available: true, eventCount: 3 });

    const status = ingestionStatus.getStatus();
    expect(status.sources).toBeDefined();
    expect(status.sources.gdelt.status).toBe("ok");
    expect(status.sources.gdelt.baselineWarmed).toBe(true);
    expect(status.sources.acled.status).toBe("ok");
    expect(status.sources.acled.lastCount).toBe(3);
    expect(status.sources.polymarket.available).toBe(true);
    expect(status.sources.polymarket.eventCount).toBe(3);
  });
});
