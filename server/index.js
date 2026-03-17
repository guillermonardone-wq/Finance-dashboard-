import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import config from './config.js';
import { initDb, getDb } from './db/connection.js';
import { registry } from './providers/registry.js';
import { cache } from './services/cache.js';
import { seed } from './seed-fn.js';
import { startScheduler } from './services/scheduler.js';

import thesesRouter from './routes/theses.js';
import signalsRouter from './routes/signals.js';
import marketRouter from './routes/market.js';
import reviewsRouter from './routes/reviews.js';
import botRouter from './routes/bot.js';
import predictionMarketsRouter from './routes/prediction-markets.js';
import advisoryRouter from './routes/advisory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = config.port;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Ensure data directory exists
const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Initialize database
console.log('[Server] Initializing database...');
initDb();

// Run migrations
import { migrateScoringV2 } from './db/migrate-scoring-v2.js';
import { migrateSourceTypes } from './db/migrate-source-types.js';
migrateScoringV2();
migrateSourceTypes();
console.log('[Server] Database ready.');

// Auto-seed if database is empty (first run)
{
  const db = getDb();
  const thesisCount = db.prepare('SELECT COUNT(*) as count FROM theses').get().count;
  const signalCount = db.prepare('SELECT COUNT(*) as count FROM signals').get().count;
  if (thesisCount === 0 && signalCount === 0) {
    console.log('[Server] Empty database detected — running auto-seed...');
    seed();
    console.log('[Server] Auto-seed complete.');
  }
}

// Initialize provider registry
(async () => {
  console.log('[Server] Initializing providers...');
  const status = await registry.initialize();
  const enabled = Object.values(status).filter(s => s.enabled).length;
  console.log(`[Server] ${enabled}/${Object.keys(status).length} providers enabled.`);
  if (enabled > 0) startScheduler();
})();

// Cache cleanup every 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000);

// Routes
app.use('/api/theses', thesesRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/market', marketRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/bot', botRouter);
app.use('/api/prediction-markets', predictionMarketsRouter);
app.use('/api/advisory', advisoryRouter);

// Health endpoint
app.get('/api/health', (req, res) => {
  const db = getDb();
  let dbOk = false;
  try {
    db.prepare('SELECT 1').get();
    dbOk = true;
  } catch {}
  res.json({
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'error',
    providers: registry.getStatus(),
    uptime: process.uptime(),
  });
});

// Global error handler — catch unhandled route errors
app.use((err, req, res, _next) => {
  console.error(`[Server] Unhandled error on ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Server] Signal Forge API running on port ${PORT}`);
});
