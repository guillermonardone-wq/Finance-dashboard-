// ============================================================
// THESIS WORKFLOW TESTS — The critical spine
// ============================================================
// Tests: create, fetch, update, delete, link signal, unlink signal,
//        re-score path, classification tracking, calibration snapshots.
//
// Uses a fresh in-memory-style test DB for each suite run.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = join(__dirname, "../data/test-thesis-workflow.db");

// Set env before any server imports
process.env.DB_PATH = TEST_DB_PATH;
process.env.FRED_API_KEY = "";
process.env.FINNHUB_API_KEY = "";
process.env.NEWSAPI_API_KEY = "";
process.env.ALPHA_VANTAGE_API_KEY = "";

// Ensure data dir
const dataDir = join(__dirname, "../data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Clean up previous test DB
if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

// Import after env setup
const { initDb, closeDb } = await import("../server/db/connection.js");
const thesisRepo = await import("../server/db/thesis-repo.js");
const signalRepo = await import("../server/db/signal-repo.js");

// ---- Setup ----

beforeAll(() => {
  initDb();
  // Run migrations
  import("../server/db/migrate-scoring-v2.js").then((m) =>
    m.migrateScoringV2(),
  );
  import("../server/db/migrate-source-types.js").then((m) =>
    m.migrateSourceTypes(),
  );
});

afterAll(() => {
  closeDb();
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
});

// ---- Thesis CRUD ----

describe("Thesis CRUD", () => {
  const thesisId = "test-thesis-001";

  it("creates a draft thesis with minimal fields", () => {
    const created = thesisRepo.create(thesisId, {
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

  it("fetches a thesis by ID", () => {
    const fetched = thesisRepo.findById(thesisId);
    expect(fetched).toBeTruthy();
    expect(fetched.title).toBe("Fed pivot in Q3");
    expect(Array.isArray(fetched.causal_chain)).toBe(true);
    expect(Array.isArray(fetched.affected_assets)).toBe(true);
  });

  it("lists all theses", () => {
    const all = thesisRepo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some((t) => t.id === thesisId)).toBe(true);
  });

  it("filters theses by status", () => {
    const drafts = thesisRepo.findAll({ status: "draft" });
    expect(drafts.every((t) => t.status === "draft")).toBe(true);
  });

  it("updates thesis fields", () => {
    const updated = thesisRepo.update(thesisId, {
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

  it("tracks classification changes", () => {
    const updated = thesisRepo.update(thesisId, {
      classification: "DEVELOP",
      classification_reason: "Supporting data strengthened",
    });

    expect(updated.classification).toBe("DEVELOP");
    expect(updated.previous_classifications.length).toBe(1);
    expect(updated.previous_classifications[0].from).toBe("WATCH");
    expect(updated.previous_classifications[0].to).toBe("DEVELOP");
  });

  it("sets calibration snapshot on first scoring", () => {
    const updated = thesisRepo.update(thesisId, {
      composite_score: 62.5,
    });

    expect(updated.score_at_creation).toBe(62.5);
    expect(updated.classification_at_creation).toBe("DEVELOP");
  });

  it("does not overwrite calibration on subsequent scoring", () => {
    const updated = thesisRepo.update(thesisId, {
      composite_score: 75.0,
    });

    expect(updated.score_at_creation).toBe(62.5); // unchanged
    expect(updated.composite_score).toBe(75.0);
  });

  it("returns null for non-existent thesis", () => {
    const fetched = thesisRepo.findById("does-not-exist");
    expect(fetched).toBeNull();
  });

  it("update returns null for non-existent thesis", () => {
    const result = thesisRepo.update("does-not-exist", { title: "nope" });
    expect(result).toBeNull();
  });

  it("deletes a thesis", () => {
    const deleteId = "test-thesis-delete";
    thesisRepo.create(deleteId, {
      title: "To be deleted",
      thesis_statement: "This will be removed",
    });
    expect(thesisRepo.findById(deleteId)).toBeTruthy();

    thesisRepo.remove(deleteId);
    expect(thesisRepo.findById(deleteId)).toBeNull();
  });
});

// ---- Signal CRUD ----

describe("Signal CRUD", () => {
  const signalId = "test-signal-001";

  it("creates a signal", () => {
    const created = signalRepo.create(signalId, {
      title: "Employment data weakening",
      description: "NFP came in below expectations for the third month.",
      category: "central_bank_action",
      source_type: "manual",
    });

    expect(created).toBeTruthy();
    expect(created.id).toBe(signalId);
    expect(created.status).toBe("inbox");
  });

  it("fetches a signal by ID", () => {
    const fetched = signalRepo.findById(signalId);
    expect(fetched).toBeTruthy();
    expect(fetched.title).toBe("Employment data weakening");
  });

  it("lists all signals", () => {
    const all = signalRepo.findAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it("counts signals by status", () => {
    const counts = signalRepo.countsByStatus();
    expect(counts.inbox).toBeGreaterThanOrEqual(1);
  });

  it("updates a signal", () => {
    const updated = signalRepo.update(signalId, {
      reliability: "verified",
      signal_strength: 0.8,
    });

    expect(updated.reliability).toBe("verified");
    expect(updated.signal_strength).toBe(0.8);
  });

  it("returns null for non-existent signal", () => {
    expect(signalRepo.findById("no-such-signal")).toBeNull();
  });

  it("deletes a signal", () => {
    const deleteId = "test-signal-delete";
    signalRepo.create(deleteId, {
      title: "To be deleted",
      description: "Remove me",
      category: "other",
    });
    expect(signalRepo.findById(deleteId)).toBeTruthy();
    signalRepo.remove(deleteId);
    expect(signalRepo.findById(deleteId)).toBeNull();
  });
});

// ---- Signal Linking ----

describe("Signal-Thesis Linking", () => {
  const thesisId = "test-thesis-001"; // from earlier test
  const signalId = "test-signal-001"; // from earlier test

  it("links a signal to a thesis", () => {
    const updated = signalRepo.update(signalId, {
      thesis_id: thesisId,
      status: "linked",
    });

    expect(updated.thesis_id).toBe(thesisId);
    expect(updated.status).toBe("linked");
  });

  it("fetches signals linked to a thesis", () => {
    const linked = signalRepo.findAll({ thesis_id: thesisId });
    expect(linked.length).toBeGreaterThanOrEqual(1);
    expect(linked[0].thesis_id).toBe(thesisId);
  });

  it("unlinks a signal from a thesis", () => {
    const updated = signalRepo.update(signalId, {
      thesis_id: null,
      status: "inbox",
    });

    expect(updated.thesis_id).toBeNull();
    expect(updated.status).toBe("inbox");
  });

  it("thesis has no linked signals after unlink", () => {
    const linked = signalRepo.findAll({ thesis_id: thesisId });
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

    // High score should classify well
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
