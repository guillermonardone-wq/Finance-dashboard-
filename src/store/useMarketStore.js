import { create } from "zustand";
import { api } from "../lib/api";

export const useMarketStore = create((set) => ({
  providers: {},
  providerSummary: {},
  prices: {},
  news: [],
  headlines: [],
  macroData: {},
  calendar: [],
  observations: [],
  fredSeries: [],
  fredData: {},
  fredYieldCurve: null,
  worldBankIndicators: [],
  worldBankCountries: [],
  worldBankData: {},
  worldBankSearch: null,
  fxRates: null,
  fxPairs: {},
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

  fetchProviderSummary: async () => {
    try {
      const providerSummary = await api.getProviderSummary();
      set({ providerSummary });
    } catch {}
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
      set((state) => ({
        prices: { ...state.prices, ...results },
        loading: false,
      }));
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchNews: async (query) => {
    try {
      const result = await api.getNews(query);
      if (result.data?.data) set({ news: result.data.data });
      else if (result.data)
        set({ news: Array.isArray(result.data) ? result.data : [] });
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchMacroSeries: async (seriesId) => {
    try {
      const result = await api.getMacroSeries(seriesId);
      set((state) => ({
        macroData: { ...state.macroData, [seriesId]: result },
      }));
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

  // ---- FRED ----
  fetchFredSeries: async () => {
    try {
      const result = await api.getFredSeries();
      if (result.success) set({ fredSeries: result.data || [] });
    } catch {}
  },

  fetchFredData: async (seriesId) => {
    try {
      const result = await api.getFredSeriesData(seriesId);
      if (result.success) {
        set((state) => ({
          fredData: { ...state.fredData, [seriesId]: result.data },
        }));
      }
      return result;
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchFredYieldCurve: async () => {
    try {
      const result = await api.getFredYieldCurve();
      if (result.success) set({ fredYieldCurve: result.data });
      return result;
    } catch {}
  },

  // ---- WORLD BANK ----
  fetchWorldBankIndicators: async () => {
    try {
      const result = await api.getWorldBankIndicators();
      if (result.success) {
        set({
          worldBankIndicators: result.data || [],
          worldBankCountries: result.countries || [],
        });
      }
    } catch {}
  },

  fetchWorldBankData: async (indicator, countries, from, to) => {
    try {
      const params = {};
      if (countries) params.countries = countries;
      if (from) params.from = from;
      if (to) params.to = to;
      const result = await api.getWorldBankData(indicator, params);
      if (result.success) {
        set((state) => ({
          worldBankData: { ...state.worldBankData, [indicator]: result.data },
        }));
      }
      return result;
    } catch (err) {
      set({ error: err.message });
    }
  },

  searchWorldBank: async (query) => {
    try {
      const result = await api.searchWorldBank(query, { top: 20 });
      if (result.success) set({ worldBankSearch: result.data });
      return result;
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ---- FX ----
  fetchFxRates: async (base) => {
    try {
      const result = await api.getFxRates(base);
      if (result.success) set({ fxRates: result.data });
      return result;
    } catch (err) {
      set({ error: err.message });
    }
  },

  fetchFxPairs: async (pairs) => {
    try {
      const result = await api.getFxPairQuotes(pairs);
      if (result.success) set({ fxPairs: result.data });
      return result;
    } catch (err) {
      set({ error: err.message });
    }
  },
}));
