// ============================================================
// THESIS UPDATE SAFETY TESTS — Dynamic SQL correctness
// ============================================================
// Validates that the dynamic update function:
// - Only writes provided fields
// - Preserves unmentioned fields
// - Handles JSON fields correctly (JSONB in PostgreSQL)
// - Handles partial updates without misalignment
// - Rejects unknown columns
// - Tracks classification changes and calibration snapshots
//
// Requires a running PostgreSQL instance (see docker-compose.yml).
// Skips gracefully if DB is unavailable.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";

process.env.FRED_API_KEY = "";
process.env.FINNHUB_API_KEY = "";
process.env.NEWSAPI_API_KEY = "";
process.env.ALPHA_VANTAGE_API_KEY = "";

const { initDb, getKnex, closeDb } = await import("../server/db/connection.js");
const thesisRepo = await import("../server/db/thesis-repo.js");

let dbAvailable = false;

beforeAll(async () => {
  try {
    await initDb();
    const knex = getKnex();
    await knex("theses").where("id", "like", "update-safety-%").del();
    dbAvailable = true;
  } catch {
    console.warn("[Test] PostgreSQL not available — skipping DB tests");
  }
});

afterAll(async () => {
  if (dbAvailable) {
    const knex = getKnex();
    await knex("theses").where("id", "like", "update-safety-%").del();
  }
  await closeDb();
});

describe("Thesis Update Safety — Partial Updates", () => {
  const id = "update-safety-001";

  it("creates a baseline thesis", async () => {
    if (!dbAvailable) return;
    const created = await thesisRepo.create(id, {
      title: "Original Title",
      thesis_statement: "Original statement about macro conditions",
      probability_low: 0.2,
      probability_high: 0.6,
      probability_best: 0.4,
      causal_chain: ["Step A", "Step B"],
      affected_assets: [{ asset: "SPY", direction: "long" }],
      disconfirming_evidence: ["Evidence 1"],
      strongest_bear_case: "Bears say inflation stays high",
      tags: ["macro", "fed"],
    });

    expect(created.title).toBe("Original Title");
    expect(created.probability_low).toBe(0.2);
    expect(created.causal_chain).toEqual(["Step A", "Step B"]);
    expect(created.tags).toEqual(["macro", "fed"]);
  });

  it("updates only title, preserves everything else", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, { title: "Updated Title" });

    expect(updated.title).toBe("Updated Title");
    expect(updated.thesis_statement).toBe(
      "Original statement about macro conditions",
    );
    expect(updated.probability_low).toBe(0.2);
    expect(updated.probability_high).toBe(0.6);
    expect(updated.probability_best).toBe(0.4);
    expect(updated.causal_chain).toEqual(["Step A", "Step B"]);
    expect(updated.affected_assets).toEqual([
      { asset: "SPY", direction: "long" },
    ]);
    expect(updated.disconfirming_evidence).toEqual(["Evidence 1"]);
    expect(updated.strongest_bear_case).toBe("Bears say inflation stays high");
    expect(updated.tags).toEqual(["macro", "fed"]);
  });

  it("updates only a score field, preserves non-score fields", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, { score_signal_quality: 7.5 });

    expect(updated.score_signal_quality).toBe(7.5);
    expect(updated.title).toBe("Updated Title");
    expect(updated.causal_chain).toEqual(["Step A", "Step B"]);
  });

  it("updates multiple score fields at once", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      score_signal_independence: 6,
      score_evidence_freshness: 8,
      score_data_reliability: 7,
      composite_score: 65.5,
    });

    expect(updated.score_signal_independence).toBe(6);
    expect(updated.score_evidence_freshness).toBe(8);
    expect(updated.score_data_reliability).toBe(7);
    expect(updated.composite_score).toBe(65.5);
    expect(updated.score_signal_quality).toBe(7.5);
  });

  it("updates JSON fields correctly", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      causal_chain: ["New Step 1", "New Step 2", "New Step 3"],
      key_assumptions: ["Assumption A"],
    });

    expect(updated.causal_chain).toEqual([
      "New Step 1",
      "New Step 2",
      "New Step 3",
    ]);
    expect(updated.key_assumptions).toEqual(["Assumption A"]);
    expect(updated.affected_assets).toEqual([
      { asset: "SPY", direction: "long" },
    ]);
  });

  it("ignores unknown columns silently", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      unknown_field: "should be ignored",
      __proto__: { bad: true },
      constructor: "evil",
      title: "Still works",
    });

    expect(updated.title).toBe("Still works");
    expect(updated.unknown_field).toBeUndefined();
  });

  it("handles empty update (only updates updated_at)", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {});

    expect(updated.title).toBe("Still works");
    expect(updated.updated_at).toBeTruthy();
  });
});

