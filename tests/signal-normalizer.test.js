// ============================================================
// SIGNAL NORMALIZER + RULES — Unit tests
// ============================================================

import { describe, it, expect } from "vitest";
import {
  normalizeFredSignal,
  normalizeWorldBankSignal,
  normalizeMarketSignal,
  normalizeNewsSignal,
} from "../server/services/signal-normalizer.js";
import { computeDirection, computeSignificance } from "../server/services/signal-rules.js";

// ---- Direction rules ----

describe("computeDirection", () => {
  it("CPI rising → bearish", () => {
    expect(computeDirection("currency_instability", "US_CPI_YOY", 0.3)).toBe("bearish");
  });

  it("CPI falling → bullish", () => {
    expect(computeDirection("currency_instability", "US_CPI_YOY", -0.2)).toBe("bullish");
  });

  it("Fed Funds rising → bearish", () => {
    expect(computeDirection("central_bank_action", "FEDERAL_FUNDS_RATE", 0.25)).toBe("bearish");
  });

  it("Fed Funds falling → bullish", () => {
    expect(computeDirection("central_bank_action", "FEDERAL_FUNDS_RATE", -0.25)).toBe("bullish");
  });

  it("GDP rising → bullish", () => {
    expect(computeDirection("policy_shock", "US_GDP_GROWTH", 0.5)).toBe("bullish");
  });

  it("GDP falling → bearish", () => {
    expect(computeDirection("policy_shock", "US_GDP_GROWTH", -0.3)).toBe("bearish");
  });

  it("unemployment rising → bearish", () => {
    expect(computeDirection("policy_shock", "US_UNEMPLOYMENT", 0.2)).toBe("bearish");
  });

  it("unemployment falling → bullish", () => {
    expect(computeDirection("policy_shock", "US_UNEMPLOYMENT", -0.1)).toBe("bullish");
  });

  it("SPY up → bullish", () => {
    expect(computeDirection("market_data", "SPY", 5)).toBe("bullish");
  });

  it("VIX up → bearish", () => {
    expect(computeDirection("market_complacency", "VIX", 3)).toBe("bearish");
  });

  it("VIX down → bullish", () => {
    expect(computeDirection("market_complacency", "VIX", -2)).toBe("bullish");
  });

  it("USD/JPY up → bearish", () => {
    expect(computeDirection("currency_instability", "USDJPY", 1.5)).toBe("bearish");
  });

  it("zero change → neutral", () => {
    expect(computeDirection("any", "ANY", 0)).toBe("neutral");
  });

  it("null change → neutral", () => {
    expect(computeDirection("any", "ANY", null)).toBe("neutral");
  });

  it("unknown entity falls back to change sign", () => {
    expect(computeDirection("unknown", "UNKNOWN_ENTITY", 1)).toBe("bullish");
    expect(computeDirection("unknown", "UNKNOWN_ENTITY", -1)).toBe("bearish");
  });

  it("category fallback: geopolitical escalation → bearish", () => {
    expect(computeDirection("geopolitical_escalation", "SOME_ENTITY", 1)).toBe("bearish");
  });

  it("category fallback: credit_stress → bearish on rise", () => {
    expect(computeDirection("credit_stress", "SOME_ENTITY", 1)).toBe("bearish");
  });

  it("Treasury 10Y rising → bearish", () => {
    expect(computeDirection("credit_stress", "US_TREASURY_10Y", 0.1)).toBe("bearish");
  });

  it("DX (dollar index) up → bearish", () => {
    expect(computeDirection("currency_instability", "DX", 0.5)).toBe("bearish");
  });

  it("GLD up → bullish", () => {
    expect(computeDirection("commodity_chokepoint", "GLD", 10)).toBe("bullish");
  });
});

// ---- Significance rules ----

describe("computeSignificance", () => {
  it("3+ sigma → 5", () => {
    expect(computeSignificance(1.5, 0.5, 3.0)).toBe(5);
  });

  it("2-3 sigma → 4", () => {
    expect(computeSignificance(1.0, 0.5, 2.0)).toBe(4);
  });

  it("1.5-2 sigma → 3", () => {
    expect(computeSignificance(0.75, 0.5, 1.5)).toBe(3);
  });

  it("1-1.5 sigma → 2", () => {
    expect(computeSignificance(0.5, 0.5, 1.0)).toBe(2);
  });

  it("< 1 sigma → 1", () => {
    expect(computeSignificance(0.2, 0.5, 0.4)).toBe(1);
  });

  it("no stdDev: large change → high significance", () => {
    expect(computeSignificance(5, null, null)).toBe(5);
    expect(computeSignificance(2, null, null)).toBe(4);
    expect(computeSignificance(1, null, null)).toBe(3);
    expect(computeSignificance(0.5, null, null)).toBe(2);
    expect(computeSignificance(0.1, null, null)).toBe(1);
  });

  it("zero change → 1", () => {
    expect(computeSignificance(0, null, null)).toBe(1);
  });
});

// ---- FRED normalizer ----

