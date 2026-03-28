// ============================================================
// CONFIG — Import behavior and validation tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from "vitest";

describe("config.js", () => {
  // Dynamic import so we can manipulate env before loading
  async function loadConfig(envOverrides = {}) {
    // Reset module cache so config re-reads process.env
    vi.resetModules();

    // Stub dotenv.config so it doesn't load .env file during tests
    vi.doMock("dotenv", () => ({ default: { config: () => {} } }));

    // Set env vars before import
    for (const [k, v] of Object.entries(envOverrides)) {
      process.env[k] = v;
    }

    const mod = await import("../server/config.js");
    return mod;
  }

  // Clean env after each test
  const envKeys = [
    "NODE_ENV", "PORT", "DB_HOST", "DB_PORT", "DB_NAME",
    "DB_USER", "DB_PASSWORD", "API_KEY", "CORS_ORIGIN",
    "FRED_API_KEY", "FINNHUB_API_KEY",
  ];

  beforeEach(() => {
    for (const k of envKeys) delete process.env[k];
  });

  it("exports config as default with expected top-level keys", async () => {
    const { default: config } = await loadConfig();
    expect(config).toHaveProperty("env");
    expect(config).toHaveProperty("port");
    expect(config).toHaveProperty("db");
    expect(config).toHaveProperty("apiKey");
    expect(config).toHaveProperty("corsOrigin");
    expect(config).toHaveProperty("providers");
    expect(config).toHaveProperty("llm");
    expect(config).toHaveProperty("cache");
    expect(config).toHaveProperty("refresh");
    expect(config).toHaveProperty("signals");
  });

  it("uses defaults when env vars are absent", async () => {
    const { default: config } = await loadConfig();
    expect(config.port).toBe(3002);
    expect(config.db.host).toBe("localhost");
    expect(config.db.port).toBe(5432);
    expect(config.db.name).toBe("signalforge");
    expect(config.corsOrigin).toBe("http://localhost:5173");
  });

  it("reads env overrides", async () => {
    const { default: config } = await loadConfig({
      PORT: "4000",
      DB_HOST: "db.example.com",
      DB_PORT: "5433",
      CORS_ORIGIN: "https://app.example.com",
    });
    expect(config.port).toBe(4000);
    expect(config.db.host).toBe("db.example.com");
    expect(config.db.port).toBe(5433);
    expect(config.corsOrigin).toBe("https://app.example.com");
  });

  it("exports validateConfig that returns warnings array", async () => {
    const { validateConfig } = await loadConfig();
    const warnings = validateConfig();
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("validateConfig warns when no provider keys set", async () => {
    const { validateConfig } = await loadConfig();
    const warnings = validateConfig();
    expect(warnings.some((w) => w.includes("provider"))).toBe(true);
  });

  it("validateConfig warns about API_KEY in production", async () => {
    const { validateConfig } = await loadConfig({ NODE_ENV: "production" });
    const warnings = validateConfig();
    expect(warnings.some((w) => w.includes("API_KEY"))).toBe(true);
  });
});
