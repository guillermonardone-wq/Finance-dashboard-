import { Router } from "express";
import { runPipeline, runFullScan } from "../bot/pipeline.js";
import { getDb } from "../db/connection.js";

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
router.post("/scan", (req, res) => {
  try {
    const result = runFullScan();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent pipeline runs
router.get("/runs", (req, res) => {
  try {
    const db = getDb();
    // Ensure table exists
    db.exec(`CREATE TABLE IF NOT EXISTS bot_pipeline_runs (
      id TEXT PRIMARY KEY, run_at TEXT NOT NULL, duration_ms INTEGER,
      status TEXT NOT NULL, summary TEXT, full_result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const limit = parseInt(req.query.limit) || 20;
    const runs = db
      .prepare(
        "SELECT id, run_at, duration_ms, status, summary FROM bot_pipeline_runs ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit);
    res.json(
      runs.map((r) => {
        try {
          r.summary = JSON.parse(r.summary);
        } catch {}
        return r;
      }),
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single pipeline run (full result)
router.get("/runs/:id", (req, res) => {
  try {
    const db = getDb();
    const run = db
      .prepare("SELECT * FROM bot_pipeline_runs WHERE id = ?")
      .get(req.params.id);
    if (!run) return res.status(404).json({ error: "Run not found" });
    try {
      run.summary = JSON.parse(run.summary);
    } catch {}
    try {
      run.full_result = JSON.parse(run.full_result);
    } catch {}
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent bot recommendations
router.get("/recommendations", (req, res) => {
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS bot_recommendations (
      id TEXT PRIMARY KEY, pipeline_run_id TEXT NOT NULL, cluster_id TEXT NOT NULL,
      cluster_title TEXT, recommended_state TEXT NOT NULL, confidence_best REAL,
      rationale TEXT, why_not_higher TEXT, penalties_count INTEGER,
      overrides_count INTEGER, pattern_match_name TEXT, mispricing_state TEXT,
      counter_case_quality REAL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const { state, limit } = req.query;
    let sql = "SELECT * FROM bot_recommendations WHERE 1=1";
    const params = [];
    if (state) {
      sql += " AND recommended_state = ?";
      params.push(state);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    params.push(parseInt(limit) || 50);
    const recs = db.prepare(sql).all(...params);
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET escalations only
router.get("/escalations", (req, res) => {
  try {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS bot_recommendations (
      id TEXT PRIMARY KEY, pipeline_run_id TEXT NOT NULL, cluster_id TEXT NOT NULL,
      cluster_title TEXT, recommended_state TEXT NOT NULL, confidence_best REAL,
      rationale TEXT, why_not_higher TEXT, penalties_count INTEGER,
      overrides_count INTEGER, pattern_match_name TEXT, mispricing_state TEXT,
      counter_case_quality REAL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const recs = db
      .prepare(
        "SELECT * FROM bot_recommendations WHERE recommended_state IN ('ESCALATE', 'DEVELOP_THESIS') ORDER BY created_at DESC LIMIT 20",
      )
      .all();
    res.json(recs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
