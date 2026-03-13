import { BaseProvider } from '../interface.js';

const BASE_URL = 'https://finnhub.io/api/v1';

export class FinnhubProvider extends BaseProvider {
  constructor(config = {}) {
    super('finnhub', config);
    this.apiKey = config.apiKey || process.env.FINNHUB_API_KEY;
  }

  get capabilities() {
    return {
      prices: true,
      macroSeries: false,
      macroCalendar: true,
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
      const res = await fetch(`${BASE_URL}/quote?symbol=AAPL&token=${this.apiKey}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      this._setError(err);
    }
  }

  async getPrice(symbol) {
    this._trackRequest();
    try {
      const res = await fetch(`${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`);
      const data = await res.json();
      if (!data.c) throw new Error(`No price data for ${symbol}`);
      return {
        symbol,
        price: data.c,
        change: data.d,
        changePercent: data.dp,
        volume: data.v || 0,
        timestamp: new Date(data.t * 1000).toISOString(),
        source_provider: this.name,
        source_attribution: `Finnhub - Real-time Quote`,
      };
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getCandles(symbol, interval = '1d', from, to) {
    this._trackRequest();
    const resolutionMap = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '1d': 'D', '1w': 'W', '1M': 'M' };
    const resolution = resolutionMap[interval] || 'D';
    const now = Math.floor(Date.now() / 1000);
    const fromTs = from ? Math.floor(new Date(from).getTime() / 1000) : now - 90 * 86400;
    const toTs = to ? Math.floor(new Date(to).getTime() / 1000) : now;

    try {
      const res = await fetch(
        `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${fromTs}&to=${toTs}&token=${this.apiKey}`
      );
      const data = await res.json();
      if (data.s === 'no_data' || !data.c) throw new Error(`No candle data for ${symbol}`);

      return data.c.map((_, i) => ({
        symbol,
        open: data.o[i],
        high: data.h[i],
        low: data.l[i],
        close: data.c[i],
        volume: data.v[i],
        timestamp: new Date(data.t[i] * 1000).toISOString(),
        interval,
        source_provider: this.name,
        source_attribution: `Finnhub - Stock Candles`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getMacroCalendar(from, to) {
    this._trackRequest();
    try {
      const res = await fetch(`${BASE_URL}/calendar/economic?from=${from || ''}&to=${to || ''}&token=${this.apiKey}`);
      const data = await res.json();
      const events = data.economicCalendar || [];

      return events.map(evt => ({
        eventId: `${evt.event}_${evt.date}_${evt.country}`,
        title: evt.event,
        country: evt.country,
        date: evt.date,
        time: evt.time || '',
        impact: evt.impact === 3 ? 'high' : evt.impact === 2 ? 'medium' : 'low',
        forecast: evt.estimate,
        previous: evt.prev,
        actual: evt.actual,
        unit: evt.unit || '',
        source_provider: this.name,
        source_attribution: `Finnhub - Economic Calendar`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getNews(query) {
    this._trackRequest();
    try {
      const category = query || 'general';
      const res = await fetch(`${BASE_URL}/news?category=${encodeURIComponent(category)}&token=${this.apiKey}`);
      const data = await res.json();

      return (data || []).slice(0, 30).map(item => ({
        articleId: `finnhub_${item.id}`,
        title: item.headline,
        description: item.summary || '',
        content: item.summary || '',
        url: item.url,
        source: item.source,
        publishedAt: new Date(item.datetime * 1000).toISOString(),
        symbols: item.related ? item.related.split(',') : [],
        categories: [item.category],
        sentiment: null,
        source_provider: this.name,
        source_attribution: `Finnhub - Market News`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getSentiment(symbol) {
    this._trackRequest();
    try {
      const res = await fetch(`${BASE_URL}/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`);
      const data = await res.json();
      return {
        symbol,
        buzz: data.buzz,
        sentiment: data.sentiment,
        companyNewsScore: data.companyNewsScore,
        sectorAverageBullishPercent: data.sectorAverageBullishPercent,
        source_provider: this.name,
        source_attribution: `Finnhub - News Sentiment`,
      };
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }
}
