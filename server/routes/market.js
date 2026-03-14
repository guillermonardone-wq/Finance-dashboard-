import { Router } from 'express';
import { ingestion } from '../services/ingestion.js';
import { registry } from '../providers/registry.js';
import { getDb } from '../db/connection.js';

const router = Router();

// GET provider status
router.get('/providers', (req, res) => {
  res.json(registry.getStatus());
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

// --- FRED specific endpoints ---

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

// --- Unusual Whales specific endpoints ---

// GET options flow (all)
router.get('/options-flow', async (req, res) => {
  try {
    const provider = registry.getProvider('unusual_whales');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Unusual Whales provider not configured', data: [] });
    }
    const data = await provider.getOptionsFlow(null);
    res.json({ success: true, data, provider: 'unusual_whales', source_attribution: 'Unusual Whales - Options Flow' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET options flow (by ticker)
router.get('/options-flow/:ticker', async (req, res) => {
  try {
    const provider = registry.getProvider('unusual_whales');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Unusual Whales provider not configured', data: [] });
    }
    const data = await provider.getOptionsFlow(req.params.ticker);
    res.json({ success: true, data, provider: 'unusual_whales', source_attribution: 'Unusual Whales - Options Flow' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dark pool activity (all)
router.get('/darkpool', async (req, res) => {
  try {
    const provider = registry.getProvider('unusual_whales');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Unusual Whales provider not configured', data: [] });
    }
    const data = await provider.getDarkPoolActivity(null);
    res.json({ success: true, data, provider: 'unusual_whales', source_attribution: 'Unusual Whales - Dark Pool' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET dark pool activity (by ticker)
router.get('/darkpool/:ticker', async (req, res) => {
  try {
    const provider = registry.getProvider('unusual_whales');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Unusual Whales provider not configured', data: [] });
    }
    const data = await provider.getDarkPoolActivity(req.params.ticker);
    res.json({ success: true, data, provider: 'unusual_whales', source_attribution: 'Unusual Whales - Dark Pool' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET congressional trades
router.get('/congress', async (req, res) => {
  try {
    const provider = registry.getProvider('unusual_whales');
    if (!provider?.enabled) {
      return res.json({ success: false, error: 'Unusual Whales provider not configured', data: [] });
    }
    const data = await provider.getCongressionalTrades();
    res.json({ success: true, data, provider: 'unusual_whales', source_attribution: 'Unusual Whales - Congressional Trades' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
