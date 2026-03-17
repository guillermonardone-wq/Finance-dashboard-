// ============================================================
// SYSTEM ROUTES — Health, provider status, dead letter queue
// ============================================================

import { Router } from "express";
import { getKnex } from "../db/connection.js";
import { getAllProviderHealth } from "../services/provider-health.js";
import { getAllEntries } from "../services/dead-letter.js";

const router = Router();

// GET /api/system/health — aggregate system health
router.get("/health", async (req, res) => {
  let dbStatus = "error";
  try {
    await getKnex().raw("SELECT 1");
    dbStatus = "connected";
  } catch {}

  let providerHealth = [];
  try {
    providerHealth = await getAllProviderHealth();
  } catch {}

  // Derive overall status
  const hasDown = providerHealth.some((p) => p.status === "down");
  const hasDegraded = providerHealth.some((p) => p.status === "degraded");
  let status = "ok";
  if (dbStatus !== "connected" || hasDown) status = "down";
  else if (hasDegraded) status = "degraded";

  const providers = {};
  for (const p of providerHealth) {
    providers[p.provider_name] = {
      status: p.status,
      lastCheck: p.last_check,
      consecutiveFailures: p.consecutive_failures,
      lastError: p.last_error,
    };
  }

  res.json({
    status,
    db: dbStatus,
    providers,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/system/providers — provider health details
router.get("/providers", async (req, res) => {
  try {
    const health = await getAllProviderHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/dlq — dead letter queue entries
router.get("/dlq", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const entries = await getAllEntries({ limit });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
