// ============================================================
// PROVIDER REGISTRY — Routes requests to capable adapters
// ============================================================
// Handles: initialization, capability routing, fallback, health.
// If a primary provider fails, tries the next capable provider.

import { AlphaVantageProvider } from './adapters/alpha-vantage.js';
import { FinnhubProvider } from './adapters/finnhub.js';
import { NewsApiProvider } from './adapters/newsapi.js';
import { UnusualWhalesProvider } from './adapters/unusual-whales.js';
import { FredProvider } from './adapters/fred.js';

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.initialized = false;
  }

  async initialize() {
    // Register all providers
    const adapters = [
      new AlphaVantageProvider(),
      new FinnhubProvider(),
      new NewsApiProvider(),
      new UnusualWhalesProvider(),
      new FredProvider(),
    ];

    for (const adapter of adapters) {
      await adapter.initialize();
      this.providers.set(adapter.name, adapter);
      console.log(
        `[Registry] ${adapter.name}: ${adapter.enabled ? 'ENABLED' : 'DISABLED'}` +
        (adapter._lastError ? ` (${adapter._lastError.message})` : '')
      );
    }

    this.initialized = true;
    return this.getStatus();
  }

  // Find all providers that support a capability
  getProvidersFor(capability) {
    return [...this.providers.values()]
      .filter(p => p.enabled && p.capabilities[capability])
      .sort((a, b) => {
        // Prefer providers with fewer errors
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
        return {
          success: true,
          data,
          provider: provider.name,
          fallback: i > 0,
          source_attribution: `${provider.name} via ${method}`,
        };
      } catch (err) {
        console.warn(`[Registry] ${provider.name}.${method}() failed: ${err.message}`);
        if (i === providers.length - 1) {
          return {
            success: false,
            error: `All providers failed for ${capability}.${method}: ${err.message}`,
            data: null,
            provider: null,
            fallback: false,
          };
        }
        // Continue to fallback
      }
    }
  }

  // Get prices with fallback
  async getPrice(symbol) {
    return this.execute('prices', 'getPrice', symbol);
  }

  async getCandles(symbol, interval, from, to) {
    return this.execute('prices', 'getCandles', symbol, interval, from, to);
  }

  async getMacroSeries(seriesId, from, to) {
    return this.execute('macroSeries', 'getMacroSeries', seriesId, from, to);
  }

  async getMacroCalendar(from, to) {
    return this.execute('macroCalendar', 'getMacroCalendar', from, to);
  }

  async getNews(query, from, to) {
    return this.execute('news', 'getNews', query, from, to);
  }

  async getTopHeadlines(category) {
    return this.execute('news', 'getTopHeadlines', category);
  }

  async getSentiment(symbol) {
    return this.execute('sentiment', 'getSentiment', symbol);
  }

  getStatus() {
    const status = {};
    for (const [name, provider] of this.providers) {
      status[name] = provider.getStats();
    }
    return status;
  }

  getProvider(name) {
    return this.providers.get(name);
  }
}

// Singleton
export const registry = new ProviderRegistry();
