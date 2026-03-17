// ============================================================
// THESIS WORKFLOW TESTS — The critical spine
// ============================================================
// Tests: create, fetch, update, delete, link signal, unlink signal,
//        re-score path, classification tracking, calibration snapshots.
//
// Requires a running PostgreSQL instance (see docker-compose.yml).
// Skips gracefully if DB is unavailable.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Set env before any server imports
process.env.FRED_API_KEY = "";
process.env.FINNHUB_API_KEY = "";
process.env.NEWSAPI_API_KEY = "";
process.env.ALPHA_VANTAGE_API_KEY = "";

const { initDb, getKnex, closeDb } = await import("../server/db/connection.js");
const thesisRepo = await import("../server/db/thesis-repo.js");
const signalRepo = await import("../server/db/signal-repo.js");

let dbAvailable = false;

beforeAll(async () => {
  try {
    await initDb();
    const knex = getKnex();
    // Clean test data
    await knex("signals").where("id", "like", "test-%").del();
    await knex("theses").where("id", "like", "test-%").del();
    dbAvailable = true;
  } catch {
    console.warn("[Test] PostgreSQL not available — skipping DB tests");
  }
});

afterAll(async () => {
  if (dbAvailable) {
    const knex = getKnex();
    await knex("signals").where("id", "like", "test-%").del();
    await knex("theses").where("id", "like", "test-%").del();
  }
  await closeDb();
});

// ---- Thesis CRUD ----

describe("Thesis CRUD", () => {
  const thesisId = "test-thesis-001";

  it("creates a draft thesis with minimal fields", async () => {
    if (!dbAvailable) return;
    const created = await thesisRepo.create(thesisId, {
      title: "Fed pivot in Q3",
      thesis_statement:
        "The Fed will cut rates by September due to slowing employment.",
      status: "draft",
    });

    expect(created).toBeTruthy();
    expect(created.id).toBe(thesisId);
    expect(created.title).toBe("Fed pivot in Q3");
    expect(created.status).toBe("draft");
    expect(created.classification).toBe("WATCH");
  });

  it("fetches a thesis by ID", async () => {
    if (!dbAvailable) return;
    const fetched = await thesisRepo.findById(thesisId);
    expect(fetched).toBeTruthy();
    expect(fetched.title).toBe("Fed pivot in Q3");
    expect(Array.isArray(fetched.causal_chain)).toBe(true);
    expect(Array.isArray(fetched.affected_assets)).toBe(true);
  });

  it("lists all theses", async () => {
    if (!dbAvailable) return;
    const all = await thesisRepo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some((t) => t.id === thesisId)).toBe(true);
  });

  it("filters theses by status", async () => {
    if (!dbAvailable) return;
    const drafts = await thesisRepo.findAll({ status: "draft" });
    expect(drafts.every((t) => t.status === "draft")).toBe(true);
  });

  it("updates thesis fields", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(thesisId, {
      title: "Fed pivot in Q3 (revised)",
      probability_low: 0.3,
      probability_high: 0.7,
      probability_best: 0.5,
      causal_chain: ["Employment slows", "CPI drops", "Fed signals pivot"],
    });

    expect(updated.title).toBe("Fed pivot in Q3 (revised)");
    expect(updated.probability_best).toBe(0.5);
    expect(updated.causal_chain).toEqual([
      "Employment slows",
      "CPI drops",
      "Fed signals pivot",
    ]);
  });

  it("tracks classification changes", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(thesisId, {
      classification: "DEVELOP",
      classification_reason: "Supporting data strengthened",
    });

    expect(updated.classification).toBe("DEVELOP");
    expect(updated.previous_classifications.length).toBe(1);
    expect(updated.previous_classifications[0].from).toBe("WATCH");
    expect(updated.previous_classifications[0].to).toBe("DEVELOP");
  });

  it("sets calibration snapshot on first scoring", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(thesisId, {
      composite_score: 62.5,
    });

    expect(updated.score_at_creation).toBe(62.5);
    expect(updated.classification_at_creation).toBe("DEVELOP");
  });

  it("does not overwrite calibration on subsequent scoring", async () => {
    if (!dbAvailable) return;
    const updated = await thesisRepo.update(thesisId, {
      composite_score: 75.0,
    });

    expect(updated.score_at_creation).toBe(62.5); // unchanged
    expect(updated.composite_score).toBe(75.0);
  });

  it("returns null for non-existent thesis", async () => {
    if (!dbAvailable) return;
    const fetched = await thesisRepo.findById("does-not-exist");
    expect(fetched).toBeNull();
  });

  it("update returns null for non-existent thesis", async () => {
    if (!dbAvailable) return;
    const result = await thesisRepo.update("does-not-exist", { title: "nope" });
    expect(result).toBeNull();
  });

  it("deletes a thesis", async () => {
    if (!dbAvailable) return;
    const deleteId = "test-thesis-delete";
    await thesisRepo.create(deleteId, {
      title: "To be deleted",
      thesis_statement: "This will be removed",
    });
    expect(await thesisRepo.findById(deleteId)).toBeTruthy();

    await thesisRepo.remove(deleteId);
    expect(await thesisRepo.findById(deleteId)).toBeNull();
  });
});

// ---- Signal CRUD ----

