// ============================================================
// PROVIDER & NORMALIZATION TESTS
// ============================================================
// Run with: node tests/providers.test.js
// Tests: provider registry, FRED normalization, World Bank normalization,
//        market quote normalization, FX fetch path, empty-provider fallback,
//        quick capture draft creation.

import { strict as assert } from "assert";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, unlinkSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Set up test DB
const TEST_DB_PATH = join(__dirname, "../data/test-engine.db");
process.env.DB_PATH = TEST_DB_PATH;
process.env.FRED_API_KEY = ""; // disable for tests
process.env.FINNHUB_API_KEY = ""; // disable for tests
process.env.NEWSAPI_API_KEY = "";
process.env.ALPHA_VANTAGE_API_KEY = "";

// Ensure data dir
const dataDir = join(__dirname, "../data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// Clean up previous test DB
if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

// Import after env setup
const { initDb, getDb, closeDb } = await import("../server/db/connection.js");
const { seed } = await import("../server/seed-fn.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name}`);
    console.error(`        ${err.message}`);
  }
}

console.log("\n=== Provider & Normalization Tests ===\n");

// ---- DB & Seed ----
console.log("--- Database & Seed ---");

test("initDb creates tables without error", () => {
  initDb();
  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  assert.ok(tables.includes("theses"), "theses table exists");
  assert.ok(tables.includes("signals"), "signals table exists");
  assert.ok(
    tables.includes("market_observations"),
    "market_observations table exists",
  );
  assert.ok(tables.includes("provider_cache"), "provider_cache table exists");
});

test("seed populates theses and signals", () => {
  seed();
  const db = getDb();
  const thesisCount = db
    .prepare("SELECT COUNT(*) as count FROM theses")
    .get().count;
  const signalCount = db
    .prepare("SELECT COUNT(*) as count FROM signals")
    .get().count;
  assert.ok(thesisCount >= 2, `Expected >= 2 theses, got ${thesisCount}`);
  assert.ok(signalCount >= 5, `Expected >= 5 signals, got ${signalCount}`);
});

test("seed creates market observations", () => {
  const db = getDb();
  const obsCount = db
    .prepare("SELECT COUNT(*) as count FROM market_observations")
    .get().count;
  assert.ok(obsCount >= 5, `Expected >= 5 observations, got ${obsCount}`);
});

test("seeded theses have correct status and classification", () => {
  const db = getDb();
  const active = db
    .prepare("SELECT * FROM theses WHERE status = 'active'")
    .all();
  assert.ok(active.length >= 1, "At least one active thesis");
  for (const t of active) {
    assert.ok(
      [
        "WATCH",
        "DEVELOP",
        "PAPER_TRADE",
        "SMALL_POSITION",
        "FULLY_QUALIFIED",
        "IGNORE",
      ].includes(t.classification),
      `Valid classification: ${t.classification}`,
    );
  }
});

// ---- Quick Capture Draft Creation ----
console.log("\n--- Quick Capture Draft Creation ---");

test("creating a draft thesis requires only title and statement", () => {
  const db = getDb();
  const id = "test-draft-" + Date.now();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO theses (
    id, created_at, updated_at, title, thesis_statement, causal_chain,
    affected_assets, expected_timeline, probability_low, probability_high, probability_best,
    market_pricing_assessment, key_assumptions, alternative_explanations,
    disconfirming_evidence, strongest_bear_case, what_would_make_opposite_stronger,
    status, classification, tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    now,
    now,
    "Test Quick Capture",
    "This is a test thesis statement",
    "[]",
    "[]",
    "{}",
    0.2,
    0.6,
    0.4,
    "{}",
    "[]",
    "[]",
    "[]",
    "",
    "",
    "draft",
    "WATCH",
    "[]",
  );

  const row = db.prepare("SELECT * FROM theses WHERE id = ?").get(id);
  assert.ok(row, "Draft thesis created");
  assert.equal(row.status, "draft");
  assert.equal(row.classification, "WATCH");
  assert.equal(row.title, "Test Quick Capture");
});

// ---- Provider Registry State ----
console.log("\n--- Provider Registry State ---");

await asyncTest("provider registry initializes all providers", async () => {
  const { registry } = await import("../server/providers/registry.js");
  const status = await registry.initialize();

  assert.ok(status.fred, "FRED provider registered");
  assert.ok(status.worldbank, "World Bank provider registered");
  assert.ok(status.finnhub, "Finnhub provider registered");

  // Without API keys, FRED and Finnhub should be disabled
  assert.equal(status.fred.enabled, false, "FRED disabled without key");
  assert.equal(status.finnhub.enabled, false, "Finnhub disabled without key");
});

// ---- Empty Provider Fallback ----
console.log("\n--- Empty Provider Fallback ---");

await asyncTest(
  "registry returns graceful error when no provider enabled",
  async () => {
    const { registry } = await import("../server/providers/registry.js");
    const result = await registry.getPrice("AAPL");
    assert.equal(result.success, false, "Should fail gracefully");
    assert.ok(result.error, "Should include error message");
    assert.equal(result.data, null, "Data should be null");
  },
);

await asyncTest(
  "registry returns graceful error for macro series without provider",
  async () => {
    const { registry } = await import("../server/providers/registry.js");
    const result = await registry.getMacroSeries("US_CPI");
    assert.equal(result.success, false, "Should fail gracefully");
    assert.ok(
      result.error.includes("No enabled provider"),
      "Error mentions no provider",
    );
  },
);

// ---- FRED Normalization ----
console.log("\n--- FRED Normalization ---");

