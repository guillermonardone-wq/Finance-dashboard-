// ============================================================
// SIGNAL QUALITY — Filter, scoring, and consolidation tests
// ============================================================

import { describe, it, expect } from "vitest";
import { qualityFilter, scoreSignal, consolidateSignals } from "../server/services/signal-quality.js";

// ---- Helper: make a test signal ----
function makeSignal(overrides = {}) {
  return {
    source: "fred",
    category: "central_bank_action",
    entity: "FEDERAL_FUNDS_RATE",
    value: 4.5,
    previous_value: 4.25,
    change: 0.25,
    timestamp: new Date().toISOString(),
    significance: 3,
    direction: "bearish",
    summary: "Fed Funds Rate rose to 4.50%",
    title: "Fed Funds Rate rose to 4.50%",
    source_type: "fred",
    source_provider: "fred",
    reliability: "verified",
    signal_strength: 0.6,
    tags: ["auto", "fred"],
    ...overrides,
  };
}

// ================================================================
// QUALITY FILTER
// ================================================================

describe("qualityFilter", () => {
  it("passes a valid signal", () => {
    const result = qualityFilter(makeSignal());
    expect(result.pass).toBe(true);
  });

  it("rejects null signal", () => {
    const result = qualityFilter(null);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("null_signal");
  });

  it("rejects signal with missing title", () => {
    const result = qualityFilter(makeSignal({ title: "" }));
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("missing_title");
  });

  it("rejects signal with significance below threshold", () => {
    const result = qualityFilter(makeSignal({ significance: 1 }));
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("low_significance");
  });

  it("respects custom minSignificance", () => {
    const sig1 = qualityFilter(makeSignal({ significance: 1 }), { minSignificance: 1 });
    expect(sig1.pass).toBe(true);

    const sig3 = qualityFilter(makeSignal({ significance: 2 }), { minSignificance: 3 });
    expect(sig3.pass).toBe(false);
  });

  it("passes news signals at significance 2 (default threshold)", () => {
    const result = qualityFilter(makeSignal({
      source: "news",
      significance: 2,
      value: null,
      change: null,
    }));
    expect(result.pass).toBe(true);
  });

  it("rejects zero-change neutral signals", () => {
    const result = qualityFilter(makeSignal({
      change: 0,
      direction: "neutral",
      value: 100,
    }));
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("zero_change_neutral");
  });

  it("passes zero-change bearish signal (direction is meaningful)", () => {
    const result = qualityFilter(makeSignal({
      change: 0,
      direction: "bearish",
      value: 100,
    }));
    expect(result.pass).toBe(true);
  });

  it("passes signal with null significance (non-numeric signal)", () => {
    const result = qualityFilter(makeSignal({ significance: null }));
    expect(result.pass).toBe(true);
  });
});

// ================================================================
// SIGNAL SCORING
// ================================================================

describe("scoreSignal", () => {
  it("returns strength and confidence in 1-10 range", () => {
    const { strength, confidence } = scoreSignal(makeSignal());
    expect(strength).toBeGreaterThanOrEqual(1);
    expect(strength).toBeLessThanOrEqual(10);
    expect(confidence).toBeGreaterThanOrEqual(1);
    expect(confidence).toBeLessThanOrEqual(10);
  });

  it("high-significance + high-category = high strength", () => {
    const { strength } = scoreSignal(makeSignal({
      significance: 5,
      category: "military_mobilization",
    }));
    expect(strength).toBeGreaterThanOrEqual(10);
  });

  it("low-significance + low-category = low strength", () => {
    const { strength } = scoreSignal(makeSignal({
      significance: 1,
      category: "other",
    }));
    expect(strength).toBeLessThanOrEqual(3);
  });

  it("verified reliability boosts confidence", () => {
    const verified = scoreSignal(makeSignal({ reliability: "verified" }));
    const unverified = scoreSignal(makeSignal({ reliability: "unverified" }));
    expect(verified.confidence).toBeGreaterThan(unverified.confidence);
  });

  it("disputed reliability lowers confidence", () => {
    const disputed = scoreSignal(makeSignal({ reliability: "disputed" }));
    const likely = scoreSignal(makeSignal({ reliability: "likely" }));
    expect(disputed.confidence).toBeLessThan(likely.confidence);
  });

  it("numeric signal with both values gets confidence boost", () => {
    const withBoth = scoreSignal(makeSignal({ value: 5, previous_value: 4 }));
    const withoutPrev = scoreSignal(makeSignal({ value: 5, previous_value: null }));
    expect(withBoth.confidence).toBeGreaterThan(withoutPrev.confidence);
  });

  it("large percentage change boosts strength", () => {
    const bigMove = scoreSignal(makeSignal({
      significance: 3,
      change: 5,
      previous_value: 10,
    }));
    const smallMove = scoreSignal(makeSignal({
      significance: 3,
      change: 0.1,
      previous_value: 10,
    }));
    expect(bigMove.strength).toBeGreaterThan(smallMove.strength);
  });

  it("known provider (fred) boosts confidence", () => {
    const fred = scoreSignal(makeSignal({ source: "fred" }));
    const unknown = scoreSignal(makeSignal({ source: "unknown_provider" }));
    expect(fred.confidence).toBeGreaterThan(unknown.confidence);
  });

  it("GDELT high-ratio spike gets confidence boost", () => {
    const highRatio = scoreSignal(makeSignal({
      source: "gdelt",
      value: 45,
      previous_value: 10,
    }));
    const lowRatio = scoreSignal(makeSignal({
      source: "gdelt",
      value: 15,
      previous_value: 10,
    }));
    expect(highRatio.confidence).toBeGreaterThan(lowRatio.confidence);
  });

  it("caps at 10", () => {
    const maxed = scoreSignal(makeSignal({
      significance: 5,
      category: "military_mobilization",
      reliability: "verified",
      source: "fred",
      value: 100,
      previous_value: 10,
      change: 90,
    }));
    expect(maxed.strength).toBe(10);
    expect(maxed.confidence).toBeGreaterThanOrEqual(9);
  });

  it("floors at 1", () => {
    const minimal = scoreSignal(makeSignal({
      significance: 1,
      category: "other",
      reliability: "disputed",
      source: "unknown",
      value: null,
      previous_value: null,
    }));
    expect(minimal.strength).toBeGreaterThanOrEqual(1);
    expect(minimal.confidence).toBeGreaterThanOrEqual(1);
  });
});

