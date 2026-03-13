// ============================================================
// PROVIDER INTERFACE — Abstract contract all adapters must implement
// ============================================================
// Every market data provider adapter MUST extend BaseProvider
// and implement the methods relevant to its capabilities.
//
// Capabilities are declared via the `capabilities` getter.
// The registry uses capabilities to route requests to the right adapter.
// ============================================================

export class BaseProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.enabled = false;
    this._lastError = null;
    this._requestCount = 0;
  }

  // Override in subclass: declare what this provider can do
  get capabilities() {
    return {
      prices: false,        // spot prices, candles, OHLCV
      macroSeries: false,   // GDP, CPI, rates, yield curves
      macroCalendar: false,  // upcoming economic events
      news: false,          // news articles, headlines
      sentiment: false,     // market sentiment scores
      options: false,       // options chains, flow, greeks
      futures: false,       // futures curves, COT data
      forex: false,         // FX rates
      crypto: false,        // crypto prices
    };
  }

  // Called once at startup — validate API key, test connectivity
  async initialize() {
    throw new Error(`${this.name}: initialize() not implemented`);
  }

  // Health check — can this provider serve requests right now?
  async healthCheck() {
    return { healthy: this.enabled, lastError: this._lastError };
  }

  // ---- PRICE DATA ----
  async getPrice(symbol) {
    throw new Error(`${this.name}: getPrice() not supported`);
  }

  async getCandles(symbol, interval, from, to) {
    throw new Error(`${this.name}: getCandles() not supported`);
  }

  // ---- MACRO DATA ----
  async getMacroSeries(seriesId, from, to) {
    throw new Error(`${this.name}: getMacroSeries() not supported`);
  }

  async getMacroCalendar(from, to) {
    throw new Error(`${this.name}: getMacroCalendar() not supported`);
  }

  // ---- NEWS ----
  async getNews(query, from, to) {
    throw new Error(`${this.name}: getNews() not supported`);
  }

  async getTopHeadlines(category) {
    throw new Error(`${this.name}: getTopHeadlines() not supported`);
  }

  // ---- SENTIMENT ----
  async getSentiment(symbol) {
    throw new Error(`${this.name}: getSentiment() not supported`);
  }

  // ---- OPTIONS ----
  async getOptionsChain(symbol, expiration) {
    throw new Error(`${this.name}: getOptionsChain() not supported`);
  }

  // ---- HELPERS ----
  _trackRequest() {
    this._requestCount++;
  }

  _setError(err) {
    this._lastError = { message: err.message, time: new Date().toISOString() };
  }

  getStats() {
    return {
      name: this.name,
      enabled: this.enabled,
      capabilities: this.capabilities,
      requestCount: this._requestCount,
      lastError: this._lastError,
    };
  }
}

// ============================================================
// NORMALIZED DATA SHAPES
// ============================================================
// All adapters MUST normalize their output to these shapes.
// source_attribution is MANDATORY on every object.

export const NormalizedShapes = {
  // Price quote
  price: {
    symbol: '',            // e.g., "AAPL"
    price: 0,
    change: 0,
    changePercent: 0,
    volume: 0,
    timestamp: '',         // ISO 8601
    source_provider: '',   // adapter name
    source_attribution: '', // human-readable
  },

  // OHLCV candle
  candle: {
    symbol: '',
    open: 0, high: 0, low: 0, close: 0, volume: 0,
    timestamp: '',
    interval: '',          // '1m', '5m', '1h', '1d', '1w'
    source_provider: '',
    source_attribution: '',
  },

  // Macro economic series data point
  macroDataPoint: {
    seriesId: '',          // e.g., "US_CPI_YOY"
    name: '',              // e.g., "US CPI Year-over-Year"
    value: 0,
    previousValue: null,
    date: '',
    unit: '',              // 'percent', 'index', 'billions_usd', etc.
    source_provider: '',
    source_attribution: '',
  },

  // Macro calendar event
  macroEvent: {
    eventId: '',
    title: '',             // e.g., "FOMC Rate Decision"
    country: '',
    date: '',
    time: '',
    impact: '',            // 'high', 'medium', 'low'
    forecast: null,
    previous: null,
    actual: null,
    unit: '',
    source_provider: '',
    source_attribution: '',
  },

  // News article
  newsArticle: {
    articleId: '',
    title: '',
    description: '',
    content: '',
    url: '',
    source: '',            // publisher name
    publishedAt: '',
    symbols: [],           // related tickers
    categories: [],        // tags
    sentiment: null,       // -1 to 1 if available
    source_provider: '',
    source_attribution: '',
  },
};
