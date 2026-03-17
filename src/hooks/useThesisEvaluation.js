import { useEffect, useState, useCallback, useRef } from 'react';
import { useThesisStore } from '../store/useThesisStore';

/**
 * Encapsulates thesis evaluation lifecycle:
 * - Runs evaluation when thesis or signals change
 * - Handles manual score updates with persistence
 * - Handles re-scoring with persistence
 *
 * Returns { evaluation, handleScoreUpdate, handleReScore }
 */
export function useThesisEvaluation(thesisId, thesis, signals) {
  const { evaluateThesis, updateThesis } = useThesisStore();
  const [evaluation, setEvaluation] = useState(null);

  // Track whether a re-score persistence is in flight so we can skip the
  // redundant auto-evaluate that fires when updateThesis updates activeThesis.
  const reScoreInFlight = useRef(false);

  // Clear evaluation when thesis ID changes (prevents stale scores from
  // a previous thesis being visible during loading)
  useEffect(() => {
    setEvaluation(null);
  }, [thesisId]);

  // Auto-evaluate when thesis or signals change
  useEffect(() => {
    if (!thesis) return;
    // Skip if a re-score just persisted — the re-score already set evaluation
    if (reScoreInFlight.current) {
      reScoreInFlight.current = false;
      return;
    }
    const result = evaluateThesis(thesis, signals);
    setEvaluation(result);
  }, [thesis, signals, evaluateThesis]);

  // Update a single factor score and persist
  const handleScoreUpdate = useCallback(async (dimension, value) => {
    const scoreField = `score_${dimension}`;
    await updateThesis(thesisId, { [scoreField]: value });
  }, [thesisId, updateThesis]);

  // Re-run full evaluation and persist all computed scores
  const handleReScore = useCallback(async () => {
    if (!thesis) return;

    const result = evaluateThesis(thesis, signals);
    setEvaluation(result);

    // Mark in-flight so the auto-evaluate triggered by updateThesis is skipped
    reScoreInFlight.current = true;

    try {
      await updateThesis(thesisId, {
        composite_score: result.scoreResult.composite,
        score_evidence_layer: result.layers.evidence.score,
        score_structure_layer: result.layers.structure.score,
        score_market_edge_layer: result.layers.market_edge.score,
        penalty_total: result.penalties.total,
        penalty_details: result.penalties.applied,
        confidence_level: result.confidence.level,
        confidence_factors: result.confidence.factors,
        classification: result.classification.classification,
        classification_reason: result.classification.downgrades.length > 0
          ? result.classification.downgrades.map(d => d.reason).join('; ')
          : `Score: ${result.scoreResult.composite}`,
      });
    } catch (err) {
      // Persistence failed — clear the flag so next auto-evaluate runs normally
      reScoreInFlight.current = false;
      console.error('[useThesisEvaluation] Re-score persistence failed:', err.message);
    }
  }, [thesis, signals, thesisId, evaluateThesis, updateThesis]);

  return { evaluation, handleScoreUpdate, handleReScore };
}
