// ============================================================
// LLM ADVISORY SERVICE — Provider-agnostic thesis evaluation
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getKnex } from "../db/connection.js";
import { buildThesisPacket } from "./thesis-packet.js";
import {
  ADVISORY_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserPrompt,
} from "./advisory-prompt.js";
import config from "../config.js";

// --- LLM PROVIDER ADAPTERS ---

async function callAnthropic(systemPrompt, userPrompt, model) {
  const apiKey = config.llm.anthropicKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in environment");

  const startTime = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;

  return {
    content: data.content?.[0]?.text || "",
    promptTokens: data.usage?.input_tokens,
    completionTokens: data.usage?.output_tokens,
    latencyMs,
    raw: data,
  };
}

async function callOpenAI(systemPrompt, userPrompt, model) {
  const apiKey = config.llm.openaiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set in environment");

  const startTime = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const latencyMs = Date.now() - startTime;

  return {
    content: data.choices?.[0]?.message?.content || "",
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
    latencyMs,
    raw: data,
  };
}

const PROVIDERS = {
  anthropic: callAnthropic,
  openai: callOpenAI,
};

// --- RESPONSE PARSING ---

function parseAdvisoryResponse(content) {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  const required = [
    "evidence_strength",
    "signal_independence",
    "structural_logic",
    "timing_clarity",
    "market_edge",
    "counter_case_robustness",
    "overall_score",
    "confidence_level",
    "strongest_counter_case",
    "hidden_assumptions",
    "key_missing_information",
    "top_supporting_signals",
    "top_concerns",
    "recommendation",
  ];

  for (const field of required) {
    if (parsed[field] === undefined) {
      throw new Error(`LLM response missing required field: ${field}`);
    }
  }

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  parsed.evidence_strength = clamp(parsed.evidence_strength, 0, 10);
  parsed.signal_independence = clamp(parsed.signal_independence, 0, 10);
  parsed.structural_logic = clamp(parsed.structural_logic, 0, 10);
  parsed.timing_clarity = clamp(parsed.timing_clarity, 0, 10);
  parsed.market_edge = clamp(parsed.market_edge, 0, 10);
  parsed.counter_case_robustness = clamp(parsed.counter_case_robustness, 0, 10);
  parsed.overall_score = clamp(parsed.overall_score, 0, 100);
  parsed.confidence_level = clamp(parsed.confidence_level, 0, 1);

  if (!Array.isArray(parsed.hidden_assumptions)) parsed.hidden_assumptions = [];
  if (!Array.isArray(parsed.key_missing_information))
    parsed.key_missing_information = [];
  if (!Array.isArray(parsed.top_supporting_signals))
    parsed.top_supporting_signals = [];
  if (!Array.isArray(parsed.top_concerns)) parsed.top_concerns = [];

  return parsed;
}

// --- COMPARISON LOGIC ---

