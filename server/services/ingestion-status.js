// ============================================================
// INGESTION STATUS — In-memory tracker for pipeline health
// ============================================================

const state = {
  lastRun: null,
  lastSuccess: null,
  lastError: null,
  signalsIngestedCount: 0,
  totalRuns: 0,
  totalErrors: 0,
};

export const ingestionStatus = {
  markStarted() {
    state.lastRun = new Date().toISOString();
    state.totalRuns++;
  },

  markSuccess(ingestedCount) {
    state.lastSuccess = new Date().toISOString();
    state.signalsIngestedCount += ingestedCount;
    state.lastError = null;
  },

  markError(errorMessage) {
    state.lastError = {
      message: errorMessage,
      timestamp: new Date().toISOString(),
    };
    state.totalErrors++;
  },

  getStatus() {
    return { ...state };
  },
};
