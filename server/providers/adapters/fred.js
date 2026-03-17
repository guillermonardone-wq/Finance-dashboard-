import { BaseProvider } from "../interface.js";

const BASE_URL = "https://api.stlouisfed.org/fred";

// Map of friendly series IDs to FRED series codes
const SERIES_MAP = {
  // Growth
  US_GDP: {
    code: "GDP",
    name: "US Gross Domestic Product",
    unit: "billions_usd",
    freq: "Quarterly",
  },
  US_REAL_GDP: {
    code: "GDPC1",
    name: "US Real GDP",
    unit: "billions_usd",
    freq: "Quarterly",
  },
  US_GDP_GROWTH: {
    code: "A191RL1Q225SBEA",
    name: "US Real GDP Growth Rate",
    unit: "percent",
    freq: "Quarterly",
  },

  // Inflation
  US_CPI: {
    code: "CPIAUCSL",
    name: "US CPI (All Urban Consumers)",
    unit: "index",
    freq: "Monthly",
  },
  US_CPI_YOY: {
    code: "CPIAUCSL",
    name: "US CPI Year-over-Year",
    unit: "percent",
    freq: "Monthly",
    transform: "pc1",
  },
  US_CORE_CPI: {
    code: "CPILFESL",
    name: "US Core CPI (ex Food & Energy)",
    unit: "index",
    freq: "Monthly",
  },
  US_PCE: {
    code: "PCEPI",
    name: "US PCE Price Index",
    unit: "index",
    freq: "Monthly",
  },
  US_CORE_PCE: {
    code: "PCEPILFE",
    name: "US Core PCE Price Index",
    unit: "index",
    freq: "Monthly",
  },
  US_INFLATION: {
    code: "T10YIE",
    name: "10-Year Breakeven Inflation",
    unit: "percent",
    freq: "Daily",
  },

  // Employment
  US_UNEMPLOYMENT: {
    code: "UNRATE",
    name: "US Unemployment Rate",
    unit: "percent",
    freq: "Monthly",
  },
  US_NONFARM: {
    code: "PAYEMS",
    name: "US Nonfarm Payrolls",
    unit: "thousands",
    freq: "Monthly",
  },
  US_INITIAL_CLAIMS: {
    code: "ICSA",
    name: "Initial Jobless Claims",
    unit: "thousands",
    freq: "Weekly",
  },

  // Interest Rates
  FEDERAL_FUNDS_RATE: {
    code: "FEDFUNDS",
    name: "Federal Funds Effective Rate",
    unit: "percent",
    freq: "Monthly",
  },
  FED_FUNDS_UPPER: {
    code: "DFEDTARU",
    name: "Fed Funds Target Upper",
    unit: "percent",
    freq: "Daily",
  },
  FED_FUNDS_LOWER: {
    code: "DFEDTARL",
    name: "Fed Funds Target Lower",
    unit: "percent",
    freq: "Daily",
  },

  // Treasury Yields
  US_TREASURY_3M: {
    code: "DGS3MO",
    name: "US 3-Month Treasury Yield",
    unit: "percent",
    freq: "Daily",
  },
  US_TREASURY_2Y: {
    code: "DGS2",
    name: "US 2-Year Treasury Yield",
    unit: "percent",
    freq: "Daily",
  },
  US_TREASURY_5Y: {
    code: "DGS5",
    name: "US 5-Year Treasury Yield",
    unit: "percent",
    freq: "Daily",
  },
  US_TREASURY_10Y: {
    code: "DGS10",
    name: "US 10-Year Treasury Yield",
    unit: "percent",
    freq: "Daily",
  },
  US_TREASURY_30Y: {
    code: "DGS30",
    name: "US 30-Year Treasury Yield",
    unit: "percent",
    freq: "Daily",
  },
  US_TREASURY_YIELD: {
    code: "DGS10",
    name: "US 10-Year Treasury Yield",
    unit: "percent",
    freq: "Daily",
  },

  // Yield Curve
  YIELD_CURVE_10Y2Y: {
    code: "T10Y2Y",
    name: "10Y-2Y Treasury Spread",
    unit: "percent",
    freq: "Daily",
  },
  YIELD_CURVE_10Y3M: {
    code: "T10Y3M",
    name: "10Y-3M Treasury Spread",
    unit: "percent",
    freq: "Daily",
  },

  // Volatility
  VIX: { code: "VIXCLS", name: "CBOE VIX", unit: "index", freq: "Daily" },

  // Dollar
  US_DOLLAR_INDEX: {
    code: "DTWEXBGS",
    name: "Trade-Weighted US Dollar Index",
    unit: "index",
    freq: "Daily",
  },

  // Money Supply
  US_M2: {
    code: "M2SL",
    name: "US M2 Money Supply",
    unit: "billions_usd",
    freq: "Monthly",
  },

  // Housing
  US_HOUSING_STARTS: {
    code: "HOUST",
    name: "US Housing Starts",
    unit: "thousands",
    freq: "Monthly",
  },
};

