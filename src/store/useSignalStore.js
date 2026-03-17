import { create } from "zustand";
import { api } from "../lib/api";

export const useSignalStore = create((set) => ({
  signals: [],
  counts: {},
  loading: false,
  error: null,

  fetchSignals: async (params) => {
    set({ loading: true, error: null });
    try {
      const signals = await api.getSignals(params);
      set({ signals, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchCounts: async () => {
    try {
      const counts = await api.getSignalCounts();
      set({ counts });
    } catch {
      // Silent fail — counts are non-critical
    }
  },

  createSignal: async (data) => {
    set({ loading: true, error: null });
    try {
      const signal = await api.createSignal(data);
      set((state) => ({ signals: [signal, ...state.signals], loading: false }));
      return signal;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateSignal: async (id, data) => {
    set({ error: null });
    try {
      const signal = await api.updateSignal(id, data);
      set((state) => ({
        signals: state.signals.map((s) => (s.id === id ? signal : s)),
      }));
      return signal;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteSignal: async (id) => {
    try {
      await api.deleteSignal(id);
      set((state) => ({ signals: state.signals.filter((s) => s.id !== id) }));
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
