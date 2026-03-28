# Raw SQL Inventory — Current State

All database access has been migrated from better-sqlite3 to Knex.js query builder.
This file documents the remaining uses of `knex.raw()` in runtime code.

## knex.raw() usage (runtime)

| File | Usage | Purpose |
|------|-------|---------|
| `server/index.js:80` | `getKnex().raw("SELECT 1")` | Legacy health check |
| `server/routes/system.js:16` | `getKnex().raw("SELECT 1")` | System health check |
| `server/bot/pipeline.js:184,190` | `knex.raw("now() - interval '48 hours'")` | Recent data window filter |

## knex.raw() usage (migration only)

| File | Usage | Purpose |
|------|-------|---------|
| `server/db/migrations/20260317000000_baseline.js` | `knex.raw("gen_random_uuid()")` | UUID default for primary keys (21 tables) |

## Summary

- **Zero** `.prepare()`, `.exec()`, or `getDb()` calls in runtime code
- **Zero** SQLite artifacts remaining (schema.sql removed)
- **3** `knex.raw()` calls in runtime (health checks + time interval)
- All query logic uses Knex builder: `.where()`, `.insert()`, `.update()`, `.select()`, etc.
