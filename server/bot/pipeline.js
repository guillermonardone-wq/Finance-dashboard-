// ============================================================
// BOT PIPELINE — Orchestrates the 6-agent analysis workflow
// ============================================================

import { scoutSignals } from "./scout.js";
import { clusterSignals } from "./clusterer.js";
import { matchPatterns } from "./pattern-matcher.js";
import { assessMispricing } from "./mispricing.js";
import { generateCounterCase } from "./red-team.js";
import { runGovernor, explainGovernorDecision } from "./governor.js";
import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";

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

    const patternMatch = matchPatterns(cluster);
    const mispricingAssessment = assessMispricing(cluster, {
      marketObservations: options.marketObservations || [],
    });
    const counterCase = generateCounterCase(
      cluster,
      patternMatch,
      mispricingAssessment,
    );
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

  // Persist (fire-and-forget)
  persistPipelineRun(result).catch(() => {});

  return result;
}

export async function runFullScan() {
  try {
    const knex = getKnex();

    const signals = await knex("signals")
      .whereIn("status", ["inbox", "reviewing", "linked"])
      .orderBy("created_at", "desc")
      .limit(100);

    const newsObs = await knex("market_observations")
      .where("observation_type", "news")
      .where("created_at", ">", knex.raw("now() - interval '48 hours'"))
      .orderBy("created_at", "desc")
      .limit(50);

    const allMarketObs = await knex("market_observations")
      .whereIn("observation_type", ["price", "candle", "volatility", "sentiment"])
      .where("created_at", ">", knex.raw("now() - interval '48 hours'"))
      .orderBy("created_at", "desc")
      .limit(50);

    const rawInputs = [
      ...signals.map((s) => ({ type: "signal", data: s })),
      ...newsObs.map((o) => ({ type: "market_observation", data: o })),
    ];

    return runPipeline(rawInputs, {
      marketObservations: allMarketObs,
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

async function persistPipelineRun(result) {
  try {
    const knex = getKnex();

    await knex("bot_pipeline_runs").insert({
      id: result.pipeline_id,
      run_at: result.run_at || new Date().toISOString(),
      duration_ms: result.duration_ms || 0,
      status: result.status,
      summary: result.summary || {},
      full_result: result,
    });

    for (const analysis of result.analyses || []) {
      const rec = analysis.recommendation;
      await knex("bot_recommendations").insert({
        id: rec.id,
        pipeline_run_id: result.pipeline_id,
        cluster_id: rec.cluster_id,
        cluster_title: analysis.cluster?.title || "",
        recommended_state: rec.recommended_state,
        confidence_best: rec.confidence_range?.best || null,
        rationale: rec.rationale,
        why_not_higher: rec.why_not_higher,
        penalties_count: (rec.penalties_applied || []).length,
        overrides_count: (rec.governor_overrides || []).length,
        pattern_match_name: analysis.pattern_match?.pattern_name || null,
        mispricing_state: analysis.mispricing_assessment?.market_reaction_state || null,
        counter_case_quality: analysis.counter_case?.reasoning_quality_score || null,
      });
    }
  } catch {
    // Don't fail pipeline on persistence errors
  }
}
