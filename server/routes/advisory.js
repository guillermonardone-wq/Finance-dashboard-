import { Router } from "express";
import {
  runAdvisoryEvaluation,
  getLatestAssessment,
  getAssessmentHistory,
} from "../services/advisory.js";
import { buildThesisPacket } from "../services/thesis-packet.js";

const router = Router();

// POST — Run LLM advisory evaluation (manual trigger)
router.post("/thesis/:thesisId/evaluate", async (req, res) => {
  const { thesisId } = req.params;
  const { provider, model } = req.body || {};

  console.log(
    `[Advisory] POST /thesis/${thesisId}/evaluate — provider: ${provider || "default"}`,
  );

  try {
    const assessment = await runAdvisoryEvaluation(thesisId, {
      provider,
      model,
    });
    res.json(assessment);
  } catch (err) {
    console.error(`[Advisory] Evaluation failed: ${err.message}`);
    res.status(500).json({
      error: err.message,
      hint: err.message.includes("API_KEY")
        ? "Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env, and optionally LLM_PROVIDER and LLM_MODEL."
        : undefined,
    });
  }
});

// GET — Latest completed assessment for a thesis
router.get("/thesis/:thesisId/latest", async (req, res) => {
  const assessment = await getLatestAssessment(req.params.thesisId);
  if (!assessment) {
    return res.json(null);
  }
  res.json(assessment);
});

// GET — Full assessment history for a thesis
router.get("/thesis/:thesisId/history", async (req, res) => {
  const history = await getAssessmentHistory(req.params.thesisId);
  res.json(history);
});

// GET — Preview thesis packet (for debugging / prompt iteration)
router.get("/thesis/:thesisId/packet", async (req, res) => {
  try {
    const packet = await buildThesisPacket(req.params.thesisId);
    res.json(packet);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
