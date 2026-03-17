# Database State — Handoff Doc

## Current State

- **PostgreSQL 16** via `docker-compose.yml`
- **Knex.js** query builder for all database access
- **Schema**: single baseline migration at `server/db/migrations/20260317000000_baseline.js`
- **Connection**: `server/db/connection.js` exports `getKnex()`, `initDb()`, `closeDb()`, `userScoped()`
- **Zero raw SQL** in runtime code — all queries use Knex builder syntax
- **Zero `process.env`** outside `server/config.js`
- **Auto-migration**: `initDb()` runs `knex.migrate.latest()` on startup

## What was migrated (Session 1a)

All ~88 raw SQL operations across 20 files were converted to Knex:

| Layer | Files converted |
|-------|----------------|
| DB repos | `thesis-repo.js`, `signal-repo.js` |
| Routes | `market.js`, `bot.js`, `reviews.js` |
| Services | `advisory.js`, `cache.js`, `ingestion.js`, `scheduler.js`, `fred-signals.js`, `gdelt-signals.js`, `thesis-packet.js` |
| Bot | `pipeline.js`, `mispricing.js`, `pattern-matcher.js` |
| Providers | `prediction-market/service.js` |
| Entry | `index.js`, `seed-fn.js` |

## Residual artifacts

- `server/db/schema.sql` — old SQLite schema, no longer imported by any runtime code. Kept for reference only.

## What still uses direct Knex queries (not repo-abstracted)

Most database access goes through Knex builder calls scattered across services and routes rather than through a clean repo abstraction layer. This works fine but means:

- Query logic lives in route handlers and services, not isolated in repo files
- `thesis-repo.js` and `signal-repo.js` exist as repo abstractions, but other tables (reviews, bot_pipeline_runs, market_observations, etc.) are queried inline

This is not a bug — it's a pragmatic choice. A future cleanup could consolidate into per-table repos if needed.

## Tables (28 total)

Defined in the baseline migration. Key tables:

| Table | Purpose |
|-------|---------|
| `theses` | Investment theses with scoring fields |
| `signals` | Raw observations from any source |
| `reviews` | Decision reviews with checklist scores |
| `market_observations` | Cached market data snapshots |
| `provider_cache` | Provider response cache with TTL |
| `provider_health` | Per-provider health tracking (Session 1b) |
| `dead_letter_queue` | Failed job tracking with retry (Session 1b) |
| `bot_pipeline_runs` | Bot analysis run history |
| `bot_recommendations` | Bot-generated recommendations |
| `llm_thesis_assessments` | LLM advisory evaluation results |
| `prediction_market_*` | Prediction market providers, events, snapshots, links, assessments |
