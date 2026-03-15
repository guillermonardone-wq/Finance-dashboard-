import { BaseProvider } from '../interface.js';

const BASE_URL = 'https://www.alphavantage.co/query';

export class AlphaVantageProvider extends BaseProvider {
  constructor(config = {}) {
    super('alpha_vantage', config);
    this.apiKey = config.apiKey || process.env.ALPHA_VANTAGE_API_KEY;
  }

  get capabilities() {
    return {
      prices: true,
      macroSeries: true,
      macroCalendar: false,
      news: true,
      sentiment: true,
      options: false,
      futures: false,
      forex: true,
      crypto: true,
    };
  }

  async initialize() {
    if (!this.apiKey) {
      this.enabled = false;
      this._setError(new Error('No API key configured'));
      return;
    }
    try {
      // Test with a lightweight call
      const res = await fetch(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=SPY&apikey=${this.apiKey}`);
      const data = await res.json();
      if (data['Error Message'] || data['Note']) {
        throw new Error(data['Error Message'] || data['Note']);
      }
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      this._setError(err);
    }
  }

  async getPrice(symbol) {
    this._trackRequest();
    try {
      const res = await fetch(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`);
      const data = await res.json();
      const q = data['Global Quote'];
      if (!q || !q['05. price']) {
        throw new Error(`No price data for ${symbol}`);
      }
      return {
        symbol,
        price: parseFloat(q['05. price']),
        change: parseFloat(q['09. change']),
        changePercent: parseFloat(q['10. change percent']?.replace('%', '')) || 0,
        volume: parseInt(q['06. volume']) || 0,
        timestamp: q['07. latest trading day'] || new Date().toISOString(),
        source_provider: this.name,
        source_attribution: `Alpha Vantage - Global Quote`,
      };
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getCandles(symbol, interval = '1d', from, to) {
    this._trackRequest();
    try {
      const fnMap = { '1d': 'TIME_SERIES_DAILY', '1w': 'TIME_SERIES_WEEKLY', '1M': 'TIME_SERIES_MONTHLY' };
      const fn = fnMap[interval] || 'TIME_SERIES_DAILY';
      const keyMap = {
        'TIME_SERIES_DAILY': 'Time Series (Daily)',
        'TIME_SERIES_WEEKLY': 'Weekly Time Series',
        'TIME_SERIES_MONTHLY': 'Monthly Time Series',
      };

      const res = await fetch(`${BASE_URL}?function=${fn}&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${this.apiKey}`);
      const data = await res.json();
      const series = data[keyMap[fn]];
      if (!series) throw new Error(`No candle data for ${symbol}`);

      return Object.entries(series)
        .map(([date, values]) => ({
          symbol,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume']),
          timestamp: date,
          interval,
          source_provider: this.name,
          source_attribution: `Alpha Vantage - ${fn.replace(/_/g, ' ')}`,
        }))
        .filter(c => {
          if (from && c.timestamp < from) return false;
          if (to && c.timestamp > to) return false;
          return true;
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getMacroSeries(seriesId) {
    this._trackRequest();
    const seriesMap = {
      'US_CPI': { fn: 'CPI', name: 'US Consumer Price Index' },
      'US_INFLATION': { fn: 'INFLATION', name: 'US Inflation Rate' },
      'US_GDP': { fn: 'REAL_GDP', name: 'US Real GDP' },
      'US_UNEMPLOYMENT': { fn: 'UNEMPLOYMENT', name: 'US Unemployment Rate' },
      'FEDERAL_FUNDS_RATE': { fn: 'FEDERAL_FUNDS_RATE', name: 'Federal Funds Rate' },
      'US_TREASURY_YIELD': { fn: 'TREASURY_YIELD', name: 'US Treasury Yield' },
    };

    const series = seriesMap[seriesId];
    if (!series) throw new Error(`Unknown macro series: ${seriesId}`);

    try {
      const res = await fetch(`${BASE_URL}?function=${series.fn}&apikey=${this.apiKey}`);
      const data = await res.json();
      const points = data.data || [];

      return points.slice(0, 50).map((point, i) => ({
        seriesId,
        name: series.name,
        value: parseFloat(point.value),
        previousValue: points[i + 1] ? parseFloat(points[i + 1].value) : null,
        date: point.date,
        unit: 'percent',
        source_provider: this.name,
        source_attribution: `Alpha Vantage - ${series.name}`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getNews(query) {
    this._trackRequest();
    try {
      const tickers = query ? `&tickers=${encodeURIComponent(query)}` : '';
      const res = await fetch(`${BASE_URL}?function=NEWS_SENTIMENT${tickers}&apikey=${this.apiKey}`);
      const data = await res.json();
      const feed = data.feed || [];

      return feed.slice(0, 20).map(item => ({
        articleId: item.url,
        title: item.title,
        description: item.summary || '',
        content: item.summary || '',
        url: item.url,
        source: item.source,
        publishedAt: item.time_published,
        symbols: (item.ticker_sentiment || []).map(t => t.ticker),
        categories: (item.topics || []).map(t => t.topic),
        sentiment: item.overall_sentiment_score ? parseFloat(item.overall_sentiment_score) : null,
        source_provider: this.name,
        source_attribution: `Alpha Vantage - News Sentiment`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }
}
