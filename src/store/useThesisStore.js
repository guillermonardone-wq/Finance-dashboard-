import { create } from 'zustand';
import { api } from '../lib/api';
import {
  computeCompositeScore, computePenalties, autoScoreThesis,
  estimateConfidence, ALL_FACTOR_KEYS,
} from '../engine/scoring';
import { runGates } from '../engine/gates';
import { classifyThesis } from '../engine/classification';

export const useThesisStore = create((set, get) => ({
  theses: [],
  activeThesis: null,
  loading: false,
  error: null,

  fetchTheses: async (params) => {
    set({ loading: true, error: null });
    try {
      const theses = await api.getTheses(params);
      set({ theses, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchThesis: async (id) => {
    set({ loading: true, error: null, activeThesis: null });
    try {
      const thesis = await api.getThesis(id);
      if (!thesis) {
        set({ activeThesis: null, loading: false });
        return null;
      }
      set({ activeThesis: thesis, loading: false });
      return thesis;
    } catch (err) {
      // 404s are not-found, not errors — let the UI show the not-found block
      if (err.message?.includes('not found') || err.message?.includes('404')) {
        set({ activeThesis: null, loading: false });
        return null;
      }
      console.error('[ThesisStore] fetchThesis failed:', err.message);
      set({ error: err.message, loading: false });
      return null;
    }
  },

  createThesis: async (data) => {
    set({ loading: true, error: null });
    try {
      const thesis = await api.createThesis(data);
      if (!thesis || !thesis.id) {
        throw new Error('Server returned empty response — thesis may not have been saved');
      }
      console.log('[ThesisStore] Created thesis:', thesis.id, thesis.title);
      set((state) => ({ theses: [thesis, ...state.theses], loading: false }));
      return thesis;
    } catch (err) {
      console.error('[ThesisStore] createThesis failed:', err.message);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateThesis: async (id, data) => {
    set({ error: null });
    try {
      const thesis = await api.updateThesis(id, data);
      set((state) => ({
        theses: state.theses.map(t => t.id === id ? thesis : t),
        activeThesis: state.activeThesis?.id === id ? thesis : state.activeThesis,
      }));
      return thesis;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteThesis: async (id) => {
    try {
      await api.deleteThesis(id);
      set((state) => ({
        theses: state.theses.filter(t => t.id !== id),
        activeThesis: state.activeThesis?.id === id ? null : state.activeThesis,
      }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  // Run full three-layer decision engine on a thesis
  evaluateThesis: (
    thesis,
    signals = [],
    marketObs = [],
    executionPlan = null,
    checklistAnswers = null,
    predictionMarketAssessment = null,
    playbookEntries = [],
  ) => {
    // Step 1: Auto-score all factors from available data
    const autoResult = autoScoreThesis(thesis, signals, marketObs, predictionMarketAssessment, playbookEntries);
    const { scores: autoScores, explanations } = autoResult;

    // Step 2: Merge auto-scores with manual overrides from thesis
    // Manual scores (stored in DB) take priority over auto-computed scores.
    const factorScores = {};
    for (const key of ALL_FACTOR_KEYS) {
      // Map factor key to DB column name
      const dbKey = `score_${key}`;
      factorScores[key] = thesis[dbKey] ?? autoScores[key] ?? null;
    }

    // Step 3: Compute penalties
    const penalties = computePenalties(factorScores, signals, thesis);

    // Step 4: Compute three-layer composite score
    const scoreResult = computeCompositeScore(factorScores, penalties);

    // Step 5: Run gates
    const gateResult = runGates(thesis, executionPlan, signals, checklistAnswers);

    // Step 6: Inject penalty total for classification penalty-downgrade check
    const factorScoresWithMeta = { ...factorScores, _penaltyTotal: penalties.total };

    // Step 7: Classify with layer scores
    const layerScores = {
      evidence: scoreResult.layers.evidence,
      structure: scoreResult.layers.structure,
      market_edge: scoreResult.layers.market_edge,
    };
    const classification = classifyThesis(
      scoreResult.composite, factorScoresWithMeta, gateResult, thesis, layerScores
    );

    // Step 8: Compute confidence (separate from score)
    const confidence = estimateConfidence(scoreResult, signals, marketObs, predictionMarketAssessment);

    return {
      // Factor-level scores
      factorScores,
      autoScores,
      explanations,

      // Three-layer results
      scoreResult,
      layers: scoreResult.layers,

      // Penalties
      penalties,

      // Gates
      gateResult,

      // Classification
      classification,

      // Confidence (separate from score)
      confidence,

      // Signal independence analysis
      independence: autoResult.independence,

      // Market reaction comparison
      marketReaction: autoResult.marketReaction,

      // Playbook pattern matching
      playbookMatch: autoResult.playbookMatch,

      // Prediction market analysis
      predictionMarket: autoResult.predictionMarket,

      // Calibration snapshot — caller should persist score_at_creation on first scoring
      calibration: {
        composite: scoreResult.composite,
        classification: classification.classification,
        confidence: confidence.level,
        timestamp: new Date().toISOString(),
      },
    };
  },
}));
