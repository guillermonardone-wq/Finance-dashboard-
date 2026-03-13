import { BaseProvider } from '../interface.js';

const BASE_URL = 'https://newsapi.org/v2';

export class NewsApiProvider extends BaseProvider {
  constructor(config = {}) {
    super('newsapi', config);
    this.apiKey = config.apiKey || process.env.NEWSAPI_API_KEY;
  }

  get capabilities() {
    return {
      prices: false,
      macroSeries: false,
      macroCalendar: false,
      news: true,
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
      this._setError(new Error('No API key configured'));
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/top-headlines?country=us&pageSize=1&apiKey=${this.apiKey}`);
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'API error');
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      this._setError(err);
    }
  }

  async getNews(query, from, to) {
    this._trackRequest();
    try {
      const params = new URLSearchParams({
        q: query || 'geopolitics OR sanctions OR oil OR central bank',
        sortBy: 'publishedAt',
        pageSize: '30',
        language: 'en',
        apiKey: this.apiKey,
      });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`${BASE_URL}/everything?${params}`);
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'API error');

      return (data.articles || []).map(item => ({
        articleId: item.url,
        title: item.title,
        description: item.description || '',
        content: item.content || item.description || '',
        url: item.url,
        source: item.source?.name || 'Unknown',
        publishedAt: item.publishedAt,
        symbols: [],
        categories: [],
        sentiment: null,
        source_provider: this.name,
        source_attribution: `NewsAPI - ${item.source?.name || 'News Search'}`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  async getTopHeadlines(category = 'business') {
    this._trackRequest();
    try {
      const res = await fetch(
        `${BASE_URL}/top-headlines?country=us&category=${encodeURIComponent(category)}&pageSize=20&apiKey=${this.apiKey}`
      );
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'API error');

      return (data.articles || []).map(item => ({
        articleId: item.url,
        title: item.title,
        description: item.description || '',
        content: item.content || item.description || '',
        url: item.url,
        source: item.source?.name || 'Unknown',
        publishedAt: item.publishedAt,
        symbols: [],
        categories: [category],
        sentiment: null,
        source_provider: this.name,
        source_attribution: `NewsAPI - Top Headlines (${category})`,
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }
}