// ================================================================
// SIGNAL CONSOLIDATION
// ================================================================

describe("consolidateSignals", () => {
  it("returns empty array for empty input", () => {
    expect(consolidateSignals([])).toEqual([]);
    expect(consolidateSignals(null)).toEqual([]);
  });

  it("returns single signal unchanged", () => {
    const signals = [makeSignal()];
    const result = consolidateSignals(signals);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(signals[0].title);
  });

  it("merges same-category + same-direction within window", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ significance: 3, timestamp: now, source: "fred" }),
      makeSignal({ significance: 2, timestamp: now, source: "worldbank" }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    expect(result).toHaveLength(1);
    expect(result[0].significance).toBe(4); // 3 + 1 boost
    expect(result[0].tags).toContain("consolidated");
    expect(result[0].summary).toContain("Corroborated");
  });

  it("does NOT merge different categories", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ category: "central_bank_action", timestamp: now }),
      makeSignal({ category: "energy_bottleneck", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    expect(result).toHaveLength(2);
  });

  it("does NOT merge different directions", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ direction: "bearish", timestamp: now }),
      makeSignal({ direction: "bullish", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    expect(result).toHaveLength(2);
  });

  it("does NOT merge signals outside time window", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const signals = [
      makeSignal({ timestamp: now.toISOString() }),
      makeSignal({ timestamp: twoHoursAgo }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 30 });
    expect(result).toHaveLength(2);
  });

  it("picks highest-significance signal as base for merge", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ significance: 2, title: "Low sig", timestamp: now }),
      makeSignal({ significance: 4, title: "High sig", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("High sig");
    expect(result[0].significance).toBe(5); // 4 + 1 boost, capped
  });

  it("caps significance at 5", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ significance: 5, timestamp: now }),
      makeSignal({ significance: 5, timestamp: now }),
      makeSignal({ significance: 5, timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    expect(result).toHaveLength(1);
    expect(result[0].significance).toBe(5);
  });

  it("boosts signal_strength for merged signals", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ signal_strength: 0.5, timestamp: now }),
      makeSignal({ signal_strength: 0.3, timestamp: now }),
      makeSignal({ signal_strength: 0.4, timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    expect(result).toHaveLength(1);
    // 0.5 (base, highest sig) + 0.2 (2 × 0.1) = 0.7
    expect(result[0].signal_strength).toBeGreaterThan(0.5);
  });

  it("handles mixed groups correctly", () => {
    const now = new Date().toISOString();
    const signals = [
      makeSignal({ category: "central_bank_action", direction: "bearish", timestamp: now }),
      makeSignal({ category: "central_bank_action", direction: "bearish", timestamp: now }),
      makeSignal({ category: "energy_bottleneck", direction: "bearish", timestamp: now }),
    ];

    const result = consolidateSignals(signals, { windowMinutes: 60 });
    // 2 central_bank merged into 1, 1 energy standalone = 2
    expect(result).toHaveLength(2);
  });
});
