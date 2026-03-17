// ============================================================
// Migration: Add 'fred' and 'gdelt' to signals.source_type CHECK constraint
// ============================================================
// SQLite doesn't support ALTER TABLE to modify CHECK constraints,
// so we recreate the table with the updated constraint.
// Safe to re-run — checks if migration is needed first.

import { getDb } from './connection.js';

export function migrateSourceTypes() {
  const db = getDb();

  // Check if we need to migrate by trying a test insert with 'fred'
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS _migration_test_source (
      source_type TEXT NOT NULL CHECK (source_type IN (
        'manual', 'news_feed', 'market_data', 'social', 'government',
        'satellite', 'shipping', 'analyst', 'fred', 'gdelt', 'other'
      ))
    )`);
    db.exec('DROP TABLE _migration_test_source');
  } catch {
    // table creation worked, so the syntax is fine
  }

  // Try inserting 'fred' into the real table to see if constraint allows it
  try {
    const testStmt = db.prepare(
      "INSERT INTO signals (id, category, title, description, source_type, status) VALUES ('__test__', 'other', 'test', 'test', 'fred', 'inbox')"
    );
    testStmt.run();
    // If it worked, delete the test row — constraint already allows 'fred'
    db.prepare("DELETE FROM signals WHERE id = '__test__'").run();
    console.log('[Migration] source-types: Already up to date.');
    return;
  } catch {
    // Constraint doesn't allow 'fred' — need to migrate
  }

  console.log('[Migration] source-types: Rebuilding signals table with new source_type values...');

  db.exec('BEGIN TRANSACTION');
  try {
    // Rename existing table
    db.exec('ALTER TABLE signals RENAME TO signals_old');

    // Create new table with updated constraint
    db.exec(`
      CREATE TABLE signals (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        category TEXT NOT NULL CHECK (category IN (
          'geopolitical_escalation', 'military_mobilization', 'commodity_chokepoint',
          'sanctions_risk', 'shipping_disruption', 'energy_bottleneck',
          'policy_shock', 'currency_instability', 'market_complacency',
          'central_bank_action', 'election_political', 'supply_chain',
          'technology_disruption', 'credit_stress', 'conflict_kinetic',
          'diplomatic_shift', 'regime_change', 'trade_war', 'other'
        )),
        subcategory TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        raw_source TEXT,
        source_type TEXT NOT NULL CHECK (source_type IN (
          'manual', 'news_feed', 'market_data', 'social', 'government',
          'satellite', 'shipping', 'analyst', 'fred', 'gdelt', 'other'
        )),
        source_provider TEXT,
        source_url TEXT,
        source_attribution TEXT,
        novelty TEXT NOT NULL DEFAULT 'unknown' CHECK (novelty IN ('new', 'developing', 'known', 'stale', 'unknown')),
        reliability TEXT NOT NULL DEFAULT 'unverified' CHECK (reliability IN ('verified', 'likely', 'unverified', 'disputed', 'false')),
        signal_strength REAL CHECK (signal_strength BETWEEN 0 AND 1),
        thesis_id TEXT REFERENCES theses(id) ON DELETE SET NULL,
        related_signal_ids TEXT,
        status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'reviewing', 'linked', 'noise', 'archived')),
        tags TEXT
      )
    `);

    // Copy data
    db.exec(`
      INSERT INTO signals SELECT * FROM signals_old
    `);

    // Drop old table
    db.exec('DROP TABLE signals_old');

    // Recreate indexes
    db.exec('CREATE INDEX IF NOT EXISTS idx_signals_category ON signals(category)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_signals_thesis ON signals(thesis_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_signals_created ON signals(created_at)');

    db.exec('COMMIT');
    console.log('[Migration] source-types: Done — added fred, gdelt to source_type.');
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[Migration] source-types: FAILED —', err.message);
  }
}
