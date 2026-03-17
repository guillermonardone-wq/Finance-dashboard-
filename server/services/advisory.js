// ============================================================
// LLM ADVISORY SERVICE — Provider-agnostic thesis evaluation
// ============================================================
// Supports Anthropic (Claude) and OpenAI as LLM providers.
// The service:
//   1. Builds a thesis packet (full context)
//   2. Sends it to the configured LLM
//   3. Parses the structured JSON response
//   4. Computes comparison against deterministic scores
//   5. Persists the assessment
//
// SAFEGUARDS:
//   - Cannot set trade state
//   - Cannot override gates
//   - Cannot modify thesis scores
//   - Output is strictly advisory and labeled as such
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import { buildThesisPacket } from "./thesis-packet.js";
import {
  ADVISORY_SYSTEM_PROMPT,
  PROMPT_VERSION,
  buildUserPrompt,
} from "./advisory-prompt.js";

// --- LLM PROVIDER ADAPTERS ---

async function callAnthropic(systemPrompt, userPrompt, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
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
  const apiKey = process.env.OPENAI_API_KEY;
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
  // Strip markdown code fences if present
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
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

  // Clamp scores to valid ranges
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  parsed.evidence_strength = clamp(parsed.evidence_strength, 0, 10);
  parsed.signal_independence = clamp(parsed.signal_independence, 0, 10);
  parsed.structural_logic = clamp(parsed.structural_logic, 0, 10);
  parsed.timing_clarity = clamp(parsed.timing_clarity, 0, 10);
  parsed.market_edge = clamp(parsed.market_edge, 0, 10);
  parsed.counter_case_robustness = clamp(parsed.counter_case_robustness, 0, 10);
  parsed.overall_score = clamp(parsed.overall_score, 0, 100);
  parsed.confidence_level = clamp(parsed.confidence_level, 0, 1);

  // Ensure arrays
  if (!Array.isArray(parsed.hidden_assumptions)) parsed.hidden_assumptions = [];
  if (!Array.isArray(parsed.key_missing_information))
    parsed.key_missing_information = [];
  if (!Array.isArray(parsed.top_supporting_signals))
    parsed.top_supporting_signals = [];
  if (!Array.isArray(parsed.top_concerns)) parsed.top_concerns = [];

  return parsed;
}

// --- COMPARISON LOGIC ---

/**
 * Compare LLM assessment against deterministic engine scores.
 * Returns structured disagreement analysis.
 */
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

  // Dimension-level comparison
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

/**
 * Run a full LLM advisory evaluation for a thesis.
 *
 * @param {string} thesisId
 * @param {Object} options - { provider, model }
 * @returns {Object} - the stored assessment record
 */
