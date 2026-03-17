// ============================================================
// MIGRATION — Add user_id to execution_plans, trades, reviews, playbook_entries
// ============================================================
// Closes the Session 1a gap: all user-scoped tables must have user_id.
// Existing rows are backfilled via DEFAULT 'default'.
// ============================================================

const TABLES = ["execution_plans", "trades", "reviews", "playbook_entries"];

export async function up(knex) {
  for (const table of TABLES) {
    const hasColumn = await knex.schema.hasColumn(table, "user_id");
    if (!hasColumn) {
      await knex.schema.alterTable(table, (t) => {
        t.text("user_id").notNullable().defaultTo("default");
      });
      await knex.schema.alterTable(table, (t) => {
        t.index("user_id");
      });
    }
  }
}

export async function down(knex) {
  for (const table of TABLES) {
    const hasColumn = await knex.schema.hasColumn(table, "user_id");
    if (hasColumn) {
      await knex.schema.alterTable(table, (t) => {
        t.dropIndex("user_id");
        t.dropColumn("user_id");
      });
    }
  }
}