describe("normalizeFredSignal", () => {
  it("produces correct standardized signal", () => {
    const signal = normalizeFredSignal({
      seriesId: "US_CPI_YOY",
      label: "CPI Year-over-Year",
      category: "currency_instability",
      unit: "%",
      value: 3.5,
      previousValue: 3.2,
      date: "2026-03-01",
      stdDev: 0.15,
    });

    expect(signal.source).toBe("fred");
    expect(signal.category).toBe("currency_instability");
    expect(signal.entity).toBe("US_CPI_YOY");
    expect(signal.value).toBe(3.5);
    expect(signal.previous_value).toBe(3.2);
    expect(signal.change).toBeCloseTo(0.3);
    expect(signal.timestamp).toBe("2026-03-01");
    expect(signal.direction).toBe("bearish"); // CPI rising
    expect(signal.significance).toBeGreaterThanOrEqual(2);
    expect(signal.summary).toContain("CPI Year-over-Year");
    expect(signal.summary).toContain("rose");
    expect(signal.raw_source).toBe("fred-US_CPI_YOY-2026-03-01");
    expect(signal.title).toContain("CPI Year-over-Year");
    expect(signal.tags).toContain("fred");
    expect(signal.reliability).toBe("verified");
  });

  it("falling value produces bullish direction for CPI", () => {
    const signal = normalizeFredSignal({
      seriesId: "US_CPI_YOY",
      label: "CPI",
      category: "currency_instability",
      unit: "%",
      value: 3.0,
      previousValue: 3.5,
      date: "2026-03-01",
      stdDev: 0.15,
    });

    expect(signal.direction).toBe("bullish");
    expect(signal.summary).toContain("fell");
  });

  it("handles null stdDev gracefully", () => {
    const signal = normalizeFredSignal({
      seriesId: "TEST",
      label: "Test",
      category: "other",
      unit: "%",
      value: 5.0,
      previousValue: 4.0,
      date: "2026-01-01",
      stdDev: null,
    });

    expect(signal.significance).toBeGreaterThanOrEqual(1);
    expect(signal.summary).toContain("change");
  });
});

// ---- World Bank normalizer ----

describe("normalizeWorldBankSignal", () => {
  it("produces correct standardized signal", () => {
    const signal = normalizeWorldBankSignal({
      indicatorCode: "NY.GDP.MKTP.KD.ZG",
      indicatorName: "GDP Growth",
      category: "policy_shock",
      country: "USA",
      value: 2.5,
      previousValue: 2.1,
      date: "2025",
    });

    expect(signal.source).toBe("worldbank");
    expect(signal.entity).toBe("NY.GDP.MKTP.KD.ZG_USA");
    expect(signal.value).toBe(2.5);
    expect(signal.previous_value).toBe(2.1);
    expect(signal.change).toBeCloseTo(0.4);
    expect(signal.direction).toBe("bullish"); // GDP rising
    expect(signal.summary).toContain("GDP Growth");
    expect(signal.summary).toContain("USA");
    expect(signal.raw_source).toContain("worldbank-NY.GDP.MKTP.KD.ZG-USA");
  });

  it("handles null previousValue", () => {
    const signal = normalizeWorldBankSignal({
      indicatorCode: "TEST",
      indicatorName: "Test",
      category: "other",
      country: "CHN",
      value: 5.0,
      previousValue: null,
      date: "2025",
    });

    expect(signal.change).toBe(0);
    expect(signal.previous_value).toBeNull();
  });
});

// ---- Market normalizer ----

describe("normalizeMarketSignal", () => {
  it("produces correct signal for equity move", () => {
    const signal = normalizeMarketSignal({
      symbol: "SPY",
      name: "S&P 500 ETF",
      category: "market_data",
      value: 530.0,
      previousValue: 525.0,
      changePercent: 0.95,
      provider: "finnhub",
      timestamp: "2026-03-17T10:00:00Z",
    });

    expect(signal.source).toBe("finnhub");
    expect(signal.entity).toBe("SPY");
    expect(signal.value).toBe(530.0);
    expect(signal.direction).toBe("bullish");
    expect(signal.significance).toBeLessThanOrEqual(2); // < 1% move
    expect(signal.summary).toContain("up");
    expect(signal.summary).toContain("530.00");
  });

  it("large negative move → high significance", () => {
    const signal = normalizeMarketSignal({
      symbol: "VIX",
      name: "Volatility Index",
      category: "market_complacency",
      value: 30,
      previousValue: 20,
      changePercent: 50,
      provider: "finnhub",
    });

    expect(signal.significance).toBe(5);
    expect(signal.direction).toBe("bearish"); // VIX up → bearish
  });
});

// ---- News normalizer ----

describe("normalizeNewsSignal", () => {
  it("produces correct signal", () => {
    const signal = normalizeNewsSignal({
      title: "Federal Reserve signals potential rate cut in June",
      description: "Fed chair hints at easing cycle",
      url: "https://example.com/article",
      source: "Reuters",
      publishedAt: "2026-03-17T08:00:00Z",
      provider: "newsapi",
    });

    expect(signal.source).toBe("newsapi");
    expect(signal.category).toBe("central_bank_action"); // auto-categorized from "federal reserve" + "rate"
    expect(signal.direction).toBe("neutral");
    expect(signal.significance).toBe(2);
    expect(signal.summary).toContain("Federal Reserve");
    expect(signal.source_url).toBe("https://example.com/article");
  });

  it("categorizes oil news correctly", () => {
    const signal = normalizeNewsSignal({
      title: "Oil prices surge on OPEC production cut",
      description: "Crude oil jumps",
      provider: "newsapi",
    });

    expect(signal.category).toBe("energy_bottleneck");
  });

  it("categorizes sanctions news correctly", () => {
    const signal = normalizeNewsSignal({
      title: "EU announces new sanctions on Russian exports",
      provider: "newsapi",
    });

    expect(signal.category).toBe("sanctions_risk");
  });

  it("falls back to 'other' for unrecognized topics", () => {
    const signal = normalizeNewsSignal({
      title: "Scientists discover new species in deep ocean",
      provider: "newsapi",
    });

    expect(signal.category).toBe("other");
  });
});