describe("Signal CRUD", () => {
  const signalId = "test-signal-001";

  it("creates a signal", async () => {
    if (!dbAvailable) return;
    const created = await signalRepo.create(signalId, {
      title: "Employment data weakening",
      description: "NFP came in below expectations for the third month.",
      category: "central_bank_action",
      source_type: "manual",
    });

    expect(created).toBeTruthy();
    expect(created.id).toBe(signalId);
    expect(created.status).toBe("inbox");
  });

  it("fetches a signal by ID", async () => {
    if (!dbAvailable) return;
    const fetched = await signalRepo.findById(signalId);
    expect(fetched).toBeTruthy();
    expect(fetched.title).toBe("Employment data weakening");
  });

  it("lists all signals", async () => {
    if (!dbAvailable) return;
    const all = await signalRepo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("counts signals by status", async () => {
    if (!dbAvailable) return;
    const counts = await signalRepo.countsByStatus();
    expect(counts.inbox).toBeGreaterThanOrEqual(1);
  });

  it("updates a signal", async () => {
    if (!dbAvailable) return;
    const updated = await signalRepo.update(signalId, {
      reliability: "verified",
      signal_strength: 0.8,
    });

    expect(updated.reliability).toBe("verified");
    expect(updated.signal_strength).toBe(0.8);
  });

  it("returns null for non-existent signal", async () => {
    if (!dbAvailable) return;
    expect(await signalRepo.findById("no-such-signal")).toBeNull();
  });

  it("deletes a signal", async () => {
    if (!dbAvailable) return;
    const deleteId = "test-signal-delete";
    await signalRepo.create(deleteId, {
      title: "To be deleted",
      description: "Remove me",
      category: "other",
    });
    expect(await signalRepo.findById(deleteId)).toBeTruthy();
    await signalRepo.remove(deleteId);
    expect(await signalRepo.findById(deleteId)).toBeNull();
  });
});

// ---- Signal Linking ----

describe("Signal-Thesis Linking", () => {
  const thesisId = "test-thesis-001"; // from earlier test
  const signalId = "test-signal-001"; // from earlier test

  it("links a signal to a thesis", async () => {
    if (!dbAvailable) return;
    const updated = await signalRepo.update(signalId, {
      thesis_id: thesisId,
      status: "linked",
    });

    expect(updated.thesis_id).toBe(thesisId);
    expect(updated.status).toBe("linked");
  });

  it("fetches signals linked to a thesis", async () => {
    if (!dbAvailable) return;
    const linked = await signalRepo.findAll({ thesis_id: thesisId });
    expect(linked.length).toBeGreaterThanOrEqual(1);
    expect(linked[0].thesis_id).toBe(thesisId);
  });

  it("unlinks a signal from a thesis", async () => {
    if (!dbAvailable) return;
    const updated = await signalRepo.update(signalId, {
      thesis_id: null,
      status: "inbox",
    });

    expect(updated.thesis_id).toBeNull();
    expect(updated.status).toBe("inbox");
  });

  it("thesis has no linked signals after unlink", async () => {
    if (!dbAvailable) return;
    const linked = await signalRepo.findAll({ thesis_id: thesisId });
    expect(linked.length).toBe(0);
  });
});

// ---- Scoring Engine ----

describe("Scoring Engine", () => {
  it("computes composite score from factor scores", async () => {
    const { computeCompositeScore, computePenalties } =
      await import("../src/engine/scoring.js");

    const scores = {
      signal_quality: 7,
      signal_independence: 6,
      evidence_freshness: 8,
      data_reliability: 7,
      evidence_quantity: 5,
      causal_chain_clarity: 8,
      internal_consistency: 7,
      counter_case_robustness: 6,
      assumption_load: 7,
      timing_clarity: 5,
      market_awareness: 6,
      prediction_market_divergence: 5,
      asset_reaction_gaps: 4,
      liquidity_sensitivity: 5,
      catalyst_clarity: 6,
    };

    const penalties = computePenalties(scores, [], {
      invalidating_indicators: ["test"],
    });
    const result = computeCompositeScore(scores, penalties);

    expect(result.composite).toBeGreaterThan(0);
    expect(result.composite).toBeLessThanOrEqual(100);
    expect(result.layers.evidence.score).toBeGreaterThan(0);
    expect(result.layers.structure.score).toBeGreaterThan(0);
    expect(result.layers.market_edge.score).toBeGreaterThan(0);
    expect(result.completeness).toBe(100);
  });

  it("applies penalties for missing invalidation", async () => {
    const { computePenalties } = await import("../src/engine/scoring.js");

    const penalties = computePenalties({ signal_quality: 7 }, [], {
      invalidating_indicators: [],
    });

    const missing = penalties.items.find(
      (p) => p.id === "missing_invalidation",
    );
    expect(missing.active).toBe(true);
    expect(missing.value).toBe(10);
  });

  it("detects single-source penalty", async () => {
    const { computePenalties } = await import("../src/engine/scoring.js");

    const signals = [
      { source_type: "manual", title: "A" },
      { source_type: "manual", title: "B" },
    ];

    const penalties = computePenalties({}, signals, {
      invalidating_indicators: ["x"],
    });
    const singleSource = penalties.items.find((p) => p.id === "single_source");
    expect(singleSource.active).toBe(true);
  });

  it("handles empty scores gracefully", async () => {
    const { computeCompositeScore } = await import("../src/engine/scoring.js");
    const result = computeCompositeScore({});
    expect(result.composite).toBe(0);
    expect(result.completeness).toBe(0);
    expect(result.missing.length).toBe(15);
  });
});

// ---- Classification ----

describe("Classification", () => {
  it("classifies based on composite score", async () => {
    const { classifyThesis } = await import("../src/engine/classification.js");

    const result = classifyThesis(
      85,
      { _penaltyTotal: 0 },
      { passed: true, total: 0, hardFails: [], softFails: [], results: [] },
      { status: "active" },
      {
        evidence: { score: 8 },
        structure: { score: 8 },
        market_edge: { score: 7 },
      },
    );

    expect(result.classification).toBeTruthy();
    expect(typeof result.classification).toBe("string");
  });
});
