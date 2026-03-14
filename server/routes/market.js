import { Router } from 'express';
import { ingestion } from '../services/ingestion.js';
import { registry } from '../providers/registry.js';
import { getDb } from '../db/connection.js';

const router = Router();

// GET provider status
router.get('/providers', (req, res) => {
  res.json(registry.getStatus());
});

// GET provider config summary (what's configured vs missing)
router.get('/providers/summary', (req, res) => {
  res.json(registry.getConfigSummary());
});

// GET price for a symbol
router.get('/price/:symbol', async (req, res) => {
  try {
    const result = await ingestion.fetchPrice(req.params.symbol);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET candles for a symbol
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { interval, from, to } = req.query;
    const result = await ingestion.fetchCandles(req.params.symbol, interval || '1d', from, to);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET macro series
router.get('/macro/:seriesId', async (req, res) => {
  try {
    const result = await ingestion.fetchMacroSeries(req.params.seriesId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET macro calendar
router.get('/calendar', async (req, res) => {
  try {
    const { from, to } = req.query;
    const result = await ingestion.fetchMacroCalendar(from, to);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET news
router.get('/news', async (req, res) => {
  try {
    const { q } = req.query;
    const result = await ingestion.fetchNews(q);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET headlines
router.get('/headlines', async (req, res) => {
  try {
    const { category } = req.query;
    const result = await ingestion.fetchHeadlines(category);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET sentiment for a symbol
router.get('/sentiment/:symbol', async (req, res) => {
  try {
    const result = await ingestion.fetchSentiment(req.params.symbol);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent market observations from DB
router.get('/observations', (req, res) => {
  const db = getDb();
  const { type, symbol, limit } = req.query;
  let sql = 'SELECT * FROM market_observations WHERE 1=1';
  const params = [];

  if (type) { sql += ' AND observation_type = ?'; params.push(type); }
  if (symbol) { sql += ' AND symbol = ?'; params.push(symbol); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit) || 50);

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => {
    try { r.data = JSON.parse(r.data); } catch {}
    try { r.metadata = JSON.parse(r.metadata); } catch {}
    return r;
  }));
});

// POST bulk price fetch
router.post('/watchlist', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols)) return res.status(400).json({ error: 'symbols must be an array' });
    const results = await ingestion.fetchWatchlistPrices(symbols);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// FRED specific endpoints
// ============================================================

// GET yield curve snapshot
router.get('/fred/yield-curve', async (req, res) => {
  try {
    const provider = registry.getProvider('fred');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'FRED provider not configured. Add FRED_API_KEY to .env', data: [] });
    }
    const data = await provider.getYieldCurve();
    res.json({ success: true, data, provider: 'fred', source_attribution: 'FRED (Federal Reserve) — Yield Curve' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET available FRED series
router.get('/fred/series', (req, res) => {
  const provider = registry.getProvider('fred');
  if (!provider) {
    return res.json({ success: false, error: 'FRED provider not registered', data: [] });
  }
  res.json({ success: true, data: provider.getAvailableSeries() });
});

// GET a specific FRED series by friendly ID or raw FRED code
router.get('/fred/series/:seriesId', async (req, res) => {
  try {
    const provider = registry.getProvider('fred');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'FRED provider not configured. Add FRED_API_KEY to .env', data: [] });
    }
    const { from, to } = req.query;
    const data = await provider.getMacroSeries(req.params.seriesId, from, to);
    res.json({ success: true, data, provider: 'fred', source_attribution: `FRED — ${req.params.seriesId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET FRED release calendar
router.get('/fred/calendar', async (req, res) => {
  try {
    const provider = registry.getProvider('fred');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'FRED provider not configured. Add FRED_API_KEY to .env', data: [] });
    }
    const { from, to } = req.query;
    const data = await provider.getMacroCalendar(from, to);
    res.json({ success: true, data, provider: 'fred', source_attribution: 'FRED — Release Calendar' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// WORLD BANK DATA360 endpoints
// ============================================================

// POST search indicators
router.post('/worldbank/search', async (req, res) => {
  try {
    const provider = registry.getProvider('worldbank');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'World Bank provider unavailable', data: [] });
    }
    const { query, top, skip, filter } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const data = await provider.search(query, { top, skip, filter });
    res.json({ success: true, data, provider: 'worldbank', source_attribution: 'World Bank Data360' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET available World Bank indicators (curated list)
router.get('/worldbank/indicators', (req, res) => {
  const provider = registry.getProvider('worldbank');
  if (!provider) {
    return res.json({ success: false, error: 'World Bank provider not registered', data: [] });
  }
  res.json({
    success: true,
    data: provider.getAvailableIndicators(),
    countries: provider.getDefaultCountries(),
  });
});

// GET World Bank data for an indicator
router.get('/worldbank/data/:indicator', async (req, res) => {
  try {
    const provider = registry.getProvider('worldbank');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'World Bank provider unavailable', data: [] });
    }
    const { countries, from, to, dataset } = req.query;
    const countryList = countries ? countries.split(',') : [];
    const data = await provider.getData(req.params.indicator, countryList, {
      dataset,
      timePeriodFrom: from,
      timePeriodTo: to,
    });
    res.json({ success: true, data, provider: 'worldbank', source_attribution: `World Bank Data360 — ${req.params.indicator}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// FX endpoints (via Finnhub)
// ============================================================

// GET FX rates against USD
router.get('/fx/rates', async (req, res) => {
  try {
    const provider = registry.getProvider('finnhub');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Finnhub provider not configured. Add FINNHUB_API_KEY to .env', data: null });
    }
    const { base } = req.query;
    const data = await provider.getFxRate(base || 'USD');
    res.json({ success: true, data, provider: 'finnhub', source_attribution: 'Finnhub - Forex Rates' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET FX pair quote (e.g., EUR/USD)
router.get('/fx/quote/:pair', async (req, res) => {
  try {
    const provider = registry.getProvider('finnhub');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Finnhub provider not configured', data: null });
    }
    const data = await provider.getFxPairQuote(req.params.pair);
    res.json({ success: true, data, provider: 'finnhub', source_attribution: 'Finnhub - Forex Quote' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST bulk FX pair quotes
router.post('/fx/quotes', async (req, res) => {
  try {
    const provider = registry.getProvider('finnhub');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Finnhub provider not configured', data: {} });
    }
    const { pairs } = req.body;
    if (!Array.isArray(pairs)) return res.status(400).json({ error: 'pairs must be an array' });
    const results = {};
    await Promise.allSettled(
      pairs.map(async (pair) => {
        try {
          results[pair] = await provider.getFxPairQuote(pair);
        } catch (err) {
          results[pair] = { error: err.message, symbol: pair };
        }
      })
    );
    res.json({ success: true, data: results, provider: 'finnhub' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
