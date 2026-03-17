// ============================================================
// WORLD BANK DATA360 PROVIDER — Global Macro Data
// ============================================================
// Implements the World Bank Data360 API for global macro indicators.
//
// API spec: OpenAPI 3.0.1
// Base URL: https://data360api.worldbank.org
// License: Creative Commons 4.0 by Attribution
// Authentication: None required (public API)
//
// Endpoints chosen (in priority order):
//   1. POST /data360/searchv2  — find indicators by keyword
//      Why first: enables discovery of relevant indicators
//   2. GET /data360/data       — fetch actual data series
//      Why second: core data retrieval once we know indicator IDs
//   3. GET /data360/indicators — list all indicators in a dataset
//      Why third: reference/enumeration support
//   4. POST /data360/metadata  — rich metadata for indicators
//      Why fourth: optional enrichment
//
// Primary dataset: WB_WDI (World Development Indicators)
// — the flagship World Bank dataset covering 1400+ indicators
//   across 200+ countries for 60+ years.
//
// Normalization: All observations are mapped to the internal
// macroDataPoint shape with source_attribution pointing to
// "World Bank Data360 — <dataset>/<indicator>".
// ============================================================

import { BaseProvider } from "../interface.js";

const BASE_URL = "https://data360api.worldbank.org";

// Curated default indicators for quick exploration
// These cover the most commonly needed global macro dimensions
const DEFAULT_INDICATORS = {
  // GDP & Growth
  GDP_CURRENT_USD: {
    dataset: "WB_WDI",
    code: "NY.GDP.MKTP.CD",
    name: "GDP (current US$)",
    unit: "usd",
  },
  GDP_GROWTH: {
    dataset: "WB_WDI",
    code: "NY.GDP.MKTP.KD.ZG",
    name: "GDP Growth (annual %)",
    unit: "percent",
  },
  GDP_PER_CAPITA: {
    dataset: "WB_WDI",
    code: "NY.GDP.PCAP.CD",
    name: "GDP Per Capita (current US$)",
    unit: "usd",
  },

  // Inflation
  INFLATION_CPI: {
    dataset: "WB_WDI",
    code: "FP.CPI.TOTL.ZG",
    name: "Inflation, Consumer Prices (annual %)",
    unit: "percent",
  },
  INFLATION_GDP_DEFLATOR: {
    dataset: "WB_WDI",
    code: "NY.GDP.DEFL.KD.ZG",
    name: "Inflation, GDP Deflator (annual %)",
    unit: "percent",
  },

  // Trade
  TRADE_PCT_GDP: {
    dataset: "WB_WDI",
    code: "NE.TRD.GNFS.ZS",
    name: "Trade (% of GDP)",
    unit: "percent",
  },
  CURRENT_ACCOUNT_PCT_GDP: {
    dataset: "WB_WDI",
    code: "BN.CAB.XOKA.GD.ZS",
    name: "Current Account Balance (% of GDP)",
    unit: "percent",
  },

  // Debt & Fiscal
  CENTRAL_GOVT_DEBT_PCT_GDP: {
    dataset: "WB_WDI",
    code: "GC.DOD.TOTL.GD.ZS",
    name: "Central Govt Debt (% of GDP)",
    unit: "percent",
  },

  // Population & Development
  POPULATION: {
    dataset: "WB_WDI",
    code: "SP.POP.TOTL",
    name: "Total Population",
    unit: "count",
  },
  UNEMPLOYMENT: {
    dataset: "WB_WDI",
    code: "SL.UEM.TOTL.ZS",
    name: "Unemployment (% of labor force)",
    unit: "percent",
  },

  // Energy
  ENERGY_USE_PER_CAPITA: {
    dataset: "WB_WDI",
    code: "EG.USE.PCAP.KG.OE",
    name: "Energy Use (kg oil equiv. per capita)",
    unit: "kg_oil_equiv",
  },

  // Financial
  REAL_INTEREST_RATE: {
    dataset: "WB_WDI",
    code: "FR.INR.RINR",
    name: "Real Interest Rate (%)",
    unit: "percent",
  },
  BROAD_MONEY_PCT_GDP: {
    dataset: "WB_WDI",
    code: "FM.LBL.BMNY.GD.ZS",
    name: "Broad Money (% of GDP)",
    unit: "percent",
  },
};

// Major countries/regions for quick access
const DEFAULT_COUNTRIES = [
  "USA",
  "CHN",
  "JPN",
  "DEU",
  "GBR",
  "FRA",
  "IND",
  "BRA",
  "WLD",
];

export class WorldBankProvider extends BaseProvider {
  constructor(config = {}) {
    super("worldbank", config);
    // No API key needed — public API
  }

  get capabilities() {
    return {
      prices: false,
      macroSeries: true,
      macroCalendar: false,
      news: false,
      sentiment: false,
      options: false,
      futures: false,
      forex: false,
      crypto: false,
      globalMacro: true, // custom capability for global macro search
    };
  }

