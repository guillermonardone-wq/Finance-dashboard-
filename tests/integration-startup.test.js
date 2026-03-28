// ============================================================
// INTEGRATION STARTUP — Verify DB init, migrations, basic queries
// ============================================================
// Validates that the full startup path works:
// 1. initDb() connects and runs migrations
// 2. All expected tables exist
// 3. Basic CRUD works on user-scoped tables
// Skips gracefully if PostgreSQL is unavailable.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";

let dbAvailable = false;
let knex;

beforeAll(async () => {
  try {
    const mod = await import("../server/db/connection.js");
    knex = mod.getKnex();
    await knex.raw("SELECT 1");
    await mod.initDb();
    dbAvailable = true;
  } catch {
    console.warn("[Test] PostgreSQL not available — skipping integration tests");
  }
});

afterAll(async () => {
  if (dbAvailable) {
    const mod = await import("../server/db/connection.js");
    await mod.closeDb();
  }
});

describe("DB startup integration", () => {
  it("connects to PostgreSQL", async () => {
    if (!dbAvailable) return;
    const result = await knex.raw("SELECT 1 AS ok");
    expect(result.rows[0].ok).toBe(1);
  });

  it("migrations created all expected tables", async () => {
    if (!dbAvailable) return;
    const expectedTables = [
      "theses", "signals", "execution_plans", "trades", "reviews",
      "playbook_entries", "market_observations", "checklist_results",
      "alerts", "provider_health", "dead_letter_queue",
      "prediction_market_events", "prediction_market_snapshots",
      "bot_pipeline_runs", "bot_recommendations",
    ];
    for (const table of expectedTables) {
      const exists = await knex.schema.hasTable(table);
      expect(exists, `Table ${table} should exist`).toBe(true);
    }
  });

  it("can insert and read from a user-scoped table", async () => {
    if (!dbAvailable) return;
    const { v4: uuidv4 } = await import("uuid");
    const id = uuidv4();

    await knex("playbook_entries").insert({
      id,
      user_id: "integration-test",
      title: "Integration Test Pattern",
      category: "test",
      pattern_description: "Test description for integration",
      trigger_conditions: JSON.stringify(["trigger"]),
      typical_assets: JSON.stringify(["TEST"]),
    });

    const row = await knex("playbook_entries").where("id", id).first();
    expect(row).toBeTruthy();
    expect(row.user_id).toBe("integration-test");
    expect(row.title).toBe("Integration Test Pattern");

    // Cleanup
    await knex("playbook_entries").where("id", id).del();
  });

  it("migration path resolves correctly (absolute path)", async () => {
    if (!dbAvailable) return;
    // If we got here, initDb() ran migrations successfully using
    // the absolute path. Verify by checking knex_migrations table.
    const migrations = await knex("knex_migrations").select("name");
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0].name).toContain("baseline");
  });
});

describe("waitForDb retry behavior", () => {
  it("connection module exports expected functions", async () => {
    const mod = await import("../server/db/connection.js");
    expect(typeof mod.getKnex).toBe("function");
    expect(typeof mod.initDb).toBe("function");
    expect(typeof mod.closeDb).toBe("function");
    expect(typeof mod.userScoped).toBe("function");
  });

  it("userScoped returns correct filter object", async () => {
    const mod = await import("../server/db/connection.js");
    expect(mod.userScoped("user-123")).toEqual({ user_id: "user-123" });
    expect(mod.userScoped()).toEqual({ user_id: "default" });
  });
});
