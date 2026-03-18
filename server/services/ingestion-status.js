// ============================================================
// INGESTION STATUS — In-memory tracker for pipeline health
// ============================================================
// Tracks overall pipeline status plus per-source status for
// GDELT, ACLED, and Polymarket wire availability.
// ============================================================

const state = {
  lastRun: null,
  lastSuccess: null,
  lastError: null,
  signalsIngestedCount: 0,
  totalRuns: 0,
  totalErrors: 0,
};

// Per-source status tracking
const sourceStatus = {
  gdelt: { status: "unknown", lastRun: null, lastCount: 0, baselineWarmed: false },
  acled: { status: "unknown", lastRun: null, lastCount: 0 },
  polymarket: { status: "unknown", available: false, eventCount: 0 },
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

  /**
   * Update status for a specific source (gdelt, acled, polymarket).
   */
  markSourceStatus(source, update) {
    if (sourceStatus[source]) {
      Object.assign(sourceStatus[source], update, { lastRun: new Date().toISOString() });
    }
  },

  getStatus() {
    return { ...state, sources: { ...sourceStatus } };
  },

  getSourceStatus(source) {
    return sourceStatus[source] || null;
  },
};
