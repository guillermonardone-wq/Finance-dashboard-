// ============================================================
// SCHEDULER — Unified signal ingestion on a timer
// ============================================================
// Single ingestion path via the normalized pipeline.
// All legacy per-provider functions have been removed.
// ============================================================

import { runIngestionPipeline } from "./signal-ingestion.js";
import { ingestionStatus } from "./ingestion-status.js";
import config from "../config.js";
import { logFailure } from "./dead-letter.js";

const INGESTION_INTERVAL_SEC = config.refresh.ingestion;

async function runScheduledIngestion() {
  console.log("[Scheduler] Ingestion started.");
  ingestionStatus.markStarted();

  try {
    const result = await runIngestionPipeline();
    ingestionStatus.markSuccess(result.totalIngested);
    console.log(
      `[Scheduler] Ingestion completed — ${result.totalIngested} ingested, ${result.totalSkipped} deduped, ${result.totalErrors} errors.`,
    );
  } catch (err) {
    ingestionStatus.markError(err.message);
    console.error(`[Scheduler] Ingestion failed: ${err.message}`);
    logFailure("ingestion_pipeline", {}, err).catch(() => {});
  }
}

export async function startScheduler() {
  // Initial run after 3s delay (let DB settle)
  setTimeout(() => {
    runScheduledIngestion().catch((err) => {
      console.error(`[Scheduler] Initial ingestion failed: ${err.message}`);
    });
  }, 3000);

  // Recurring interval
  setInterval(() => {
    runScheduledIngestion().catch((err) => {
      console.error(`[Scheduler] Scheduled ingestion failed: ${err.message}`);
    });
  }, INGESTION_INTERVAL_SEC * 1000);

  console.log(
    `[Scheduler] Started — ingestion every ${INGESTION_INTERVAL_SEC}s`,
  );
}
