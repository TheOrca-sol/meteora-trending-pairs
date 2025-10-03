import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Price Feed Service
 * Fetches real-time SOL price from multiple sources with fallbacks
 */
class PriceFeedService {
  constructor() {
    this.cachedPrice = null;
    this.lastUpdate = null;
    this.cacheDurationMs = 30000; // 30 seconds cache
    this.sources = [
      {
        name: 'Jupiter',
        url: 'https://price.jup.ag/v4/price?ids=SOL',
        extract: (data) => data.data?.SOL?.price,
      },
      {
        name: 'CoinGecko',
        url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
        extract: (data) => data.solana?.usd,
      },
      {
        name: 'Binance',
        url: 'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
        extract: (data) => parseFloat(data.price),
      },
    ];
  }

  /**
   * Get current SOL price in USD with caching and fallbacks
   */
  async getSolPrice() {
    try {
      // Return cached price if still valid
      if (this.cachedPrice && this.lastUpdate) {
        const age = Date.now() - this.lastUpdate;
        if (age < this.cacheDurationMs) {
          logger.debug(`Using cached SOL price: $${this.cachedPrice.toFixed(2)} (age: ${(age / 1000).toFixed(0)}s)`);
          return this.cachedPrice;
        }
      }

      // Try each source with timeout
      for (const source of this.sources) {
        try {
          const price = await this.fetchFromSource(source);
          if (price && price > 0) {
            this.cachedPrice = price;
            this.lastUpdate = Date.now();
            logger.info(`SOL price updated from ${source.name}: $${price.toFixed(2)}`);
            return price;
          }
        } catch (error) {
          logger.warn(`Failed to fetch SOL price from ${source.name}:`, error.message);
          continue; // Try next source
        }
      }

      // All sources failed - use cached if available, otherwise fallback
      if (this.cachedPrice) {
        logger.warn(`All price sources failed, using stale cache: $${this.cachedPrice.toFixed(2)}`);
        return this.cachedPrice;
      }

      // Last resort fallback
      const fallbackPrice = 100;
      logger.error(`All price sources failed and no cache available, using fallback: $${fallbackPrice}`);
      return fallbackPrice;
    } catch (error) {
      logger.error('Critical error in getSolPrice:', error);
      return this.cachedPrice || 100; // Return cache or fallback
    }
  }

  /**
   * Fetch price from a specific source
   */
  async fetchFromSource(source) {
    const response = await axios.get(source.url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Meteora-DLMM-Bot/1.0',
      },
    });

    const price = source.extract(response.data);

    if (!price || isNaN(price) || price <= 0) {
      throw new Error(`Invalid price data from ${source.name}: ${price}`);
    }

    return price;
  }

  /**
   * Get cached price without fetching (instant)
   */
  getCachedPrice() {
    return this.cachedPrice || 100; // Fallback if no cache
  }

  /**
   * Force refresh price (bypass cache)
   */
  async refreshPrice() {
    this.lastUpdate = null; // Invalidate cache
    return await this.getSolPrice();
  }

  /**
   * Get price age in seconds
   */
  getPriceAge() {
    if (!this.lastUpdate) return null;
    return (Date.now() - this.lastUpdate) / 1000;
  }

  /**
   * Check if price is stale (>5 minutes old)
   */
  isPriceStale() {
    const age = this.getPriceAge();
    return !age || age > 300; // 5 minutes
  }

  /**
   * Get price health status
   */
  getHealthStatus() {
    const age = this.getPriceAge();

    return {
      price: this.cachedPrice,
      lastUpdate: this.lastUpdate ? new Date(this.lastUpdate).toISOString() : null,
      ageSeconds: age,
      isStale: this.isPriceStale(),
      status: !age ? 'NO_DATA' : age < 60 ? 'HEALTHY' : age < 300 ? 'AGING' : 'STALE',
    };
  }
}

export default new PriceFeedService();