test("FRED provider has correct capabilities", async () => {
  const { FredProvider } = await import("../server/providers/adapters/fred.js");
  const fred = new FredProvider({ apiKey: "test" });
  assert.equal(fred.capabilities.macroSeries, true);
  assert.equal(fred.capabilities.macroCalendar, true);
  assert.equal(fred.capabilities.prices, false);
  assert.equal(fred.capabilities.forex, false);
});

test("FRED getAvailableSeries returns curated list", async () => {
  const { FredProvider } = await import("../server/providers/adapters/fred.js");
  const fred = new FredProvider({ apiKey: "test" });
  const series = fred.getAvailableSeries();
  assert.ok(series.length >= 10, `Expected >= 10 series, got ${series.length}`);

  const ids = series.map((s) => s.id);
  assert.ok(ids.includes("US_CPI"), "Has US_CPI");
  assert.ok(ids.includes("US_GDP"), "Has US_GDP");
  assert.ok(ids.includes("US_UNEMPLOYMENT"), "Has US_UNEMPLOYMENT");
  assert.ok(ids.includes("FEDERAL_FUNDS_RATE"), "Has FEDERAL_FUNDS_RATE");
  assert.ok(ids.includes("US_TREASURY_10Y"), "Has US_TREASURY_10Y");
  assert.ok(ids.includes("VIX"), "Has VIX");

  // Check normalization shape
  for (const s of series) {
    assert.ok(s.id, "Has id");
    assert.ok(s.code, "Has FRED code");
    assert.ok(s.name, "Has name");
    assert.ok(s.unit, "Has unit");
    assert.ok(s.frequency, "Has frequency");
  }
});

// ---- World Bank Data360 Normalization ----
console.log("\n--- World Bank Data360 Normalization ---");

test("World Bank provider has correct capabilities", async () => {
  const { WorldBankProvider } =
    await import("../server/providers/adapters/worldbank.js");
  const wb = new WorldBankProvider();
  assert.equal(wb.capabilities.macroSeries, true);
  assert.equal(wb.capabilities.globalMacro, true);
  assert.equal(wb.capabilities.prices, false);
  assert.equal(wb.capabilities.news, false);
});

test("World Bank getAvailableIndicators returns curated list", async () => {
  const { WorldBankProvider } =
    await import("../server/providers/adapters/worldbank.js");
  const wb = new WorldBankProvider();
  const indicators = wb.getAvailableIndicators();
  assert.ok(
    indicators.length >= 5,
    `Expected >= 5 indicators, got ${indicators.length}`,
  );

  const ids = indicators.map((i) => i.id);
  assert.ok(ids.includes("GDP_GROWTH"), "Has GDP_GROWTH");
  assert.ok(ids.includes("INFLATION_CPI"), "Has INFLATION_CPI");
  assert.ok(ids.includes("UNEMPLOYMENT"), "Has UNEMPLOYMENT");

  for (const ind of indicators) {
    assert.ok(ind.id, "Has id");
    assert.ok(ind.code, "Has WDI code");
    assert.ok(ind.name, "Has name");
    assert.ok(ind.dataset, "Has dataset");
    assert.ok(ind.unit, "Has unit");
  }
});

test("World Bank default countries are reasonable", async () => {
  const { WorldBankProvider } =
    await import("../server/providers/adapters/worldbank.js");
  const wb = new WorldBankProvider();
  const countries = wb.getDefaultCountries();
  assert.ok(countries.includes("USA"), "Includes USA");
  assert.ok(countries.includes("CHN"), "Includes China");
  assert.ok(countries.includes("JPN"), "Includes Japan");
  assert.ok(countries.includes("WLD"), "Includes World aggregate");
});

// ---- Market Quote Normalization ----
console.log("\n--- Market Quote Normalization ---");

test("Finnhub provider has correct capabilities", async () => {
  const { FinnhubProvider } =
    await import("../server/providers/adapters/finnhub.js");
  const fh = new FinnhubProvider({ apiKey: "test" });
  assert.equal(fh.capabilities.prices, true);
  assert.equal(fh.capabilities.macroCalendar, true);
  assert.equal(fh.capabilities.news, true);
  assert.equal(fh.capabilities.sentiment, true);
  assert.equal(fh.capabilities.forex, true);
  assert.equal(fh.capabilities.macroSeries, false);
});

// ---- FX Fetch Path ----
console.log("\n--- FX Fetch Path ---");

test("FX pair symbol formatting is correct for Finnhub", () => {
  // Finnhub expects OANDA:EUR_USD format
  const pair = "EUR/USD";
  const fhSymbol = `OANDA:${pair.replace("/", "_")}`;
  assert.equal(fhSymbol, "OANDA:EUR_USD");
});

test("FX pairs list covers major USD crosses", () => {
  const FX_PAIRS = [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "USD/CAD",
  ];
  assert.ok(FX_PAIRS.length >= 6, "At least 6 pairs");
  assert.ok(
    FX_PAIRS.every((p) => p.includes("USD")),
    "All pairs include USD",
  );
});

// ---- Bot Pipeline Safety ----
console.log("\n--- Bot Pipeline ---");

await asyncTest("bot full scan runs without crashing", async () => {
  const { runFullScan } = await import("../server/bot/pipeline.js");
  const result = runFullScan();
  assert.ok(result, "Returns a result");
  assert.ok(
    ["complete", "empty", "error"].includes(result.status),
    `Status is valid: ${result.status}`,
  );
  if (result.status === "complete") {
    assert.ok(Array.isArray(result.analyses), "Has analyses array");
    assert.ok(result.summary, "Has summary");
  }
});

// ---- Cleanup ----
console.log("\n--- Cleanup ---");
closeDb();
if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);

// ---- Results ----
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
