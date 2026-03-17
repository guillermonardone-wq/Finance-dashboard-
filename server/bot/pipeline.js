// ============================================================
// BOT PIPELINE — Orchestrates the 6-agent analysis workflow
// ============================================================
// Pipeline flow:
//   1. Scout: raw inputs → CandidateSignals
//   2. Clusterer: CandidateSignals → SignalClusters
//   3. Pattern Matcher: each cluster → PatternMatch
//   4. Mispricing Checker: each cluster → MispricingAssessment
//   5. Red-Team: each cluster → CounterCase
//   6. Governor: all inputs → BotRecommendation
//
// The pipeline produces a complete analysis per cluster,
// preserving all intermediate outputs for audit.
// ============================================================

import { scoutSignals } from "./scout.js";
import { clusterSignals } from "./clusterer.js";
import { matchPatterns } from "./pattern-matcher.js";
import { assessMispricing } from "./mispricing.js";
import { generateCounterCase } from "./red-team.js";
import { runGovernor, explainGovernorDecision } from "./governor.js";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";

/**
 * Run the full bot pipeline on a set of raw inputs.
 *
 * @param {Array} rawInputs - Array of { type: 'signal'|'news'|'market_observation', data: {...} }
 * @param {Object} options - { marketObservations: [], clusteringOptions: {} }
 * @returns {Object} Full pipeline result with all intermediate outputs
 */
export function runPipeline(rawInputs, options = {}) {
  const pipelineId = uuidv4();
  const startTime = Date.now();
  const auditLog = [];

  // ---- STAGE 1: SCOUT ----
  auditLog.push({
    stage: "scout",
    timestamp: new Date().toISOString(),
    status: "running",
  });
  const scoutResult = scoutSignals(rawInputs);
  auditLog.push({
    stage: "scout",
    timestamp: new Date().toISOString(),
    status: "complete",
    summary: `${scoutResult.candidates.length} candidates from ${scoutResult.total_processed} inputs, ${scoutResult.duplicates_removed} duplicates removed`,
  });

  if (scoutResult.candidates.length === 0) {
    return {
      pipeline_id: pipelineId,
      status: "empty",
      message: "No candidate signals detected from inputs.",
      candidates: [],
      clusters: [],
      analyses: [],
      audit_log: auditLog,
      duration_ms: Date.now() - startTime,
    };
  }

  // ---- STAGE 2: CLUSTER ----
  auditLog.push({
    stage: "clusterer",
    timestamp: new Date().toISOString(),
    status: "running",
  });
  const clusters = clusterSignals(
    scoutResult.candidates,
    options.clusteringOptions,
  );
  auditLog.push({
    stage: "clusterer",
    timestamp: new Date().toISOString(),
    status: "complete",
    summary: `${clusters.length} clusters formed from ${scoutResult.candidates.length} candidates`,
  });

  // ---- STAGES 3-6: Per-cluster analysis ----
  const analyses = [];

  for (const cluster of clusters) {
    const clusterCandidates = scoutResult.candidates.filter((c) =>
      cluster.member_signal_ids.includes(c.id),
    );

    auditLog.push({
      stage: "analysis",
      timestamp: new Date().toISOString(),
      status: "running",
      cluster_id: cluster.id,
      cluster_title: cluster.title,
    });

    // Stage 3: Pattern Match
    const patternMatch = matchPatterns(cluster);

    // Stage 4: Mispricing Assessment
    const mispricingAssessment = assessMispricing(cluster, {
      marketObservations: options.marketObservations || [],
    });

    // Stage 5: Red-Team Counter Case
    const counterCase = generateCounterCase(
      cluster,
      patternMatch,
      mispricingAssessment,
    );

    // Stage 6: Governor Routing
    const recommendation = runGovernor({
      cluster,
      candidateSignals: clusterCandidates,
      patternMatch,
      mispricingAssessment,
      counterCase,
    });

    const explanation = explainGovernorDecision(recommendation);

    analyses.push({
      cluster,
      candidates: clusterCandidates,
      pattern_match: patternMatch,
      mispricing_assessment: mispricingAssessment,
      counter_case: counterCase,
      recommendation,
      explanation,
    });

    auditLog.push({
      stage: "analysis",
      timestamp: new Date().toISOString(),
      status: "complete",
      cluster_id: cluster.id,
      recommended_state: recommendation.recommended_state,
      penalties: (recommendation.penalties_applied || []).length,
      overrides: (recommendation.governor_overrides || []).length,
    });
  }

  // Sort analyses: escalations first, then by recommended state priority
  const statePriority = {
    ESCALATE: 0,
    DEVELOP_THESIS: 1,
    QUARANTINE: 2,
    WATCH: 3,
    LOG_ONLY: 4,
    IGNORE: 5,
  };
  analyses.sort(
    (a, b) =>
      (statePriority[a.recommendation.recommended_state] ?? 9) -
      (statePriority[b.recommendation.recommended_state] ?? 9),
  );

  const result = {
    pipeline_id: pipelineId,
    status: "complete",
    run_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    summary: {
      total_inputs: rawInputs.length,
      candidates_detected: scoutResult.candidates.length,
      duplicates_removed: scoutResult.duplicates_removed,
      clusters_formed: clusters.length,
      escalations: analyses.filter(
        (a) => a.recommendation.recommended_state === "ESCALATE",
      ).length,
      develop_thesis: analyses.filter(
        (a) => a.recommendation.recommended_state === "DEVELOP_THESIS",
      ).length,
      quarantined: analyses.filter(
        (a) => a.recommendation.recommended_state === "QUARANTINE",
      ).length,
      watch: analyses.filter(
        (a) => a.recommendation.recommended_state === "WATCH",
      ).length,
      log_only: analyses.filter(
        (a) => a.recommendation.recommended_state === "LOG_ONLY",
      ).length,
      ignored: analyses.filter(
        (a) => a.recommendation.recommended_state === "IGNORE",
      ).length,
    },
    candidates: scoutResult.candidates,
    clusters,
    analyses,
    audit_log: auditLog,
  };

  // Persist to audit log
  persistPipelineRun(result);

  return result;
}

