import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/providers.test.js'],
    testTimeout: 15000,
    pool: 'forks',
  },
});

// ============================================================
// TEST CATEGORIZATION — Unit vs Integration
// ============================================================
//
// Unit tests (no DB required — pure functions or mocked DB):
//   scoring-engine.test.js       — 122 tests, scoring/gates/classification/checklist
//   signal-normalizer.test.js    — normalizer pure functions
//   signal-quality.test.js       — quality filter/scoring/consolidation
//   thesis-repo.test.js          — allowlist checks only (no real DB)
//   batch-consolidation.test.js  — consolidation logic + file structure checks
//   session4-integration.test.js — file structure + normalizer checks
//   auth.test.js                 — mocked middleware
//   config.test.js               — mocked config loading
//   dead-letter.test.js          — mocked DB
//   provider-health.test.js      — mocked DB
//   system-health.test.js        — mocked DB
//   signal-ingestion.test.js     — mocked DB + providers
//   gdelt-ingestion.test.js      — mocked DB + file checks
//   scheduler-unified.test.js    — mocked DB + file checks
//
// Integration tests (require live PostgreSQL):
//   integration-startup.test.js  — DB connection + migration check
//   thesis-workflow.test.js      — full thesis CRUD lifecycle
//   thesis-update-safety.test.js — thesis update allowlist enforcement
//   user-id-scoping.test.js      — multi-tenant isolation
//
// To run unit tests only (no DB):
//   npx vitest run tests/scoring-engine.test.js tests/signal-normalizer.test.js tests/signal-quality.test.js
// ============================================================
