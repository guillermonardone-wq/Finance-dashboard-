import { create } from "zustand";
import { api } from "../lib/api";

export const usePredictionMarketStore = create((set, get) => ({
  links: [],
  assessment: null,
  assessmentHistory: [],
  events: [],
  loading: false,
  error: null,

  fetchLinksForThesis: async (thesisId) => {
    set({ loading: true, error: null });
    try {
      const links = await api.getPMLinksForThesis(thesisId);
      set({ links, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchEvents: async (params) => {
    try {
      const events = await api.getPMEvents(params);
      set({ events });
    } catch (err) {
      set({ error: err.message });
    }
  },

  createLink: async (data) => {
    try {
      const link = await api.createPMLink(data);
      set((state) => ({ links: [...state.links, link] }));
      return link;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  updateLink: async (id, data) => {
    try {
      const link = await api.updatePMLink(id, data);
      set((state) => ({
        links: state.links.map((l) => (l.id === id ? { ...l, ...link } : l)),
      }));
      return link;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteLink: async (id) => {
    try {
      await api.deletePMLink(id);
      set((state) => ({ links: state.links.filter((l) => l.id !== id) }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  computeAssessment: async (thesisId) => {
    set({ loading: true, error: null });
    try {
      const result = await api.computePMAssessment(thesisId);
      set({ assessment: result, loading: false });
      return result;
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchAssessmentHistory: async (thesisId) => {
    try {
      const history = await api.getPMAssessments(thesisId);
      set({ assessmentHistory: history });
    } catch (err) {
      set({ error: err.message });
    }
  },

  reset: () =>
    set({
      links: [],
      assessment: null,
      assessmentHistory: [],
      events: [],
      loading: false,
      error: null,
    }),
}));