  async initialize() {
    try {
      // Lightweight connectivity test — search for a common indicator
      const res = await fetch(
        `${BASE_URL}/data360/indicators?datasetId=WB_WDI`,
        {
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) throw new Error(`World Bank API returned ${res.status}`);
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      this._setError(err);
    }
  }

  // ---- SEARCH: discover indicators by keyword ----
  // Uses POST /data360/searchv2 — the most flexible discovery endpoint
  async search(query, options = {}) {
    this._trackRequest();
    try {
      const body = {
        search: query,
        select:
          "series_description/idno,series_description/name,series_description/topics",
        count: true,
        top: options.top || 20,
        skip: options.skip || 0,
      };
      if (options.filter) body.filter = options.filter;

      const res = await fetch(`${BASE_URL}/data360/searchv2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();

      return {
        total: data["@odata.count"] || data.count || 0,
        results: (data.value || []).map((item) => ({
          id: item.series_description?.idno || item.idno || "",
          name: item.series_description?.name || item.name || "",
          topics: item.series_description?.topics || [],
          source_attribution: "World Bank Data360 — Search",
        })),
      };
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // ---- INDICATORS: list available indicators for a dataset ----
  // Uses GET /data360/indicators
  async getIndicators(datasetId = "WB_WDI") {
    this._trackRequest();
    try {
      const res = await fetch(
        `${BASE_URL}/data360/indicators?datasetId=${encodeURIComponent(datasetId)}`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) throw new Error(`Indicators fetch failed: ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // ---- DATA: fetch actual observation data ----
  // Uses GET /data360/data with DATABASE_ID, INDICATOR, REF_AREA filters
  async getData(indicator, countries = [], options = {}) {
    this._trackRequest();
    const mapped = DEFAULT_INDICATORS[indicator];
    const datasetId = mapped?.dataset || options.dataset || "WB_WDI";
    const indicatorCode = mapped?.code || indicator;
    const indicatorName = mapped?.name || indicator;
    const unit = mapped?.unit || "unknown";

    try {
      const params = new URLSearchParams({
        DATABASE_ID: datasetId,
        INDICATOR: indicatorCode,
      });
      if (countries.length > 0) {
        params.set("REF_AREA", countries.join("+"));
      }
      if (options.timePeriodFrom)
        params.set("timePeriodFrom", options.timePeriodFrom);
      if (options.timePeriodTo)
        params.set("timePeriodTo", options.timePeriodTo);

      const res = await fetch(`${BASE_URL}/data360/data?${params.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Data fetch failed: ${res.status}`);
      const data = await res.json();

      const observations = (data.value || [])
        .filter((obs) => obs.OBS_VALUE != null && obs.OBS_VALUE !== "")
        .map((obs) => ({
          seriesId: indicator,
          name: indicatorName,
          value: parseFloat(obs.OBS_VALUE),
          previousValue: null,
          date: obs.TIME_PERIOD || "",
          country: obs.REF_AREA || "",
          unit,
          source_provider: this.name,
          source_attribution: `World Bank Data360 — ${datasetId}/${indicatorCode}`,
        }))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      // Fill in previousValue from sorted sequence (per country)
      const byCountry = {};
      for (const obs of observations) {
        if (!byCountry[obs.country]) byCountry[obs.country] = [];
        byCountry[obs.country].push(obs);
      }
      for (const countryObs of Object.values(byCountry)) {
        for (let i = 0; i < countryObs.length - 1; i++) {
          countryObs[i].previousValue = countryObs[i + 1].value;
        }
      }

      return {
        indicator: indicatorCode,
        name: indicatorName,
        dataset: datasetId,
        count: data.count || observations.length,
        observations,
      };
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // ---- METADATA: get rich metadata for an indicator ----
  // Uses POST /data360/metadata
  async getMetadata(datasetId, indicatorCode) {
    this._trackRequest();
    try {
      const res = await fetch(`${BASE_URL}/data360/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `&$filter=series_description/idno eq '${datasetId}_${indicatorCode}'`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // ---- Implement BaseProvider macroSeries for registry compatibility ----
  // Maps internal friendly IDs to World Bank data fetches
  async getMacroSeries(seriesId, from, to) {
    const mapped = DEFAULT_INDICATORS[seriesId];
    if (!mapped) {
      // Try fetching raw indicator code against WB_WDI
      const result = await this.getData(seriesId, DEFAULT_COUNTRIES, {
        timePeriodFrom: from,
        timePeriodTo: to,
      });
      return result.observations;
    }

    const result = await this.getData(seriesId, DEFAULT_COUNTRIES, {
      timePeriodFrom: from,
      timePeriodTo: to,
    });
    return result.observations;
  }

  // ---- Discovery helpers ----
  getAvailableIndicators() {
    return Object.entries(DEFAULT_INDICATORS).map(([id, meta]) => ({
      id,
      code: meta.code,
      name: meta.name,
      dataset: meta.dataset,
      unit: meta.unit,
    }));
  }

  getDefaultCountries() {
    return DEFAULT_COUNTRIES;
  }
}
