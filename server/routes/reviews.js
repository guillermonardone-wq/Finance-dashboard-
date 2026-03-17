import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";

const router = Router();

// GET all reviews
router.get("/", async (req, res) => {
  const knex = getKnex();
  const { thesis_id } = req.query;
  let query = knex("reviews");
  if (thesis_id) query = query.where("thesis_id", thesis_id);
  const rows = await query.orderBy("created_at", "desc");
  res.json(rows);
});

// GET single review
router.get("/:id", async (req, res) => {
  const knex = getKnex();
  const row = await knex("reviews").where("id", req.params.id).first();
  if (!row) return res.status(404).json({ error: "Review not found" });
  res.json(row);
});

// POST create review
router.post("/", async (req, res) => {
  const knex = getKnex();
  const id = uuidv4();
  const now = new Date().toISOString();
  const r = req.body;

  // Force process honesty
  if (r.process_followed === undefined || r.process_followed === null) {
    return res.status(400).json({
      error:
        "REVIEW GATE: You must explicitly answer whether process was followed. Honest post-mortems are mandatory.",
    });
  }
  if (!r.lessons_learned || r.lessons_learned.trim().length < 20) {
    return res.status(400).json({
      error:
        "REVIEW GATE: Lessons learned must be substantive (>20 chars). Shallow reviews defeat the purpose.",
    });
  }

  await knex("reviews").insert({
    id,
    thesis_id: r.thesis_id,
    trade_id: r.trade_id || null,
    created_at: now,
    outcome: r.outcome,
    outcome_description: r.outcome_description,
    signals_that_mattered: r.signals_that_mattered || [],
    signals_that_were_noise: r.signals_that_were_noise || [],
    signals_missed: r.signals_missed || [],
    process_followed: !!r.process_followed,
    process_violations: r.process_violations || [],
    sizing_appropriate: r.sizing_appropriate != null ? !!r.sizing_appropriate : null,
    timing_appropriate: r.timing_appropriate != null ? !!r.timing_appropriate : null,
    early_confirmation_accurate: r.early_confirmation_accurate != null ? !!r.early_confirmation_accurate : null,
    emotional_state_during: r.emotional_state_during || null,
    overconfidence_detected: !!r.overconfidence_detected,
    narrative_attachment_detected: !!r.narrative_attachment_detected,
    confirmation_bias_detected: !!r.confirmation_bias_detected,
    lessons_learned: r.lessons_learned,
    playbook_additions: r.playbook_additions || [],
    rule_changes: r.rule_changes || [],
    process_score: r.process_score,
    analysis_score: r.analysis_score,
    execution_score: r.execution_score,
    overall_score: r.overall_score,
  });

  const created = await knex("reviews").where("id", id).first();
  res.status(201).json(created);
});

export default router;
