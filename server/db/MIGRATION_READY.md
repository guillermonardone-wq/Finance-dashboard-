# Database Migration Plan

## Current State
- SQLite via better-sqlite3 (prototype)
- File-backed DB in project directory
- Raw SQL queries in thesis-repo.js and connection.js

## Target State (Session 1a, Master Build v4.2)
- PostgreSQL 16 via docker-compose.yml
- Knex.js query builder (npm install knex pg)
- knexfile.js with environment-based config
- All schema as Knex migration files
- JSONB for JSON fields, UUID for IDs
- user_id TEXT NOT NULL DEFAULT 'default' on all user-scoped tables
- userScoped(table, userId) helper for all queries

## Tables Requiring user_id
theses, signals, trade_plans, decision_log, daily_journal,
thesis_versions, trade_plan_versions, edge_patterns,
youtube_channels, alerts, llm_usage

## Shared Tables (no user_id)
gdelt_monitoring, cot_positions, fred_data, regime_state, provider_cache

## New Tables to Create in Migration
- alerts: id, user_id, type, trade_plan_id, thesis_id, message, sent, acknowledged, created_at
- provider_health: provider_name, last_check, status, last_error, consecutive_failures
- dead_letter_queue: failed_job_id, job_type, payload, error, retry_count, next_retry

## Pre-Migration Checklist
- [x] All raw SQL queries identified and documented (see RAW_SQL_INVENTORY.md — ~88 operations across 20 files)
- [x] .env.example has DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
- [x] Centralized config exists (server/config.js) with DB section ready
- [x] Auth middleware placeholder exists (server/middleware/auth.js)
- [ ] Docker installed on host machine
- [ ] docker-compose.yml created with PostgreSQL 16
- [ ] knexfile.js created with environment-based config

## Session 1a Handoff

### What is already stabilized
- **Scoring engine** (`src/engine/scoring.js`, `classification.js`, `gates.js`, `behavioral.js`): 173 tests passing. Pure functions with no DB dependency — these survive the migration unchanged.
- **Frontend** (`src/App.jsx`, all pages and components): No direct DB access. Talks to Express API only. Survives migration unchanged.
- **Thesis repo** (`server/db/thesis-repo.js`): UPDATABLE_COLUMNS allowlist tested and safe. Dynamic update builder proven correct. This file gets rewritten to use Knex.
- **Signal repo** (`server/db/signal-repo.js`): Same pattern as thesis repo. Rewrite to Knex.
- **API routes** (`server/routes/*.js`): Thin HTTP wrappers over repo functions. Mostly survive — just swap repo imports.

### What must be replaced in Session 1a
1. `server/db/connection.js` — Replace `better-sqlite3` init with Knex connection pool
2. `server/db/thesis-repo.js` — Rewrite all `.prepare().run/get/all()` to `knex('theses').where/insert/update`
3. `server/db/signal-repo.js` — Same treatment
4. `server/db/schema.sql` — Convert to Knex migration files
5. `server/db/migrate-scoring-v2.js` and `migrate-source-types.js` — Absorb into Knex migrations
6. All direct `getDb()` calls in routes and services (see RAW_SQL_INVENTORY.md) — Replace with Knex queries via repo layer
7. `server/seed-fn.js` — Rewrite inserts using Knex

### What must NOT be carried forward from SQLite assumptions
- **No `.prepare()` pattern** — Knex uses builder syntax, not prepared statements
- **No `db.exec()` for DDL** — Use Knex migration files instead
- **No `JSON.stringify()` for storage** — PostgreSQL JSONB handles objects natively
- **No `COALESCE` update pattern** — Knex `.update()` only writes provided fields
- **No `db.pragma()`** — PostgreSQL has its own configuration
- **No file-based DB path** — PostgreSQL uses host/port/credentials
- **No `.run()` return value** for changes — Knex `.update()` returns row count; use `.returning('*')` for updated row
