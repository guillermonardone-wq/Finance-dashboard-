# Raw SQL Inventory

Every file containing raw SQL queries that must be replaced with Knex.js
in Session 1a. Line numbers reference the formatted codebase after the
pre-build hardening sprint.

## Database Layer (server/db/)

### server/db/connection.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 12-14 | `new Database()`, `.pragma()` | DB init, WAL mode, foreign keys |
| 22-23 | `.exec(schema)` | Execute full schema.sql on init |

### server/db/thesis-repo.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 48-62 | `.prepare().all()` | SELECT * FROM theses with dynamic WHERE (status, classification) |
| 67 | `.prepare().get()` | SELECT * FROM theses WHERE id = ? |
| 76-117 | `.prepare().run()` | INSERT INTO theses (26 columns) |
| 193 | `.prepare().get()` | SELECT * FROM theses WHERE id = ? (existence check before update) |
| 260-261 | `.prepare().run()` | UPDATE theses SET (dynamic columns) WHERE id = ? |
| 268 | `.prepare().run()` | DELETE FROM theses WHERE id = ? |

### server/db/signal-repo.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 40-41 | `.prepare().all()` | SELECT * FROM signals with dynamic WHERE (status, category, thesis_id) |
| 47 | `.prepare().get()` | SELECT * FROM signals WHERE id = ? |
| 54-55 | `.prepare().all()` | SELECT status, COUNT(*) FROM signals GROUP BY status |
| 66-75 | `.prepare().run()` | INSERT INTO signals (19 columns) |
| 102 | `.prepare().get()` | SELECT * FROM signals WHERE id = ? (existence check) |
| 109-125 | `.prepare().run()` | UPDATE signals SET (COALESCE pattern) WHERE id = ? |
| 151 | `.prepare().run()` | DELETE FROM signals WHERE id = ? |

### server/db/migrate-scoring-v2.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 54-56 | `.prepare().all()` | PRAGMA table_info('theses') — schema introspection |
| 62 | `.exec()` | ALTER TABLE theses ADD COLUMN (idempotent migration) |

### server/db/migrate-source-types.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 15-21 | `.exec()` | CREATE/DROP _migration_test_source (constraint check) |
| 28-33 | `.prepare().run()` | INSERT/DELETE test row for migration check |
| 44-109 | `.exec()` | Full table recreation: RENAME → CREATE → INSERT SELECT → DROP → CREATE INDEX |

## Routes (server/routes/)

### server/routes/market.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 115 | `.prepare().all()` | SELECT * FROM market_observations with dynamic WHERE + LIMIT |

### server/routes/bot.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 38-42 | `.exec()` | CREATE TABLE IF NOT EXISTS bot_pipeline_runs |
| 45-48 | `.prepare().all()` | SELECT from bot_pipeline_runs ORDER BY created_at DESC LIMIT ? |
| 67-68 | `.prepare().get()` | SELECT * FROM bot_pipeline_runs WHERE id = ? |
| 86-92 | `.exec()` | CREATE TABLE IF NOT EXISTS bot_recommendations |
| 102 | `.prepare().all()` | SELECT * FROM bot_recommendations with dynamic WHERE + LIMIT |
| 113-124 | `.exec()` + `.prepare().all()` | CREATE TABLE + SELECT escalation recommendations |

### server/routes/reviews.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 28 | `.prepare().all()` | SELECT * FROM reviews with optional thesis_id filter |
| 35-37 | `.prepare().get()` | SELECT * FROM reviews WHERE id = ? |
| 63-108 | `.prepare().run()` + `.get()` | INSERT INTO reviews (25 columns) + fetch newly created |

### server/routes/prediction-markets.js
No direct SQL — delegates to service layer.

## Services (server/services/)

### server/services/thesis-packet.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 32 | `.prepare().get()` | SELECT * FROM theses WHERE id = ? |
| 84-87 | `.prepare().all()` | SELECT signals WHERE thesis_id = ? AND status = ? |
| 121-128 | `.prepare().all()` | SELECT market_observations WHERE thesis_id = ? LIMIT 20 |
| 139-152 | `.prepare().all()` + `.get()` | SELECT thesis_prediction_links JOIN events + latest assessment |
| 189-191 | `.prepare().all()` | SELECT active playbook_entries |

