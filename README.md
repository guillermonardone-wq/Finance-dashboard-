# Signal Forge

A macro decision engine for tracking geopolitical and economic signals, developing investment theses, and scoring them through a three-layer evaluation framework.

## What it does

- **Signal Inbox** — Collect signals from manual entry, FRED (Federal Reserve data), and GDELT (geopolitical news monitoring). Quick-add box for pasting headlines/URLs.
- **Thesis Builder** — Create structured investment theses with causal chains, probability ranges, affected assets, and counter-cases.
- **Three-Layer Scoring Engine** — Evidence (40%) + Structural Logic (35%) + Market Edge (25%). 15 scoring factors with auto-computation from linked data.
- **Behavioral Gates** — Mandatory disconfirmation, probability bounds, sleep-on-it checks. Prevents overconfident positioning.
- **Signal-to-Thesis Flow** — Link signals as evidence, bulk-link from inbox, auto-score updates.
- **Prediction Market Integration** — Link thesis to prediction market contracts, compute divergence assessment.
- **LLM Advisory** — Optional second-opinion evaluation (advisory only, cannot override deterministic scoring).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Zustand, TailwindCSS |
| Backend | Express 5, Node.js |
| Database | SQLite (better-sqlite3, WAL mode) — prototype; Session 1a replaces with PostgreSQL + Knex.js |
| Testing | Vitest |

## Local setup

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env — add API keys for providers you want to use (all optional)

# Start dev server (client + API server)
npm run dev

# Or run separately:
npm run dev:client   # Vite dev server (port 5173, proxies /api to 3002)
npm run dev:server   # Express API server (port 3002)
```

The database auto-creates and seeds on first run. No manual setup required.

## Environment variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | API server port | 3002 |
| `DB_PATH` | SQLite database path | `./data/decision-engine.db` |
| `FRED_API_KEY` | Federal Reserve data | (disabled without key) |
| `FINNHUB_API_KEY` | Market data, FX, news | (disabled without key) |
| `NEWSAPI_API_KEY` | News headlines | (disabled without key) |
| `ALPHA_VANTAGE_API_KEY` | Price data | (disabled without key) |
| `ANTHROPIC_API_KEY` | LLM advisory evaluation | (disabled without key) |
| `FRED_SIGNAL_THRESHOLD_MULT` | Std dev multiplier for FRED signal generation | 1.0 |
| `GDELT_SPIKE_MULTIPLIER` | Volume spike multiplier for GDELT signals | 2.0 |

All API keys are optional. The app runs fully without any external providers.

## Running tests

```bash
# Run all tests — scoring engine, classification, gates, checklist,
# thesis repo safety, column allowlist (vitest, 173 tests)
npm test

# Watch mode
npm run test:watch

# Legacy provider/normalization tests (node:assert, not vitest)
npm run test:legacy
```

## What is currently implemented

- Signal Inbox as landing page with Quick Add, FRED auto-signals, GDELT monitoring
- Thesis creation (Quick Capture drafts + full form)
- Signal-to-thesis linking (single + bulk)
- Three-layer scoring engine with 15 factors, 6 penalty types, confidence estimation
- Classification system (IGNORE -> WATCH -> DEVELOP -> PAPER_TRADE -> SMALL_POSITION -> FULLY_QUALIFIED)
- Behavioral gate enforcement (disconfirmation, probability bounds)
- Prediction market contract linking + divergence assessment
- LLM advisory evaluation (Claude/GPT-4, advisory-only)
- ThesisDetail workspace with tabs: Overview, Evidence, Prediction Markets, LLM Review, Scorecard, Checklist, Audit Log
- Signal count badges in navigation
- Provider adapters: FRED, Finnhub, Alpha Vantage, NewsAPI, World Bank Data360
- Background scheduler for data refresh

## What is intentionally not implemented yet

- PostgreSQL / Knex (currently SQLite — DB access is isolated in `server/db/*-repo.js` for future migration). See `server/db/MIGRATION_READY.md` for the migration plan.
- Authentication / multi-user (placeholder middleware at `server/middleware/auth.js`)
- Trade execution tracking
- Research lab / social features
- Dead letter queue for failed provider calls

## Pre-build status

This prototype has been hardened for the Master Build Sequence v4.2:

- Root-level ErrorBoundary catches crashes in any route
- 173 automated tests covering scoring, classification, gates, checklist, thesis repo safety
- Column allowlist prevents SQL injection via dynamic updates
- All core files formatted with Prettier
- `server/db/RAW_SQL_INVENTORY.md` documents every raw SQL query for migration
- `server/middleware/auth.js` and `server/config.js` scaffolded for Session 1b
