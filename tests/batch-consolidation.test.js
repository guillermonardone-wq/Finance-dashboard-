// ============================================================
// BATCH CONSOLIDATION — Cross-source pipeline tests
// ============================================================
// Verifies that runIngestionPipeline applies consolidateSignals()
// at the batch level before quality/dedup/store.
// ============================================================

import { describe, it, expect } from "vitest";
import { consolidateSignals, qualityFilter, scoreSignal } from "../server/services/signal-quality.js";

// ---- Helper: make a test signal from a specific provider ----
function makeSignal(source, overrides = {}) {
  const now = new Date().toISOString();
  return {
    source,
    source_provider: source,
    category: "energy_bottleneck",
    entity: `${source}_oil_signal`,
    value: 85,
    previous_value: 80,
    change: 5,
    timestamp: now,
    significance: 3,
    direction: "bearish",
    summary: `Oil disruption signal from ${source}`,
    title: `${source}: Oil supply disruption detected`,
    source_type: source,
    reliability: "verified",
    signal_strength: 0.6,
    tags: ["auto", source],
    ...overrides,
  };
}

// ================================================================
// 1. MULTIPLE PROVIDERS → ONE CONSOLIDATED SIGNAL
// ================================================================

describe("cross-source consolidation", () => {
  it("merges same-category same-direction signals from different providers", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal("fred", { timestamp: now, significance: 3 }),
      makeSignal("gdelt", { timestamp: now, significance: 2 }),
      makeSignal("news", { timestamp: now, significance: 2 }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });

    // 3 signals → 1 consolidated
    expect(result).toHaveLength(1);
    expect(result[0].tags).toContain("consolidated");
    // Base is highest significance (fred, sig=3), boosted to 4
    expect(result[0].significance).toBe(4);
    expect(result[0].summary).toContain("Corroborated");
    expect(result[0].summary).toContain("2 similar signals");
  });

  it("merged signal has higher strength and confidence than individuals", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal("fred", { timestamp: now, significance: 3, signal_strength: 0.5 }),
      makeSignal("gdelt", { timestamp: now, significance: 2, signal_strength: 0.3 }),
    ];

    // Score individual signals before consolidation
    const individualScores = signals.map((s) => scoreSignal(s));

    // Consolidate
    const consolidated = consolidateSignals(signals, { windowMinutes: 30 });
    expect(consolidated).toHaveLength(1);

    // Score the consolidated signal
    const mergedScore = scoreSignal(consolidated[0]);

    // Merged signal should score equal or higher (boosted significance → higher strength)
    expect(mergedScore.strength).toBeGreaterThanOrEqual(
      Math.max(...individualScores.map((s) => s.strength)),
    );

    // Signal_strength is directly boosted
    expect(consolidated[0].signal_strength).toBeGreaterThan(0.5);
  });
});

// ================================================================
// 2. CONFLICTING SIGNALS REMAIN SEPARATE
// ================================================================

