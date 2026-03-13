import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { initDb } from './db/connection.js';
import { registry } from './providers/registry.js';
import { cache } from './services/cache.js';

import thesesRouter from './routes/theses.js';
import signalsRouter from './routes/signals.js';
import marketRouter from './routes/market.js';
import reviewsRouter from './routes/reviews.js';
import botRouter from './routes/bot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Ensure data directory exists
const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Initialize database
console.log('[Server] Initializing database...');
initDb();
console.log('[Server] Database ready.');

// Initialize provider registry
(async () => {
  console.log('[Server] Initializing providers...');
  const status = await registry.initialize();
  const enabled = Object.values(status).filter(s => s.enabled).length;
  console.log(`[Server] ${enabled}/${Object.keys(status).length} providers enabled.`);
})();

// Cache cleanup every 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000);

// Routes
app.use('/api/theses', thesesRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/market', marketRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/bot', botRouter);

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    providers: registry.getStatus(),
    uptime: process.uptime(),
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Signal Forge API running on port ${PORT}`);
});
