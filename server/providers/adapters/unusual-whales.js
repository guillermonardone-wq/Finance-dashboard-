// ============================================================
// UNUSUAL WHALES PROVIDER — Options flow, dark pool, market intel
// ============================================================
// API docs: https://docs.unusualwhales.com / MCP-style endpoints
// Endpoints used (MVP):
//   GET /api/market/news         — market news feed
//   GET /api/stock/{ticker}/flow — options flow for a ticker
//   GET /api/darkpool/recent     — recent dark pool prints
//   GET /api/congress/recent     — recent congressional trades
//
// If the exact endpoints differ from the live API, the adapter
// normalizes to Signal Forge's internal shapes regardless.
// ============================================================

import { BaseProvider } from '../interface.js';

const BASE_URL = process.env.UNUSUAL_WHALES_BASE_URL || 'https://api.unusualwhales.com';

export class UnusualWhalesProvider extends BaseProvider {
  constructor(config = {}) {
    super('unusual_whales', config);
    this.apiKey = config.apiKey || process.env.UNUSUAL_WHALES_API_KEY;
  }

  get capabilities() {
    return {
      prices: false,
      macroSeries: false,
      macroCalendar: false,
      news: true,          // market news / notable flow alerts
      sentiment: false,
      options: true,        // options flow, sweeps, unusual activity
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
      // Validate API key with a lightweight request
      const res = await fetch(`${BASE_URL}/api/market/news?limit=1`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`API returned ${res.status}: ${text.slice(0, 100)}`);
      }
      this.enabled = true;
    } catch (err) {
      this.enabled = false;
      this._setError(err);
    }
  }

  async _fetch(path) {
    this._trackRequest();
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Unusual Whales ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  // --- NEWS: Market news / notable flow alerts ---
  async getNews(query) {
    try {
      const data = await this._fetch(`/api/market/news?limit=30`);
      const articles = data.data || data || [];
      return articles.map(item => ({
        articleId: `uw_${item.id || item.news_id || Math.random().toString(36).slice(2)}`,
        title: item.title || item.headline || '',
        description: item.description || item.summary || '',
        content: item.content || item.body || '',
        url: item.url || item.link || '',
        source: item.source || 'Unusual Whales',
        publishedAt: item.published_at || item.date || new Date().toISOString(),
        symbols: item.tickers || item.symbols || [],
        categories: item.tags || [],
        sentiment: item.sentiment ?? null,
        source_provider: this.name,
        source_attribution: 'Unusual Whales - Market News',
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // --- OPTIONS FLOW: Unusual options activity ---
  async getOptionsFlow(ticker) {
    try {
      const path = ticker
        ? `/api/stock/${encodeURIComponent(ticker)}/flow?limit=50`
        : `/api/options/flow?limit=50`;
      const data = await this._fetch(path);
      const flows = data.data || data || [];
      return flows.map(f => ({
        id: f.id || `uw_flow_${Math.random().toString(36).slice(2)}`,
        ticker: f.ticker || f.symbol || ticker,
        strike: f.strike_price || f.strike,
        expiry: f.expiration || f.expires_at,
        type: f.put_call || f.option_type || 'unknown',
        side: f.sentiment || f.side || 'unknown',
        size: f.volume || f.size || 0,
        premium: f.premium || f.total_premium || 0,
        openInterest: f.open_interest || 0,
        unusual: f.is_unusual ?? true,
        sweep: f.is_sweep ?? false,
        timestamp: f.executed_at || f.date || new Date().toISOString(),
        source_provider: this.name,
        source_attribution: 'Unusual Whales - Options Flow',
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // --- DARK POOL: Recent dark pool prints ---
  async getDarkPoolActivity(ticker) {
    try {
      const path = ticker
        ? `/api/stock/${encodeURIComponent(ticker)}/darkpool?limit=30`
        : `/api/darkpool/recent?limit=30`;
      const data = await this._fetch(path);
      const prints = data.data || data || [];
      return prints.map(p => ({
        id: p.id || `uw_dp_${Math.random().toString(36).slice(2)}`,
        ticker: p.ticker || p.symbol || ticker,
        price: p.price || p.trade_price || 0,
        size: p.size || p.volume || 0,
        notional: p.notional || (p.price || 0) * (p.size || 0),
        exchange: p.exchange || p.venue || 'dark_pool',
        timestamp: p.executed_at || p.date || new Date().toISOString(),
        source_provider: this.name,
        source_attribution: 'Unusual Whales - Dark Pool',
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }

  // --- CONGRESSIONAL TRADES: Recent congress activity ---
  async getCongressionalTrades() {
    try {
      const data = await this._fetch('/api/congress/recent?limit=30');
      const trades = data.data || data || [];
      return trades.map(t => ({
        id: t.id || `uw_congress_${Math.random().toString(36).slice(2)}`,
        politician: t.politician || t.representative || 'Unknown',
        party: t.party || '',
        ticker: t.ticker || t.symbol || '',
        type: t.transaction_type || t.type || 'unknown',
        amount: t.amount || t.range || '',
        filedDate: t.filed_date || t.date || '',
        transactionDate: t.transaction_date || '',
        source_provider: this.name,
        source_attribution: 'Unusual Whales - Congressional Trades',
      }));
    } catch (err) {
      this._setError(err);
      throw err;
    }
  }
}
