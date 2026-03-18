const API_BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Theses
  getTheses: (params) =>
    request(`/theses?${new URLSearchParams(params || {})}`),
  getThesis: (id) => request(`/theses/${id}`),
  createThesis: (data) =>
    request("/theses", { method: "POST", body: JSON.stringify(data) }),
  updateThesis: (id, data) =>
    request(`/theses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteThesis: (id) => request(`/theses/${id}`, { method: "DELETE" }),
  createThesisFromCluster: (data) =>
    request("/theses/from-cluster", { method: "POST", body: JSON.stringify(data) }),

  // Signals
  getSignals: (params) =>
    request(`/signals?${new URLSearchParams(params || {})}`),
  getSignalCounts: () => request("/signals/counts"),
  getSignal: (id) => request(`/signals/${id}`),
  createSignal: (data) =>
    request("/signals", { method: "POST", body: JSON.stringify(data) }),
  updateSignal: (id, data) =>
    request(`/signals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSignal: (id) => request(`/signals/${id}`, { method: "DELETE" }),

  // Market data
  getProviders: () => request("/market/providers"),
  getProviderSummary: () => request("/market/providers/summary"),
  getPrice: (symbol) => request(`/market/price/${symbol}`),
  getCandles: (symbol, params) =>
    request(`/market/candles/${symbol}?${new URLSearchParams(params || {})}`),
  getMacroSeries: (seriesId) => request(`/market/macro/${seriesId}`),
  getMacroCalendar: (params) =>
    request(`/market/calendar?${new URLSearchParams(params || {})}`),
  getNews: (q) =>
    request(`/market/news?${new URLSearchParams({ q: q || "" })}`),
  getHeadlines: (category) =>
    request(
      `/market/headlines?${new URLSearchParams({ category: category || "business" })}`,
    ),
  getSentiment: (symbol) => request(`/market/sentiment/${symbol}`),
  getObservations: (params) =>
    request(`/market/observations?${new URLSearchParams(params || {})}`),
  fetchWatchlist: (symbols) =>
    request("/market/watchlist", {
      method: "POST",
      body: JSON.stringify({ symbols }),
    }),

  // FRED
  getFredSeries: () => request("/market/fred/series"),
  getFredSeriesData: (seriesId, params) =>
    request(
      `/market/fred/series/${seriesId}?${new URLSearchParams(params || {})}`,
    ),
  getFredYieldCurve: () => request("/market/fred/yield-curve"),
  getFredCalendar: (params) =>
    request(`/market/fred/calendar?${new URLSearchParams(params || {})}`),

  // World Bank Data360
  getWorldBankIndicators: () => request("/market/worldbank/indicators"),
  getWorldBankData: (indicator, params) =>
    request(
      `/market/worldbank/data/${indicator}?${new URLSearchParams(params || {})}`,
    ),
  searchWorldBank: (query, options) =>
    request("/market/worldbank/search", {
      method: "POST",
      body: JSON.stringify({ query, ...options }),
    }),

  // FX
  getFxRates: (base) =>
    request(`/market/fx/rates?${new URLSearchParams({ base: base || "USD" })}`),
  getFxPairQuote: (pair) => request(`/market/fx/quote/${pair}`),
  getFxPairQuotes: (pairs) =>
    request("/market/fx/quotes", {
      method: "POST",
      body: JSON.stringify({ pairs }),
    }),

  // Reviews
  getReviews: (params) =>
    request(`/reviews?${new URLSearchParams(params || {})}`),
  getReview: (id) => request(`/reviews/${id}`),
  createReview: (data) =>
    request("/reviews", { method: "POST", body: JSON.stringify(data) }),

  // Prediction Markets
  getPMProviders: () => request("/prediction-markets/providers"),
  createPMProvider: (data) =>
    request("/prediction-markets/providers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPMEvents: (params) =>
    request(`/prediction-markets/events?${new URLSearchParams(params || {})}`),
  getPMEvent: (id) => request(`/prediction-markets/events/${id}`),
  createPMEvent: (data) =>
    request("/prediction-markets/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePMEvent: (id, data) =>
    request(`/prediction-markets/events/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPMSnapshots: (eventId, limit) =>
    request(
      `/prediction-markets/events/${eventId}/snapshots?${new URLSearchParams({ limit: limit || 50 })}`,
    ),
  createPMSnapshot: (eventId, data) =>
    request(`/prediction-markets/events/${eventId}/snapshots`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPMLinksForThesis: (thesisId) =>
    request(`/prediction-markets/links/thesis/${thesisId}`),
  createPMLink: (data) =>
    request("/prediction-markets/links", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePMLink: (id, data) =>
    request(`/prediction-markets/links/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePMLink: (id) =>
    request(`/prediction-markets/links/${id}`, { method: "DELETE" }),
  getPMAssessments: (thesisId) =>
    request(`/prediction-markets/assessments/thesis/${thesisId}`),
  getLatestPMAssessment: (thesisId) =>
    request(`/prediction-markets/assessments/thesis/${thesisId}/latest`),
  computePMAssessment: (thesisId) =>
    request(`/prediction-markets/assessments/thesis/${thesisId}/compute`, {
      method: "POST",
    }),

  // LLM Advisory
  runAdvisoryEvaluation: (thesisId, options) =>
    request(`/advisory/thesis/${thesisId}/evaluate`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),
  getLatestAdvisory: (thesisId) =>
    request(`/advisory/thesis/${thesisId}/latest`),
  getAdvisoryHistory: (thesisId) =>
    request(`/advisory/thesis/${thesisId}/history`),
  getThesisPacket: (thesisId) => request(`/advisory/thesis/${thesisId}/packet`),

  // Health
  getHealth: () => request("/health"),
};
