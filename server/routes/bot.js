import { Router } from "express";
import { runPipeline, runFullScan } from "../bot/pipeline.js";
import { getKnex } from "../db/connection.js";

const router = Router();

// POST run pipeline on provided inputs
router.post("/run", (req, res) => {
  try {
    const { inputs, options } = req.body;
    if (!inputs || !Array.isArray(inputs)) {
      return res
        .status(400)
        .json({ error: "inputs must be an array of { type, data } objects" });
    }
    const result = runPipeline(inputs, options || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST run full scan on all current data
router.post("/scan", async (req, res) => {
  try {
    const result = await runFullScan();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent pipeline runs
router.get("/runs", async (req, res) => {
  try {
    const knex = getKnex();
    const limit = parseInt(req.query.limit) || 20;
    const runs = await knex("bot_pipeline_runs")
      .select("id", "run_at", "duration_ms", "status", "summary")
      .orderBy("created_at", "desc")
      .limit(limit);
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single pipeline run (full result)
router.get("/runs/:id", async (req, res) => {
  try {
    const knex = getKnex();
    const run = await knex("bot_pipeline_runs").where("id", req.params.id).first();
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent bot recommendations
router.get("/recommendations", async (req, res) => {
  try {
    const knex = getKnex();
    const { state, limit } = req.query;
    let query = knex("bot_recommendations");
    if (state) query = query.where("recommended_state", state);
    const recs = await query
      .orderBy("created_at", "desc")
      .limit(parseInt(limit) || 50);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET escalations only
router.get("/escalations", async (req, res) => {
  try {
    const knex = getKnex();
    const recs = await knex("bot_recommendations")
      .whereIn("recommended_state", ["ESCALATE", "DEVELOP_THESIS"])
      .orderBy("created_at", "desc")
      .limit(20);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
