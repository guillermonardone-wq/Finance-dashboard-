import { useEffect, useState, useCallback } from 'react';
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

  // Auto-evaluate when thesis or signals change
  useEffect(() => {
    if (thesis) {
      const result = evaluateThesis(thesis, signals);
      setEvaluation(result);
    }
  }, [thesis, signals, evaluateThesis]);

  // Update a single factor score and persist
  const handleScoreUpdate = useCallback(async (dimension, value) => {
    const scoreField = `score_${dimension}`;
    await updateThesis(thesisId, { [scoreField]: value });
  }, [thesisId, updateThesis]);

  // Re-run full evaluation and persist all computed scores
  const handleReScore = useCallback(() => {
    if (!thesis) return;

    const result = evaluateThesis(thesis, signals);
    setEvaluation(result);

    updateThesis(thesisId, {
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
  }, [thesis, signals, thesisId, evaluateThesis, updateThesis]);

  return { evaluation, handleScoreUpdate, handleReScore };
}
