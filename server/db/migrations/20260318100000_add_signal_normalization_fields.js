// ============================================================
// MIGRATION — Add normalized signal fields
// ============================================================
// Adds entity, value, previous_value, change, significance,
// direction, and summary to signals table for the
// Signal Ingestion + Normalization Layer.
// All nullable — existing signals are unaffected.
// ============================================================

export async function up(knex) {
  const cols = ["entity", "value", "previous_value", "change", "significance", "direction", "summary"];
  for (const col of cols) {
    const exists = await knex.schema.hasColumn("signals", col);
    if (exists) continue;

    await knex.schema.alterTable("signals", (t) => {
      if (col === "value" || col === "previous_value" || col === "change") {
        t.float(col);
      } else if (col === "significance") {
        t.integer(col);
      } else {
        // entity, direction, summary
        t.text(col);
      }
    });
  }

  // Index on entity for filtering
  const hasEntityIndex = await knex.schema.hasColumn("signals", "entity");
  if (hasEntityIndex) {
    try {
      await knex.schema.alterTable("signals", (t) => {
        t.index("entity");
        t.index("source_provider");
      });
    } catch {
      // Indexes may already exist
    }
  }
}

export async function down(knex) {
  const cols = ["entity", "value", "previous_value", "change", "significance", "direction", "summary"];
  await knex.schema.alterTable("signals", (t) => {
    try { t.dropIndex("entity"); } catch {}
    try { t.dropIndex("source_provider"); } catch {}
    for (const col of cols) {
      t.dropColumn(col);
    }
  });
}