describe("conflicting signals stay separate", () => {
  it("opposite directions are NOT merged", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal("fred", { direction: "bullish", timestamp: now }),
      makeSignal("gdelt", { direction: "bearish", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    expect(result).toHaveLength(2);
    expect(result.some((s) => s.direction === "bullish")).toBe(true);
    expect(result.some((s) => s.direction === "bearish")).toBe(true);
  });

  it("different categories are NOT merged", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal("fred", { category: "energy_bottleneck", timestamp: now }),
      makeSignal("gdelt", { category: "military_mobilization", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    expect(result).toHaveLength(2);
  });

  it("same category but different directions are NOT merged", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal("fred", { category: "central_bank_action", direction: "bearish", timestamp: now }),
      makeSignal("worldbank", { category: "central_bank_action", direction: "bullish", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    expect(result).toHaveLength(2);
  });
});

// ================================================================
// 3. CONSOLIDATION INCREASES STRENGTH/CONFIDENCE
// ================================================================

describe("consolidation quality boost", () => {
  it("significance is boosted by 1 (capped at 5)", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal("fred", { significance: 4, timestamp: now }),
      makeSignal("gdelt", { significance: 3, timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    expect(result).toHaveLength(1);
    // Base is sig=4 (highest), boosted to 5 (cap)
    expect(result[0].significance).toBe(5);
  });

  it("signal_strength increases with more corroborating sources", () => {
    const now = new Date().toISOString();
    const twoSignals = consolidateSignals([
      makeSignal("fred", { signal_strength: 0.5, timestamp: now }),
      makeSignal("gdelt", { signal_strength: 0.4, timestamp: now }),
    ], { windowMinutes: 30 });

    const threeSignals = consolidateSignals([
      makeSignal("fred", { signal_strength: 0.5, timestamp: now }),
      makeSignal("gdelt", { signal_strength: 0.4, timestamp: now }),
      makeSignal("acled", { signal_strength: 0.3, timestamp: now }),
    ], { windowMinutes: 30 });

    expect(twoSignals).toHaveLength(1);
    expect(threeSignals).toHaveLength(1);
    // 3 sources → higher signal_strength than 2 sources
    expect(threeSignals[0].signal_strength).toBeGreaterThan(twoSignals[0].signal_strength);
  });

  it("corroboration note lists contributing sources", () => {
    const now = new Date().toISOString();
    const result = consolidateSignals([
      makeSignal("fred", { timestamp: now }),
      makeSignal("gdelt", { timestamp: now }),
      makeSignal("acled", { timestamp: now }),
    ], { windowMinutes: 30 });

    expect(result).toHaveLength(1);
    expect(result[0].summary).toContain("gdelt");
    expect(result[0].summary).toContain("acled");
  });

  it("consolidated signal still passes quality filter", () => {
    const now = new Date().toISOString();
    const result = consolidateSignals([
      makeSignal("fred", { significance: 3, timestamp: now }),
      makeSignal("gdelt", { significance: 2, timestamp: now }),
    ], { windowMinutes: 30 });

    const { pass } = qualityFilter(result[0]);
    expect(pass).toBe(true);
  });
});

// ================================================================
// 4. NO DATA LOSS IN EDGE CASES
// ================================================================

describe("consolidation safety", () => {
  it("single signal passes through unchanged", () => {
    const signal = makeSignal("fred");
    const result = consolidateSignals([signal], { windowMinutes: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(signal.title);
    expect(result[0].tags).not.toContain("consolidated");
  });

  it("empty array returns empty", () => {
    expect(consolidateSignals([])).toEqual([]);
  });

  it("null input returns empty array", () => {
    expect(consolidateSignals(null)).toEqual([]);
  });

  it("signals outside time window remain separate", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const signals = [
      makeSignal("fred", { timestamp: now.toISOString() }),
      makeSignal("gdelt", { timestamp: twoHoursAgo.toISOString() }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    expect(result).toHaveLength(2);
  });

  it("mixed groups: some merge, some don't", () => {
    const now = new Date().toISOString();
    const signals = [
      // These 2 should merge (energy_bottleneck + bearish)
      makeSignal("fred", { category: "energy_bottleneck", direction: "bearish", timestamp: now }),
      makeSignal("gdelt", { category: "energy_bottleneck", direction: "bearish", timestamp: now }),
      // This stays separate (different category)
      makeSignal("acled", { category: "geopolitical_escalation", direction: "bearish", timestamp: now }),
      // This stays separate (different direction)
      makeSignal("market", { category: "energy_bottleneck", direction: "bullish", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    // 2 merged into 1 + 1 geopolitical + 1 bullish = 3
    expect(result).toHaveLength(3);
  });

  it("consolidated signal retains base signal's core fields", () => {
    const now = new Date().toISOString();
    const base = makeSignal("fred", {
      significance: 4,
      entity: "fred_oil_signal",
      category: "energy_bottleneck",
      value: 85,
      raw_source: "fred-oil-2026-03-18",
      timestamp: now,
    });
    const corroborating = makeSignal("gdelt", {
      significance: 2,
      timestamp: now,
    });

    const result = consolidateSignals([base, corroborating], { windowMinutes: 30 });
    expect(result).toHaveLength(1);

    // Base fields preserved
    expect(result[0].entity).toBe("fred_oil_signal");
    expect(result[0].category).toBe("energy_bottleneck");
    expect(result[0].value).toBe(85);
    expect(result[0].raw_source).toBe("fred-oil-2026-03-18");
  });
});

// ================================================================
// 5. PIPELINE STRUCTURE VERIFICATION
// ================================================================

describe("pipeline batch flow", () => {
  it("runIngestionPipeline uses collect → consolidate → process flow", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    // Phase 1: collect from all sources
    expect(source).toContain("collectFredSignals()");
    expect(source).toContain("collectWorldBankSignals()");
    expect(source).toContain("collectMarketSignals()");
    expect(source).toContain("collectNewsSignals()");
    expect(source).toContain("collectGdeltSignals()");
    expect(source).toContain("collectAcledSignals()");

    // Phase 2: consolidate batch
    expect(source).toContain("consolidateSignals(allSignals");

    // Phase 3: process each signal (quality + dedup + store)
    expect(source).toContain("processSignal(knex, signal, userId)");
  });

  it("consolidateSignals is imported from signal-quality.js", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    expect(source).toContain("consolidateSignals } from \"./signal-quality.js\"");
  });

  it("pipeline reports totalConsolidated count", async () => {
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("../server/services/signal-ingestion.js", import.meta.url),
      "utf-8",
    );

    expect(source).toContain("totalConsolidated");
  });
});