/**
 * Run the pipeline on all current inbox signals + recent market observations.
 * This is the "scan everything" entry point.
 */
export function runFullScan() {
  try {
    const db = getDb();

    // Gather inbox and reviewing signals
    const signals = db
      .prepare(
        "SELECT * FROM signals WHERE status IN ('inbox', 'reviewing', 'linked') ORDER BY created_at DESC LIMIT 100",
      )
      .all();

    // Gather recent market observations (news type)
    const newsObs = db
      .prepare(
        "SELECT * FROM market_observations WHERE observation_type = 'news' AND created_at > datetime('now', '-48 hours') ORDER BY created_at DESC LIMIT 50",
      )
      .all();

    // Gather all market observations for mispricing checks
    const allMarketObs = db
      .prepare(
        "SELECT * FROM market_observations WHERE observation_type IN ('price', 'candle', 'volatility', 'sentiment') AND created_at > datetime('now', '-48 hours') ORDER BY created_at DESC LIMIT 50",
      )
      .all();

    // Build raw inputs
    const rawInputs = [
      ...signals.map((s) => ({ type: "signal", data: parseJsonFields(s) })),
      ...newsObs.map((o) => ({
        type: "market_observation",
        data: parseJsonFields(o),
      })),
    ];

    return runPipeline(rawInputs, {
      marketObservations: allMarketObs.map((o) => parseJsonFields(o)),
    });
  } catch (err) {
    return {
      pipeline_id: uuidv4(),
      status: "error",
      error: err.message,
      candidates: [],
      clusters: [],
      analyses: [],
      audit_log: [{ stage: "full_scan", status: "error", error: err.message }],
    };
  }
}

function persistPipelineRun(result) {
  try {
    const db = getDb();
    // Ensure bot_pipeline_runs table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_pipeline_runs (
        id TEXT PRIMARY KEY,
        run_at TEXT NOT NULL,
        duration_ms INTEGER,
        status TEXT NOT NULL,
        summary TEXT,
        full_result TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_recommendations (
        id TEXT PRIMARY KEY,
        pipeline_run_id TEXT NOT NULL,
        cluster_id TEXT NOT NULL,
        cluster_title TEXT,
        recommended_state TEXT NOT NULL,
        confidence_best REAL,
        rationale TEXT,
        why_not_higher TEXT,
        penalties_count INTEGER,
        overrides_count INTEGER,
        pattern_match_name TEXT,
        mispricing_state TEXT,
        counter_case_quality REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.prepare(
      `
      INSERT INTO bot_pipeline_runs (id, run_at, duration_ms, status, summary, full_result)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      result.pipeline_id,
      result.run_at || new Date().toISOString(),
      result.duration_ms || 0,
      result.status,
      JSON.stringify(result.summary || {}),
      JSON.stringify(result),
    );

    for (const analysis of result.analyses || []) {
      const rec = analysis.recommendation;
      db.prepare(
        `
        INSERT INTO bot_recommendations (
          id, pipeline_run_id, cluster_id, cluster_title, recommended_state,
          confidence_best, rationale, why_not_higher, penalties_count, overrides_count,
          pattern_match_name, mispricing_state, counter_case_quality
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        rec.id,
        result.pipeline_id,
        rec.cluster_id,
        analysis.cluster?.title || "",
        rec.recommended_state,
        rec.confidence_range?.best || null,
        rec.rationale,
        rec.why_not_higher,
        (rec.penalties_applied || []).length,
        (rec.governor_overrides || []).length,
        analysis.pattern_match?.pattern_name || null,
        analysis.mispricing_assessment?.market_reaction_state || null,
        analysis.counter_case?.reasoning_quality_score || null,
      );
    }
  } catch {
    // Don't fail pipeline on persistence errors
  }
}

function parseJsonFields(row) {
  if (!row) return row;
  const parsed = { ...row };
  for (const key of Object.keys(parsed)) {
    if (
      typeof parsed[key] === "string" &&
      (parsed[key].startsWith("{") || parsed[key].startsWith("["))
    ) {
      try {
        parsed[key] = JSON.parse(parsed[key]);
      } catch {}
    }
  }
  return parsed;
}
