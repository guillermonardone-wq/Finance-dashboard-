import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";
import * as thesisRepo from "../db/thesis-repo.js";
import { logDecision } from "../db/decision-log-repo.js";

const router = Router();

// POST /from-cluster — Create a draft thesis from a bot feed cluster
router.post("/from-cluster", async (req, res) => {
  const { cluster, signals: clusterSignals, counter_case } = req.body || {};

  if (!cluster || !cluster.title) {
    return res.status(400).json({ error: "Cluster with title is required." });
  }

  const id = uuidv4();
  const now = new Date();

  // Infer timeframe from signal ages
  const signalDates = (clusterSignals || [])
    .map(s => s.created_at ? new Date(s.created_at) : null)
    .filter(Boolean);
  const oldestSignalDays = signalDates.length > 0
    ? Math.floor((now - Math.min(...signalDates.map(d => d.getTime()))) / 86400000)
    : 0;
  const horizon = oldestSignalDays <= 7 ? "tactical" : oldestSignalDays <= 30 ? "swing" : "strategic";

  const thesisData = {
    title: cluster.title,
    thesis_statement: cluster.summary || cluster.title,
    status: "draft",
    classification: "WATCH",
    causal_chain: [],
    affected_assets: [],
    expected_timeline: { start: now.toISOString().slice(0, 10), end: "", basis: `${horizon} horizon (inferred from signal ages)` },
    probability_low: 0.1,
    probability_high: 0.5,
    probability_best: 0.25,
    market_pricing_assessment: { description: "", implied_prob: "", gap_size: "" },
    key_assumptions: [],
    alternative_explanations: [],
    disconfirming_evidence: [],
    strongest_bear_case: counter_case?.strongest_opposing_case || "",
    what_would_make_opposite_stronger: "",
    tags: [cluster.primary_category, horizon].filter(Boolean),
  };

  try {
    const created = await thesisRepo.create(id, thesisData);
    if (!created) {
      return res.status(500).json({ error: "Thesis creation failed." });
    }

    // Link signals to the new thesis
    const signalIds = (clusterSignals || []).map(s => s.id).filter(Boolean);
    if (signalIds.length > 0) {
      const knex = getKnex();
      await knex("signals")
        .whereIn("id", signalIds)
        .update({ thesis_id: id, status: "linked", updated_at: now.toISOString() });
    }

    console.log(`[Theses] POST /from-cluster — CREATED id=${id}, linked ${signalIds.length} signals`);
    res.status(201).json({ ...created, linked_signal_count: signalIds.length });
  } catch (err) {
    console.error(`[Theses] POST /from-cluster — FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// GET all theses (with optional filters)
router.get("/", async (req, res) => {
  const { status, classification } = req.query;
  const rows = await thesisRepo.findAll({ status, classification });
  console.log(
    `[Theses] GET / — filters: status=${status || "all"}, returned ${rows.length} theses`,
  );
  res.json(rows);
});

// GET single thesis
router.get("/:id", async (req, res) => {
  const thesis = await thesisRepo.findById(req.params.id);
  if (!thesis) {
    console.log(`[Theses] GET /${req.params.id} — NOT FOUND`);
    return res.status(404).json({ error: "Thesis not found" });
  }
  console.log(`[Theses] GET /${req.params.id} — found: "${thesis.title}"`);
  res.json(thesis);
});

// POST create thesis
router.post("/", async (req, res) => {
  const id = uuidv4();
  const t = req.body;

  console.log(`[Theses] POST / — title="${t?.title}", status="${t?.status}"`);

  if (!t || !t.title || !t.thesis_statement) {
    console.log(
      "[Theses] POST / — REJECTED: missing title or thesis_statement",
    );
    return res
      .status(400)
      .json({ error: "Title and thesis statement are required." });
  }

  // Draft theses skip behavioral gates — rigor is enforced at classification upgrade
  const isDraft = (t.status || "draft") === "draft";

  if (!isDraft) {
    if (
      !t.disconfirming_evidence ||
      !t.strongest_bear_case ||
      !t.what_would_make_opposite_stronger
    ) {
      return res.status(400).json({
        error:
          "BEHAVIORAL GATE: You must provide disconfirming evidence, the strongest bear case, and what would make the opposite case stronger. No shortcuts.",
      });
    }
    if (t.probability_best <= 0 || t.probability_best >= 1) {
      return res.status(400).json({
        error:
          "BEHAVIORAL GATE: Probability must be between 0 and 1 exclusive. Certainty language is not allowed.",
      });
    }
  }

  try {
    const created = await thesisRepo.create(id, t);
    if (!created) {
      console.error(
        `[Theses] POST / — INSERT succeeded but SELECT returned null for id=${id}`,
      );
      return res
        .status(500)
        .json({
          error: "Thesis was not saved — database write failed silently.",
        });
    }
    console.log(`[Theses] POST / — CREATED id=${id}`);
    res.status(201).json(created);
  } catch (err) {
    console.error(`[Theses] POST / — DB INSERT FAILED: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// PUT update thesis
router.put("/:id", async (req, res) => {
  try {
    // Fetch previous state for change detection
    const previous = await thesisRepo.findById(req.params.id);
    if (!previous) return res.status(404).json({ error: "Thesis not found" });

    const updated = await thesisRepo.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Thesis not found" });

    // Log classification and status changes to decision_log (non-blocking)
    const userId = req.body.user_id || "default";
    try {
      if (req.body.classification && req.body.classification !== previous.classification) {
        await logDecision({
          thesisId: req.params.id,
          action: "classification_change",
          fromValue: previous.classification,
          toValue: req.body.classification,
          reason: req.body.classification_reason || "No reason provided",
        }, userId);
      }
      if (req.body.status && req.body.status !== previous.status) {
        await logDecision({
          thesisId: req.params.id,
          action: "status_change",
          fromValue: previous.status,
          toValue: req.body.status,
          reason: req.body.status_reason || "No reason provided",
        }, userId);
      }
    } catch (logErr) {
      console.warn(`[Theses] Decision logging failed (non-fatal): ${logErr.message}`);
    }

    res.json(updated);
  } catch (err) {
    console.error(
      `[Theses] PUT /${req.params.id} — DB UPDATE FAILED: ${err.message}`,
    );
    return res.status(500).json({ error: err.message });
  }
});

// DELETE thesis
router.delete("/:id", async (req, res) => {
  await thesisRepo.remove(req.params.id);
  res.json({ deleted: true });
});

export default router;