function computeComparison(llmScores, deterministicScores) {
  const detComposite = deterministicScores.composite_score;
  const llmComposite = llmScores.overall_score;

  if (detComposite == null) {
    return {
      delta: null,
      summary:
        "Deterministic engine has not scored this thesis yet. No comparison available.",
    };
  }

  const delta = Math.round((llmComposite - detComposite) * 100) / 100;
  const absDelta = Math.abs(delta);

  const dimensionMap = {
    evidence_strength: "evidence_layer",
    signal_independence: "signal_independence",
    structural_logic: "structure_layer",
    timing_clarity: "timing_clarity",
    market_edge: "market_edge_layer",
    counter_case_robustness: "counter_case_robustness",
  };

  const disagreements = [];
  for (const [llmKey, detKey] of Object.entries(dimensionMap)) {
    const llmVal = llmScores[llmKey];
    const detVal = deterministicScores[detKey];
    if (llmVal != null && detVal != null) {
      const dimDelta = llmVal - detVal;
      if (Math.abs(dimDelta) >= 2) {
        disagreements.push({
          dimension: llmKey,
          llm: llmVal,
          deterministic: detVal,
          delta: Math.round(dimDelta * 10) / 10,
          direction: dimDelta > 0 ? "LLM higher" : "LLM lower",
        });
      }
    }
  }

  let severity;
  if (absDelta <= 5) severity = "aligned";
  else if (absDelta <= 15) severity = "mild_disagreement";
  else if (absDelta <= 25) severity = "significant_disagreement";
  else severity = "strong_disagreement";

  const summaryParts = [];
  summaryParts.push(
    `Overall: LLM ${delta >= 0 ? "+" : ""}${delta} vs deterministic (${llmComposite} vs ${detComposite}).`,
  );

  if (disagreements.length > 0) {
    const biggest = disagreements.sort(
      (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
    )[0];
    summaryParts.push(
      `Biggest dimension gap: ${biggest.dimension} (${biggest.direction} by ${Math.abs(biggest.delta).toFixed(1)}).`,
    );
  }

  if (severity === "strong_disagreement") {
    summaryParts.push(
      "Strong disagreement — review both assessments carefully before acting.",
    );
  }

  return {
    delta,
    severity,
    disagreements,
    summary: summaryParts.join(" "),
  };
}

// --- MAIN EVALUATION FUNCTION ---

export async function runAdvisoryEvaluation(thesisId, options = {}) {
  const knex = getKnex();
  const provider = options.provider || config.llm.provider;
  const model = options.model || config.llm.model;

  const callLLM = PROVIDERS[provider];
  if (!callLLM)
    throw new Error(
      `Unsupported LLM provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(", ")}`,
    );

  console.log(`[Advisory] Building thesis packet for ${thesisId}...`);
  const packet = await buildThesisPacket(thesisId, { userId: options.userId || "default" });
  const userPrompt = buildUserPrompt(packet);

  const assessmentId = uuidv4();
  await knex("llm_thesis_assessments").insert({
    id: assessmentId,
    thesis_id: thesisId,
    model_provider: provider,
    model_name: model || "default",
    prompt_version: PROMPT_VERSION,
    thesis_packet_json: packet,
    raw_response_json: {},
    status: "running",
  });

  try {
    console.log(
      `[Advisory] Calling ${provider} (model: ${model || "default"})...`,
    );
    const llmResult = await callLLM(ADVISORY_SYSTEM_PROMPT, userPrompt, model);

    console.log(
      `[Advisory] Parsing response (${llmResult.latencyMs}ms, ${llmResult.completionTokens} tokens)...`,
    );
    const assessment = parseAdvisoryResponse(llmResult.content);

    const comparison = computeComparison(
      assessment,
      packet.deterministic_scores,
    );

    await knex("llm_thesis_assessments")
      .where("id", assessmentId)
      .update({
        model_name: model || "default",
        score_evidence_strength: assessment.evidence_strength,
        score_signal_independence: assessment.signal_independence,
        score_structural_logic: assessment.structural_logic,
        score_timing_clarity: assessment.timing_clarity,
        score_market_edge: assessment.market_edge,
        score_counter_case_robustness: assessment.counter_case_robustness,
        overall_score: assessment.overall_score,
        confidence_level: assessment.confidence_level,
        strongest_counter_case: assessment.strongest_counter_case,
        hidden_assumptions: assessment.hidden_assumptions,
        key_missing_information: assessment.key_missing_information,
        top_supporting_signals: assessment.top_supporting_signals,
        top_concerns: assessment.top_concerns,
        recommendation: assessment.recommendation,
        deterministic_score: packet.deterministic_scores.composite_score,
        score_delta: comparison.delta,
        disagreement_summary: comparison.summary,
        raw_response_json: llmResult.raw,
        prompt_tokens: llmResult.promptTokens,
        completion_tokens: llmResult.completionTokens,
        latency_ms: llmResult.latencyMs,
        status: "completed",
      });

    console.log(
      `[Advisory] Assessment ${assessmentId} completed. LLM: ${assessment.overall_score}/100, Det: ${packet.deterministic_scores.composite_score ?? "—"}, Delta: ${comparison.delta ?? "—"}`,
    );

    const stored = await knex("llm_thesis_assessments").where("id", assessmentId).first();
    return stored;
  } catch (err) {
    await knex("llm_thesis_assessments")
      .where("id", assessmentId)
      .update({ status: "failed", error_message: err.message });

    console.error(
      `[Advisory] Assessment ${assessmentId} FAILED: ${err.message}`,
    );
    throw err;
  }
}

export async function getLatestAssessment(thesisId) {
  const knex = getKnex();
  return knex("llm_thesis_assessments")
    .where({ thesis_id: thesisId, status: "completed" })
    .orderBy("created_at", "desc")
    .first() || null;
}

export async function getAssessmentHistory(thesisId) {
  const knex = getKnex();
  return knex("llm_thesis_assessments")
    .where("thesis_id", thesisId)
    .orderBy("created_at", "desc");
}
