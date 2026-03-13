import { create } from 'zustand';
import { api } from '../lib/api';

export const useMarketStore = create((set) => ({
  providers: {},
  prices: {},
  news: [],
  headlines: [],
  macroData: {},
  calendar: [],
  observations: [],
  loading: false,
  error: null,

  fetchProviders: async () => {
    try {
      const providers = await api.getProviders();
      set({ providers });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchPrice: async (symbol) => {
    try {
      const result = await api.getPrice(symbol);
      set((state) => ({ prices: { ...state.prices, [symbol]: result } }));
      return result;
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchWatchlist: async (symbols) => {
    set({ loading: true });
    try {
      const results = await api.fetchWatchlist(symbols);
      set((state) => ({ prices: { ...state.prices, ...results }, loading: false }));
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchNews: async (query) => {
    try {
      const result = await api.getNews(query);
      if (result.data?.data) set({ news: result.data.data });
      else if (result.data) set({ news: Array.isArray(result.data) ? result.data : [] });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchMacroSeries: async (seriesId) => {
    try {
      const result = await api.getMacroSeries(seriesId);
      set((state) => ({ macroData: { ...state.macroData, [seriesId]: result } }));
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchCalendar: async (from, to) => {
    try {
      const result = await api.getMacroCalendar({ from, to });
      if (result.data?.data) set({ calendar: result.data.data });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchObservations: async (params) => {
    try {
      const observations = await api.getObservations(params);
      set({ observations });
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
