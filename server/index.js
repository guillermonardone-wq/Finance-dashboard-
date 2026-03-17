import express from "express";
import cors from "cors";

import config, { validateConfig } from "./config.js";
import { initDb, getKnex, closeDb } from "./db/connection.js";
import { apiKeyAuth } from "./middleware/auth.js";
import { registry } from "./providers/registry.js";
import { cache } from "./services/cache.js";
import { seed } from "./seed-fn.js";
import { startScheduler } from "./services/scheduler.js";

import thesesRouter from "./routes/theses.js";
import signalsRouter from "./routes/signals.js";
import marketRouter from "./routes/market.js";
import reviewsRouter from "./routes/reviews.js";
import botRouter from "./routes/bot.js";
import predictionMarketsRouter from "./routes/prediction-markets.js";
import advisoryRouter from "./routes/advisory.js";
import systemRouter from "./routes/system.js";

const app = express();

// ---- CORS (hardened) ----
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "5mb" }));

// ---- API key auth on all /api routes ----
app.use("/api", apiKeyAuth);

// ---- Bootstrap (async) ----
(async () => {
  try {
    // Validate config
    validateConfig();

    // Initialize database — runs Knex migrations
    console.log("[Server] Initializing database...");
    await initDb();
    console.log("[Server] Database ready.");

    // Auto-seed if database is empty (first run)
    const knex = getKnex();
    const [{ count: thesisCount }] = await knex("theses").count("id as count");
    const [{ count: signalCount }] = await knex("signals").count("id as count");

    if (Number(thesisCount) === 0 && Number(signalCount) === 0) {
      console.log(
        "[Server] Empty database detected — running auto-seed...",
      );
      await seed();
      console.log("[Server] Auto-seed complete.");
    }

    // Initialize provider registry
    console.log("[Server] Initializing providers...");
    const status = await registry.initialize();
    const enabled = Object.values(status).filter((s) => s.enabled).length;
    console.log(
      `[Server] ${enabled}/${Object.keys(status).length} providers enabled.`,
    );
    if (enabled > 0) startScheduler();

    // Cache cleanup every 10 minutes
    setInterval(() => cache.cleanup(), 10 * 60 * 1000);

    // Routes
    app.use("/api/theses", thesesRouter);
    app.use("/api/signals", signalsRouter);
    app.use("/api/market", marketRouter);
    app.use("/api/reviews", reviewsRouter);
    app.use("/api/bot", botRouter);
    app.use("/api/prediction-markets", predictionMarketsRouter);
    app.use("/api/advisory", advisoryRouter);
    app.use("/api/system", systemRouter);

    // Legacy health endpoint (kept for backward compat)
    app.get("/api/health", async (req, res) => {
      let dbOk = false;
      try {
        await getKnex().raw("SELECT 1");
        dbOk = true;
      } catch {}
      res.json({
        status: dbOk ? "ok" : "degraded",
        database: dbOk ? "connected" : "error",
        providers: registry.getStatus(),
        uptime: process.uptime(),
      });
    });

    // Global error handler
    app.use((err, req, res, _next) => {
      console.error(
        `[Server] Unhandled error on ${req.method} ${req.path}:`,
        err.message,
      );
      res.status(500).json({ error: "Internal server error" });
    });

    app.listen(config.port, () => {
      console.log(`[Server] Signal Forge API running on port ${config.port}`);
      if (!config.apiKey) {
        console.log("[Server] Auth: dev mode (no API_KEY set — all requests allowed)");
      } else {
        console.log("[Server] Auth: API key required on all /api routes");
      }
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("[Server] Shutting down...");
      await closeDb();
      process.exit(0);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("[Server] Fatal startup error:", err);
    process.exit(1);
  }
})();
