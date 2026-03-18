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
| Database | PostgreSQL 16 via Knex.js (migrated from SQLite) |
| Testing | Vitest |

## Local setup

```bash
# Start PostgreSQL (via Docker)
docker compose up -d

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

The database auto-migrates (Knex migrations) and seeds on first run. The server retries DB connections on startup (up to 10 attempts with exponential backoff), so it's safe to start the app before PostgreSQL is fully ready.

### Manual migration

```bash
# Run migrations via Knex CLI
npm run db:migrate

# Rollback last batch
npm run db:rollback

# Manual seed (if DB is empty, auto-seed runs on startup)
npm run seed
```

## Environment variables

See `.env.example` for the full list. Key variables:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | API server port | 3002 |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | PostgreSQL database | `signalforge` |
| `DB_USER` | PostgreSQL user | `signalforge` |
| `DB_PASSWORD` | PostgreSQL password | `dev_password` |
| `API_KEY` | API key for auth (empty = dev mode, no auth) | (empty) |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `FRED_API_KEY` | Federal Reserve data | (disabled without key) |
| `FINNHUB_API_KEY` | Market data, FX, news | (disabled without key) |
| `NEWSAPI_API_KEY` | News headlines | (disabled without key) |
| `ALPHA_VANTAGE_API_KEY` | Price data | (disabled without key) |
| `ANTHROPIC_API_KEY` | LLM advisory evaluation | (disabled without key) |
| `INGESTION_MODE` | Signal ingestion: `live` or `mock` | `live` |
| `REFRESH_INTERVAL_INGESTION` | Ingestion pipeline interval (seconds) | `900` |

All API keys are optional. The app runs fully without any external providers.

## Running tests

```bash
# Run all tests — scoring engine, classification, gates, checklist,
# thesis repo safety, column allowlist, config, auth, system health,
# provider health, dead letter queue, user_id scoping, integration startup,
# signal normalizer, signal ingestion, scheduler, GDELT, signal quality, ACLED, session 4 integration (vitest, 367 tests)
npm test

# Watch mode
npm run test:watch
```

## What is implemented

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
- PostgreSQL + Knex.js (Session 1a — complete)
- Centralized config, API key auth, CORS hardening (Session 1b — complete)
- Provider health monitoring + dead letter queue (Session 1b — complete)
- System health endpoints: `/api/system/health`, `/api/system/providers`, `/api/system/dlq`

## What is not implemented yet

- Trade execution tracking
- Research lab / simulation environment (see `RESEARCH_LAB_PLAN.md`)
- Multi-user authentication
- Notification system

## Architecture notes

- All database access uses Knex query builder (no raw SQL in runtime code)
- Schema managed via Knex migration files in `server/db/migrations/`
- All config centralized in `server/config.js` — no `process.env` outside that file
- Provider health tracked in `provider_health` table, auto-updated on every provider call
- Failed async jobs logged to `dead_letter_queue` with exponential backoff retry
- 367 automated tests covering scoring, classification, gates, checklist, thesis repo safety, config, auth, system health, provider health, dead letter queue, user_id scoping, integration startup, signal normalizer, signal ingestion, scheduler, GDELT ingestion, signal quality, ACLED provider, Polymarket scoring wire, session 4 integration
- Root-level ErrorBoundary catches crashes in any route
