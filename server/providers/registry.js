// ============================================================
// PROVIDER REGISTRY — Routes requests to capable adapters
// ============================================================
// Handles: initialization, capability routing, fallback, health.
// If a primary provider fails, tries the next capable provider.
//
// Providers:
// - FRED: US macro (CPI, GDP, unemployment, rates, yield curves)
// - World Bank Data360: Global macro (GDP, inflation, trade by country)
// - Finnhub: Market data (stocks, ETFs, FX, news, calendar)
// - Alpha Vantage: Fallback market data (prices, macro)
// - NewsAPI: News headlines

import { AlphaVantageProvider } from "./adapters/alpha-vantage.js";
import { FinnhubProvider } from "./adapters/finnhub.js";
import { NewsApiProvider } from "./adapters/newsapi.js";
import { FredProvider } from "./adapters/fred.js";
import { WorldBankProvider } from "./adapters/worldbank.js";
import config from "../config.js";
import { recordSuccess, recordFailure } from "../services/provider-health.js";

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initialized = false;
  }

  async initialize() {
    // Register all providers — order matters for fallback priority
    const adapters = [
      new FinnhubProvider({ apiKey: config.providers.finnhub }),
      new AlphaVantageProvider({ apiKey: config.providers.alphaVantage }),
      new NewsApiProvider({ apiKey: config.providers.newsApi }),
      new FredProvider({ apiKey: config.providers.fred }),
      new WorldBankProvider(),
    ];

    for (const adapter of adapters) {
      try {
        await adapter.initialize();
      } catch (err) {
        adapter.enabled = false;
        adapter._setError(err);
      }
      this.providers.set(adapter.name, adapter);
      const keyInfo = adapter.name === "worldbank" ? "(no key needed)" : "";
      console.log(
        `[Registry] ${adapter.name}: ${adapter.enabled ? "ENABLED" : "DISABLED"} ${keyInfo}` +
          (adapter._lastError ? ` (${adapter._lastError.message})` : ""),
      );
    }

    this.initialized = true;
    return this.getStatus();
  }

  // Find all providers that support a capability
  getProvidersFor(capability) {
    return [...this.providers.values()]
      .filter((p) => p.enabled && p.capabilities[capability])
      .sort((a, b) => {
        const aErr = a._lastError ? 1 : 0;
        const bErr = b._lastError ? 1 : 0;
        return aErr - bErr;
      });
  }

  // Execute a method on the best available provider, with fallback
  async execute(capability, method, ...args) {
    const providers = this.getProvidersFor(capability);
    if (providers.length === 0) {
      return {
        success: false,
        error: `No enabled provider supports capability: ${capability}`,
        data: null,
        provider: null,
        fallback: false,
      };
    }

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      try {
        const data = await provider[method](...args);
        recordSuccess(provider.name).catch(() => {});
        return {
          success: true,
          data,
          provider: provider.name,
          fallback: i > 0,
          source_attribution: `${provider.name} via ${method}`,
        };
      } catch (err) {
        recordFailure(provider.name, err).catch(() => {});
        console.warn(
          `[Registry] ${provider.name}.${method}() failed: ${err.message}`,
        );
        if (i === providers.length - 1) {
          return {
            success: false,
            error: `All providers failed for ${capability}.${method}: ${err.message}`,
            data: null,
            provider: null,
            fallback: false,
          };
        }
      }
    }
  }

  // Convenience methods
  async getPrice(symbol) {
    return this.execute("prices", "getPrice", symbol);
  }

  async getCandles(symbol, interval, from, to) {
    return this.execute("prices", "getCandles", symbol, interval, from, to);
  }

  async getMacroSeries(seriesId, from, to) {
    return this.execute("macroSeries", "getMacroSeries", seriesId, from, to);
  }

  async getMacroCalendar(from, to) {
    return this.execute("macroCalendar", "getMacroCalendar", from, to);
  }

  async getNews(query, from, to) {
    return this.execute("news", "getNews", query, from, to);
  }

  async getTopHeadlines(category) {
    return this.execute("news", "getTopHeadlines", category);
  }

  async getSentiment(symbol) {
    return this.execute("sentiment", "getSentiment", symbol);
  }

  // Get the summary status of all providers
  getStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      status[name] = provider.getStats();
    }
    return status;
  }

  // Get a specific provider by name
  getProvider(name) {
    return this.providers.get(name);
  }

  // Check if any live provider is configured
  hasAnyLiveProvider() {
    return [...this.providers.values()].some((p) => p.enabled);
  }

  // Get a summary of what's configured vs missing
  getConfigSummary() {
    const summary = {};
    for (const [name, provider] of this.providers) {
      summary[name] = {
        enabled: provider.enabled,
        capabilities: provider.capabilities,
        needsKey: name !== "worldbank",
        envVar:
          {
            finnhub: "FINNHUB_API_KEY",
            alpha_vantage: "ALPHA_VANTAGE_API_KEY",
            newsapi: "NEWSAPI_API_KEY",
            fred: "FRED_API_KEY",
            worldbank: null,
          }[name] || null,
      };
    }
    return summary;
  }
}

// Singleton
export const registry = new ProviderRegistry();
