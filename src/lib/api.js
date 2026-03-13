const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
  getTheses: (params) => request(`/theses?${new URLSearchParams(params || {})}`),
  getThesis: (id) => request(`/theses/${id}`),
  createThesis: (data) => request('/theses', { method: 'POST', body: JSON.stringify(data) }),
  updateThesis: (id, data) => request(`/theses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteThesis: (id) => request(`/theses/${id}`, { method: 'DELETE' }),

  // Signals
  getSignals: (params) => request(`/signals?${new URLSearchParams(params || {})}`),
  getSignal: (id) => request(`/signals/${id}`),
  createSignal: (data) => request('/signals', { method: 'POST', body: JSON.stringify(data) }),
  updateSignal: (id, data) => request(`/signals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSignal: (id) => request(`/signals/${id}`, { method: 'DELETE' }),

  // Market data
  getProviders: () => request('/market/providers'),
  getPrice: (symbol) => request(`/market/price/${symbol}`),
  getCandles: (symbol, params) => request(`/market/candles/${symbol}?${new URLSearchParams(params || {})}`),
  getMacroSeries: (seriesId) => request(`/market/macro/${seriesId}`),
  getMacroCalendar: (params) => request(`/market/calendar?${new URLSearchParams(params || {})}`),
  getNews: (q) => request(`/market/news?${new URLSearchParams({ q: q || '' })}`),
  getHeadlines: (category) => request(`/market/headlines?${new URLSearchParams({ category: category || 'business' })}`),
  getSentiment: (symbol) => request(`/market/sentiment/${symbol}`),
  getObservations: (params) => request(`/market/observations?${new URLSearchParams(params || {})}`),
  fetchWatchlist: (symbols) => request('/market/watchlist', { method: 'POST', body: JSON.stringify({ symbols }) }),

  // Reviews
  getReviews: (params) => request(`/reviews?${new URLSearchParams(params || {})}`),
  getReview: (id) => request(`/reviews/${id}`),
  createReview: (data) => request('/reviews', { method: 'POST', body: JSON.stringify(data) }),

  // Health
  getHealth: () => request('/health'),
};
