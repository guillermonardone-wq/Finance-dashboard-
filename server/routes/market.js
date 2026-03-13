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

export default router;