export async function runAdvisoryEvaluation(thesisId, options = {}) {
  const db = getDb();
  const provider = options.provider || process.env.LLM_PROVIDER || "anthropic";
  const model = options.model || process.env.LLM_MODEL || undefined;

  const callLLM = PROVIDERS[provider];
  if (!callLLM)
    throw new Error(
      `Unsupported LLM provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(", ")}`,
    );

  // Step 1: Build thesis packet
  console.log(`[Advisory] Building thesis packet for ${thesisId}...`);
  const packet = buildThesisPacket(thesisId);
  const userPrompt = buildUserPrompt(packet);

  // Step 2: Create pending assessment record
  const assessmentId = uuidv4();
  db.prepare(
    `
    INSERT INTO llm_thesis_assessments (id, thesis_id, model_provider, model_name, prompt_version, thesis_packet_json, raw_response_json, status)
    VALUES (?, ?, ?, ?, ?, ?, '{}', 'running')
  `,
  ).run(
    assessmentId,
    thesisId,
    provider,
    model || "default",
    PROMPT_VERSION,
    JSON.stringify(packet),
  );

  try {
    // Step 3: Call LLM
    console.log(
      `[Advisory] Calling ${provider} (model: ${model || "default"})...`,
    );
    const llmResult = await callLLM(ADVISORY_SYSTEM_PROMPT, userPrompt, model);

    // Step 4: Parse response
    console.log(
      `[Advisory] Parsing response (${llmResult.latencyMs}ms, ${llmResult.completionTokens} tokens)...`,
    );
    const assessment = parseAdvisoryResponse(llmResult.content);

    // Step 5: Compute comparison
    const comparison = computeComparison(
      assessment,
      packet.deterministic_scores,
    );

    // Step 6: Persist
    db.prepare(
      `
      UPDATE llm_thesis_assessments SET
        model_name = ?,
        score_evidence_strength = ?, score_signal_independence = ?,
        score_structural_logic = ?, score_timing_clarity = ?,
        score_market_edge = ?, score_counter_case_robustness = ?,
        overall_score = ?, confidence_level = ?,
        strongest_counter_case = ?, hidden_assumptions = ?,
        key_missing_information = ?, top_supporting_signals = ?,
        top_concerns = ?, recommendation = ?,
        deterministic_score = ?, score_delta = ?, disagreement_summary = ?,
        raw_response_json = ?, prompt_tokens = ?, completion_tokens = ?, latency_ms = ?,
        status = 'completed'
      WHERE id = ?
    `,
    ).run(
      model || "default",
      assessment.evidence_strength,
      assessment.signal_independence,
      assessment.structural_logic,
      assessment.timing_clarity,
      assessment.market_edge,
      assessment.counter_case_robustness,
      assessment.overall_score,
      assessment.confidence_level,
      assessment.strongest_counter_case,
      JSON.stringify(assessment.hidden_assumptions),
      JSON.stringify(assessment.key_missing_information),
      JSON.stringify(assessment.top_supporting_signals),
      JSON.stringify(assessment.top_concerns),
      assessment.recommendation,
      packet.deterministic_scores.composite_score,
      comparison.delta,
      comparison.summary,
      JSON.stringify(llmResult.raw),
      llmResult.promptTokens,
      llmResult.completionTokens,
      llmResult.latencyMs,
      assessmentId,
    );

    console.log(
      `[Advisory] Assessment ${assessmentId} completed. LLM: ${assessment.overall_score}/100, Det: ${packet.deterministic_scores.composite_score ?? "—"}, Delta: ${comparison.delta ?? "—"}`,
    );

    // Return the full record
    const stored = db
      .prepare("SELECT * FROM llm_thesis_assessments WHERE id = ?")
      .get(assessmentId);
    return parseAssessmentRow(stored);
  } catch (err) {
    // Mark as failed
    db.prepare(
      "UPDATE llm_thesis_assessments SET status = 'failed', error_message = ? WHERE id = ?",
    ).run(err.message, assessmentId);

    console.error(
      `[Advisory] Assessment ${assessmentId} FAILED: ${err.message}`,
    );
    throw err;
  }
}

/**
 * Get the latest advisory assessment for a thesis.
 */
export function getLatestAssessment(thesisId) {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT * FROM llm_thesis_assessments WHERE thesis_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1",
    )
    .get(thesisId);
  return row ? parseAssessmentRow(row) : null;
}

/**
 * Get all advisory assessments for a thesis (history).
 */
export function getAssessmentHistory(thesisId) {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM llm_thesis_assessments WHERE thesis_id = ? ORDER BY created_at DESC",
    )
    .all(thesisId);
  return rows.map(parseAssessmentRow);
}

function parseAssessmentRow(row) {
  if (!row) return null;
  const jsonFields = [
    "hidden_assumptions",
    "key_missing_information",
    "top_supporting_signals",
    "top_concerns",
    "thesis_packet_json",
    "raw_response_json",
  ];
  const parsed = { ...row };
  for (const field of jsonFields) {
    if (parsed[field] && typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        /* leave as string */
      }
    }
  }
  return parsed;
}