describe("Thesis Update Safety — Classification Tracking", () => {
  const id = "update-safety-002";

  it("creates a thesis at WATCH", async () => {
    if (!dbAvailable) return;
    const created = await thesisRepo.create(id, {
      title: "Classification test",
      thesis_statement: "Testing classification changes",
    });
    expect(created.classification).toBe("WATCH");
    expect(
      created.previous_classifications == null ||
        (Array.isArray(created.previous_classifications) &&
          created.previous_classifications.length === 0),
    ).toBe(true);
  });

  it("tracks classification change to DEVELOP", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      classification: "DEVELOP",
      classification_reason: "More evidence gathered",
    });

    expect(updated.classification).toBe("DEVELOP");
    expect(updated.previous_classifications.length).toBe(1);
    expect(updated.previous_classifications[0].from).toBe("WATCH");
    expect(updated.previous_classifications[0].to).toBe("DEVELOP");
    expect(updated.previous_classifications[0].reason).toBe(
      "More evidence gathered",
    );
  });

  it("tracks second classification change", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      classification: "PAPER_TRADE",
    });

    expect(updated.classification).toBe("PAPER_TRADE");
    expect(updated.previous_classifications.length).toBe(2);
    expect(updated.previous_classifications[1].from).toBe("DEVELOP");
    expect(updated.previous_classifications[1].to).toBe("PAPER_TRADE");
  });

  it("does not add entry for same classification", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      classification: "PAPER_TRADE",
      title: "Updated title",
    });

    expect(updated.previous_classifications.length).toBe(2);
  });
});

describe("Thesis Update Safety — Calibration Snapshots", () => {
  const id = "update-safety-003";

  it("creates a thesis with no calibration", async () => {
    if (!dbAvailable) return;
    const created = await thesisRepo.create(id, {
      title: "Calibration test",
      thesis_statement: "Testing calibration snapshots",
    });
    expect(created.score_at_creation).toBeNull();
    expect(created.classification_at_creation).toBeNull();
  });

  it("sets calibration snapshot on first composite_score", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, { composite_score: 55.0 });

    expect(updated.score_at_creation).toBe(55.0);
    expect(updated.classification_at_creation).toBe("WATCH");
  });

  it("does not overwrite calibration on subsequent scoring", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, { composite_score: 72.0 });

    expect(updated.score_at_creation).toBe(55.0); // unchanged
    expect(updated.composite_score).toBe(72.0);
  });

  it("sets approval snapshot when status transitions to approved", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      status: "approved",
      composite_score: 78.0,
    });

    expect(updated.score_at_approval).toBe(78.0);
  });

  it("does not overwrite approval snapshot on further updates", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      composite_score: 82.0,
    });

    expect(updated.score_at_approval).toBe(78.0); // unchanged
  });
});

describe("Thesis Update Safety — penalty_details and confidence_factors", () => {
  const id = "update-safety-004";

  it("creates and updates penalty_details as JSON", async () => {
    if (!dbAvailable) return;
    await thesisRepo.create(id, {
      title: "Penalty test",
      thesis_statement: "Testing JSON fields",
    });

    const updated = await thesisRepo.update(id, {
      penalty_details: [{ id: "single_source", value: 8, active: true }],
      penalty_total: 8,
    });

    expect(updated.penalty_details).toEqual([
      { id: "single_source", value: 8, active: true },
    ]);
    expect(updated.penalty_total).toBe(8);
  });

  it("updates confidence_factors as JSON", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(id, {
      confidence_factors: { completeness: 0.8, evidence_volume: 0.7 },
      confidence_level: 0.72,
    });

    expect(updated.confidence_factors).toEqual({
      completeness: 0.8,
      evidence_volume: 0.7,
    });
    expect(updated.confidence_level).toBe(0.72);
  });
});
