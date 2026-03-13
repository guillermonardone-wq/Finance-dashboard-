import { create } from 'zustand';
import { api } from '../lib/api';
import { computeCompositeScore, autoScoreThesis } from '../engine/scoring';
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
    set({ loading: true, error: null });
    try {
      const thesis = await api.getThesis(id);
      set({ activeThesis: thesis, loading: false });
      return thesis;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  createThesis: async (data) => {
    set({ loading: true, error: null });
    try {
      const thesis = await api.createThesis(data);
      set((state) => ({ theses: [thesis, ...state.theses], loading: false }));
      return thesis;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateThesis: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const thesis = await api.updateThesis(id, data);
      set((state) => ({
        theses: state.theses.map(t => t.id === id ? thesis : t),
        activeThesis: state.activeThesis?.id === id ? thesis : state.activeThesis,
        loading: false,
      }));
      return thesis;
    } catch (err) {
      set({ error: err.message, loading: false });
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

  // Run full decision engine on a thesis
  evaluateThesis: (thesis, signals = [], marketObs = [], executionPlan = null, checklistAnswers = null) => {
    // Step 1: Auto-score what we can
    const { scores: autoScores, explanations } = autoScoreThesis(thesis, signals, marketObs);

    // Step 2: Merge auto-scores with any manual overrides from thesis
    const dimensionScores = {
      signal_quality: thesis.score_signal_quality ?? autoScores.signal_quality ?? null,
      signal_independence: thesis.score_signal_independence ?? autoScores.signal_independence ?? null,
      causal_chain_clarity: thesis.score_causal_clarity ?? autoScores.causal_chain_clarity ?? null,
      market_mispricing_likelihood: thesis.score_market_mispricing ?? null,
      catalyst_visibility: thesis.score_catalyst_visibility ?? null,
      timing_precision: thesis.score_timing_precision ?? autoScores.timing_precision ?? null,
      expression_quality: thesis.score_expression_quality ?? null,
      risk_containment: thesis.score_risk_containment ?? null,
      disconfirmation_robustness: thesis.score_disconfirmation_robustness ?? autoScores.disconfirmation_robustness ?? null,
      emotional_neutrality: thesis.score_emotional_neutrality ?? null,
      data_freshness: autoScores.data_freshness ?? null,
      market_confirmation_divergence: null, // always manual for MVP
    };

    // Step 3: Compute composite
    const scoreResult = computeCompositeScore(dimensionScores);

    // Step 4: Run gates
    const gateResult = runGates(thesis, executionPlan, signals, checklistAnswers);

    // Step 5: Classify
    const classification = classifyThesis(scoreResult.composite, dimensionScores, gateResult, thesis);

    return {
      dimensionScores,
      autoScores,
      explanations,
      scoreResult,
      gateResult,
      classification,
    };
  },
}));
