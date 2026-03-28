// ============================================================
// USER_ID SCOPING — Verify all user-scoped tables have user_id
// ============================================================
// Tests that the migration and query layer correctly scope by user_id.
// DB-dependent tests skip gracefully if PostgreSQL is unavailable.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";

process.env.FRED_API_KEY = "";
process.env.FINNHUB_API_KEY = "";
process.env.NEWSAPI_API_KEY = "";
process.env.ALPHA_VANTAGE_API_KEY = "";

const { initDb, getKnex, closeDb } = await import("../server/db/connection.js");

let dbAvailable = false;

beforeAll(async () => {
  try {
    const knex = getKnex();
    await knex.raw("SELECT 1");
    await initDb();
    dbAvailable = true;
  } catch {
    console.warn("[Test] PostgreSQL not available — skipping DB tests");
  }
});

afterAll(async () => {
  if (dbAvailable) {
    const knex = getKnex();
    // Cleanup test rows
    await knex("reviews").where("user_id", "test-user-scoping").del();
    await knex("playbook_entries").where("user_id", "test-user-scoping").del();
    await closeDb();
  }
});

describe("user_id column exists on all user-scoped tables", () => {
  const USER_SCOPED_TABLES = [
    "theses",
    "signals",
    "alerts",
    "execution_plans",
    "trades",
    "reviews",
    "playbook_entries",
  ];

  for (const table of USER_SCOPED_TABLES) {
    it(`${table} has user_id column`, async () => {
      if (!dbAvailable) return;
      const knex = getKnex();
      const hasCol = await knex.schema.hasColumn(table, "user_id");
      expect(hasCol, `${table} missing user_id`).toBe(true);
    });
  }
});

describe("user_id defaults to 'default' on insert", () => {
  it("reviews: inserted row has user_id = default when not specified", async () => {
    if (!dbAvailable) return;
    const knex = getKnex();

    // Need a thesis to reference
    const [thesis] = await knex("theses")
      .select("id")
      .limit(1);
    if (!thesis) return; // no thesis to link — skip

    const { v4: uuidv4 } = await import("uuid");
    const id = uuidv4();
    await knex("reviews").insert({
      id,
      thesis_id: thesis.id,
      outcome: "test",
      outcome_description: "test outcome",
      process_followed: true,
      lessons_learned: "This is a test lesson that is long enough.",
    });

    const row = await knex("reviews").where("id", id).first();
    expect(row.user_id).toBe("default");

    // Cleanup
    await knex("reviews").where("id", id).del();
  });
});

describe("user_id scoping filters correctly", () => {
  it("reviews: scoped query only returns rows for the matching user", async () => {
    if (!dbAvailable) return;
    const knex = getKnex();

    const [thesis] = await knex("theses").select("id").limit(1);
    if (!thesis) return;

    const { v4: uuidv4 } = await import("uuid");
    const id1 = uuidv4();
    const id2 = uuidv4();

    // Insert for two different users
    await knex("reviews").insert({
      id: id1,
      user_id: "test-user-scoping",
      thesis_id: thesis.id,
      outcome: "test",
      outcome_description: "user A",
      process_followed: true,
      lessons_learned: "Lesson for user A that is long enough.",
    });
    await knex("reviews").insert({
      id: id2,
      user_id: "other-user",
      thesis_id: thesis.id,
      outcome: "test",
      outcome_description: "user B",
      process_followed: true,
      lessons_learned: "Lesson for user B that is long enough.",
    });

    // Query scoped to test-user-scoping
    const rows = await knex("reviews").where("user_id", "test-user-scoping");
    expect(rows.some((r) => r.id === id1)).toBe(true);
    expect(rows.some((r) => r.id === id2)).toBe(false);

    // Cleanup
    await knex("reviews").where("id", id1).del();
    await knex("reviews").where("id", id2).del();
  });

  it("playbook_entries: scoped query only returns rows for the matching user", async () => {
    if (!dbAvailable) return;
    const knex = getKnex();

    const { v4: uuidv4 } = await import("uuid");
    const id1 = uuidv4();
    const id2 = uuidv4();

    await knex("playbook_entries").insert({
      id: id1,
      user_id: "test-user-scoping",
      title: "Test Pattern A",
      category: "test",
      pattern_description: "Test pattern A",
      trigger_conditions: JSON.stringify(["condition1"]),
      typical_assets: JSON.stringify(["SPY"]),
    });
    await knex("playbook_entries").insert({
      id: id2,
      user_id: "other-user",
      title: "Test Pattern B",
      category: "test",
      pattern_description: "Test pattern B",
      trigger_conditions: JSON.stringify(["condition2"]),
      typical_assets: JSON.stringify(["QQQ"]),
    });

    const rows = await knex("playbook_entries")
      .where("user_id", "test-user-scoping")
      .where("status", "active");
    expect(rows.some((r) => r.id === id1)).toBe(true);
    expect(rows.some((r) => r.id === id2)).toBe(false);

    // Cleanup
    await knex("playbook_entries").where("id", id1).del();
    await knex("playbook_entries").where("id", id2).del();
  });
});