### server/services/cache.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 40-43 | `.prepare().get()` | SELECT from provider_cache WHERE cache_key = ? AND not expired |
| 48-50 | `.prepare().run()` | UPDATE hit_count on cache hit |
| 72-77 | `.prepare().run()` | INSERT OR REPLACE INTO provider_cache |
| 104-106 | `.prepare().run()` | DELETE expired cache entries |

### server/services/advisory.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 278-283 | `.prepare().run()` | INSERT INTO llm_thesis_assessments |
| 312-328 | `.prepare().run()` | UPDATE llm_thesis_assessments SET error |
| 360-367 | `.prepare().get()` + `.run()` | SELECT + UPDATE assessment error |
| 382-385 | `.prepare().get()` | SELECT latest assessment for thesis |
| 395-398 | `.prepare().all()` | SELECT assessment history for thesis |

### server/services/ingestion.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 26-40 | `.prepare().run()` | INSERT INTO market_observations (8 columns) |

### server/services/scheduler.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 68-69 | `.prepare().get()` | SELECT id FROM signals WHERE title = ? (dedup check) |
| 76-105 | `.prepare().run()` | INSERT INTO signals (19 columns, news-to-signal) |

### server/services/fred-signals.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 109-112 | `.prepare().get()` | SELECT id FROM signals WHERE source_provider = 'fred' (dedup) |
| 138-147 | `.prepare().run()` | INSERT INTO signals (19 columns, FRED-sourced) |

### server/services/gdelt-signals.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 114-117 | `.prepare().get()` | SELECT id FROM signals (GDELT dedup with 6h window) |
| ~130-140 | `.prepare().run()` | INSERT INTO signals (19 columns, GDELT-sourced) |

## Bot Pipeline (server/bot/)

### server/bot/pipeline.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 210-227 | `.prepare().all()` | SELECT active playbook_entries + market data |
| 258-269 | `.exec()` | CREATE TABLE IF NOT EXISTS bot_pipeline_runs, bot_recommendations |
| 288-312 | `.prepare().run()` | INSERT INTO bot_pipeline_runs + bot_recommendations |

### server/bot/mispricing.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 188-197 | `.prepare().all()` | SELECT * FROM market_observations WHERE symbol IN (...) |

### server/bot/pattern-matcher.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 240-241 | `.prepare().all()` | SELECT * FROM playbook_entries WHERE status = ? |

## Providers (server/providers/)

### server/providers/prediction-market/service.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 14-35 | `.prepare()` | CRUD for prediction_market_providers |
| 60-85 | `.prepare()` | CRUD for prediction_market_events |
| 108-169 | `.prepare()` | CRUD for prediction_market_snapshots |
| 194-285 | `.prepare()` | CRUD for thesis_prediction_links |
| 292-355 | `.prepare()` | thesis validation + prediction_market_assessments CRUD |

## Entry Point

### server/index.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 48-52 | `.prepare().get()` | SELECT COUNT(*) from theses + signals (startup check) |
| 88 | `.prepare().get()` | SELECT 1 (health check) |

### server/seed-fn.js
| Lines | Operation | Description |
|-------|-----------|-------------|
| 16-25 | `.prepare().run()` | INSERT INTO theses (seed data, 2 theses) |
| 372-534 | `.prepare().run()` | INSERT INTO signals (seed data, multiple signals) |
| 548-610 | `.prepare().run()` | INSERT INTO reviews (seed data, 4 reviews) |
| 722-784 | `.prepare().run()` | INSERT INTO prediction market tables (seed data) |

## Summary

| Category | Files | Approx. SQL operations |
|----------|-------|----------------------|
| DB layer | 4 | ~15 |
| Routes | 4 | ~12 |
| Services | 6 | ~20 |
| Bot | 3 | ~6 |
| Providers | 1 | ~25 |
| Entry/Seed | 2 | ~10 |
| **Total** | **20** | **~88** |

## Tables Referenced

1. theses
2. signals
3. reviews
4. market_observations
5. provider_cache
6. prediction_market_providers
7. prediction_market_events
8. prediction_market_snapshots
9. thesis_prediction_links
10. prediction_market_assessments
11. llm_thesis_assessments
12. bot_pipeline_runs
13. bot_recommendations
14. playbook_entries
