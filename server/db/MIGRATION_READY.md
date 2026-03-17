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
- [ ] All raw SQL queries identified and documented
- [ ] Docker installed on host machine
- [ ] .env template has DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