export class FredProvider extends BaseProvider {
  constructor(config = {}) {
    super("fred", config);
    this.apiKey = config.apiKey || process.env.FRED_API_KEY;
  }

  get capabilities() {
    return {
      prices: false,
      macroSeries: true,
      macroCalendar: true,
      news: false,
      sentiment: false,
      options: false,
      futures: false,
      forex: false,
      crypto: false,
    };
  }

  async initialize() {
    if (!this.apiKey) {
      this.enabled = false;
      this._setError(new Error("No API key configured"));
      return;
    }
    try {
      // Lightweight test — fetch metadata for FEDFUNDS
      const res = await fetch(
        `${BASE_URL}/series?series_id=FEDFUNDS&api_key=${this.apiKey}&file_type=json`,
      );
      const data = await res.json();
      if (data.error_code || data.error_message) {
        throw new Error(data.error_message || `FRED error ${data.error_code}`);
      }
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      this._setError(err);
    }
  }

  async _fetch(endpoint, params = {}) {
    this._trackRequest();
    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("file_type", "json");
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error_code || data.error_message) {
      throw new Error(data.error_message || `FRED error ${data.error_code}`);
    }
    return data;
  }

  // Get a macro time series by friendly ID or raw FRED code
  async getMacroSeries(seriesId, from, to) {
    const mapped = SERIES_MAP[seriesId];
    const code = mapped ? mapped.code : seriesId; // allow raw FRED codes too
    const name = mapped ? mapped.name : seriesId;
    const unit = mapped ? mapped.unit : "unknown";

    const params = {
      series_id: code,
      sort_order: "desc",
      limit: 100,
    };
    if (mapped?.transform) params.units = mapped.transform;
    if (from) params.observation_start = from;
    if (to) params.observation_end = to;

    try {
      const data = await this._fetch("series/observations", params);
      const observations = (data.observations || []).filter(
        (o) => o.value !== ".",
      ); // FRED uses '.' for missing data

      return observations.map((obs, i) => ({
        seriesId,
        name,
        value: parseFloat(obs.value),
        previousValue: observations[i + 1]
          ? parseFloat(observations[i + 1].value)
          : null,
        date: obs.date,
        unit,
        source_provider: this.name,
        source_attribution: `FRED (Federal Reserve) — ${code}`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // Get upcoming economic release dates
  async getMacroCalendar(from, to) {
    try {
      const params = { limit: 50 };
      if (from) params.realtime_start = from;
      if (to) params.realtime_end = to;
      // Include future releases only
      params.include_release_dates_with_no_data = "true";

      const data = await this._fetch("releases/dates", params);
      const dates = data.release_dates || [];

      return dates.map((rd) => ({
        eventId: `fred-release-${rd.release_id}-${rd.date}`,
        title: rd.release_name || `FRED Release #${rd.release_id}`,
        country: "US",
        date: rd.date,
        time: null,
        impact: "medium",
        forecast: null,
        previous: null,
        actual: null,
        unit: "",
        source_provider: this.name,
        source_attribution: "FRED (Federal Reserve) — Release Calendar",
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // Convenience: get a yield curve snapshot (3M, 2Y, 5Y, 10Y, 30Y)
  async getYieldCurve() {
    const maturities = [
      "US_TREASURY_3M",
      "US_TREASURY_2Y",
      "US_TREASURY_5Y",
      "US_TREASURY_10Y",
      "US_TREASURY_30Y",
    ];
    const results = await Promise.all(
      maturities.map(async (id) => {
        try {
          const series = await this.getMacroSeries(id);
          const latest = series[0];
          return latest
            ? {
                maturity: id.replace("US_TREASURY_", ""),
                rate: latest.value,
                date: latest.date,
              }
            : null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter(Boolean);
  }

  // List available series IDs for discovery
  getAvailableSeries() {
    return Object.entries(SERIES_MAP).map(([id, meta]) => ({
      id,
      code: meta.code,
      name: meta.name,
      unit: meta.unit,
      frequency: meta.freq,
    }));
  }
}
