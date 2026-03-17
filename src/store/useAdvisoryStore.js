import { create } from "zustand";
import { api } from "../lib/api";

export const useAdvisoryStore = create((set, get) => ({
  assessment: null,
  history: [],
  loading: false,
  error: null,

  fetchLatest: async (thesisId) => {
    set({ loading: true, error: null });
    try {
      const assessment = await api.getLatestAdvisory(thesisId);
      set({ assessment, loading: false });
      return assessment;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  fetchHistory: async (thesisId) => {
    try {
      const history = await api.getAdvisoryHistory(thesisId);
      set({ history });
      return history;
    } catch (err) {
      set({ error: err.message });
      return [];
    }
  },

  runEvaluation: async (thesisId, options) => {
    set({ loading: true, error: null });
    try {
      const assessment = await api.runAdvisoryEvaluation(thesisId, options);
      set({ assessment, loading: false });
      // Append to history
      set((state) => ({ history: [assessment, ...state.history] }));
      return assessment;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  clear: () => set({ assessment: null, history: [], error: null }),
}));
