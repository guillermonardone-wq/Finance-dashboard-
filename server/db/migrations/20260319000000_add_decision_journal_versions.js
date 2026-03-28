// ============================================================
// MIGRATION — Add decision_log, daily_journal, thesis_versions
// ============================================================
// decision_log: append-only audit trail for thesis decisions
// daily_journal: one entry per user per day
// thesis_versions: full thesis snapshots for score delta tracking
// ============================================================

export async function up(knex) {
  // ---- DECISION LOG (append-only) ----
  await knex.schema.createTable("decision_log", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("user_id").notNullable().defaultTo("default");
    t.uuid("thesis_id").references("id").inTable("theses").onDelete("SET NULL");
    t.uuid("signal_id").references("id").inTable("signals").onDelete("SET NULL");
    t.text("action").notNullable();
    t.text("from_value");
    t.text("to_value");
    t.text("reason").notNullable();
    t.jsonb("context_snapshot");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.index("user_id");
    t.index("thesis_id");
    t.index("created_at");
  });

  // Append-only triggers — prevent UPDATE and DELETE
  await knex.raw(`
    CREATE OR REPLACE FUNCTION prevent_decision_log_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'decision_log is append-only. Updates and deletes are not permitted.';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await knex.raw(`
    CREATE TRIGGER decision_log_no_update
    BEFORE UPDATE ON decision_log
    FOR EACH ROW EXECUTE FUNCTION prevent_decision_log_mutation();
  `);
  await knex.raw(`
    CREATE TRIGGER decision_log_no_delete
    BEFORE DELETE ON decision_log
    FOR EACH ROW EXECUTE FUNCTION prevent_decision_log_mutation();
  `);

  // ---- DAILY JOURNAL ----
  await knex.schema.createTable("daily_journal", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.text("user_id").notNullable().defaultTo("default");
    t.date("entry_date").notNullable();
    t.text("content").notNullable().defaultTo("");
    t.text("mood");
    t.text("market_conditions");
    t.jsonb("key_decisions");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    t.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    t.unique(["user_id", "entry_date"]);
    t.index("user_id");
    t.index("entry_date");
  });

  // ---- THESIS VERSIONS ----
  await knex.schema.createTable("thesis_versions", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    t.uuid("thesis_id").notNullable().references("id").inTable("theses").onDelete("CASCADE");
    t.text("user_id").notNullable().defaultTo("default");
    t.integer("version_number").notNullable();
    t.jsonb("snapshot").notNullable();
    t.text("change_summary");
    t.timestamp("created_at").notNullable().defaultTo(knex.fn.now());

    t.unique(["thesis_id", "version_number"]);
    t.index("thesis_id");
    t.index("created_at");
  });
}

export async function down(knex) {
  // Drop triggers first (before dropping the table they reference)
  await knex.raw("DROP TRIGGER IF EXISTS decision_log_no_delete ON decision_log");
  await knex.raw("DROP TRIGGER IF EXISTS decision_log_no_update ON decision_log");
  await knex.raw("DROP FUNCTION IF EXISTS prevent_decision_log_mutation()");

  await knex.schema.dropTableIfExists("thesis_versions");
  await knex.schema.dropTableIfExists("daily_journal");
  await knex.schema.dropTableIfExists("decision_log");
}
