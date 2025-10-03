import axios from 'axios';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import database from '../models/database.js';
import { retry } from '../utils/helpers.js';

class DataAggregatorService {
  constructor() {
    this.lastUpdate = null;
    this.poolsCache = new Map();
  }

  /**
   * Fetch pools from backend API
   */
  async fetchPoolsFromBackend() {
    try {
      const response = await retry(
        () => axios.get(`${config.apis.backend}/api/pairs`, {
          params: {
            page: 1,
            limit: 100,
            min_liquidity: config.bot.minTvl,
            sort_by: 'fees_24h',
          },
        }),
        3,
        2000
      );

      if (response.data.status !== 'success') {
        throw new Error('Backend API returned error status');
      }

      logger.info(`Fetched ${response.data.data.length} pools from backend API`);
      return response.data.data;
    } catch (error) {
      logger.error('Failed to fetch pools from backend:', error);
      throw error;
    }
  }

  /**
   * Fetch additional data from DexScreener
   */
  async fetchDexScreenerData(poolAddress) {
    try {
      const response = await retry(
        () => axios.get(`${config.apis.dexscreener}/pairs/solana/${poolAddress}`),
        2,
        1000
      );

      const pairData = response.data.pairs?.[0];
      if (!pairData) {
        return null;
      }

      return {
        priceUsd: parseFloat(pairData.priceUsd || 0),
        volume24h: parseFloat(pairData.volume?.h24 || 0),
        volume1h: parseFloat(pairData.volume?.h1 || 0),
        volume5m: parseFloat(pairData.volume?.m5 || 0),
        priceChange24h: parseFloat(pairData.priceChange?.h24 || 0),
        priceChange1h: parseFloat(pairData.priceChange?.h1 || 0),
        priceChange6h: parseFloat(pairData.priceChange?.h6 || 0),
        priceChange5m: parseFloat(pairData.priceChange?.m5 || 0),
        txns24h: {
          buys: pairData.txns?.h24?.buys || 0,
          sells: pairData.txns?.h24?.sells || 0,
        },
        txns1h: {
          buys: pairData.txns?.h1?.buys || 0,
          sells: pairData.txns?.h1?.sells || 0,
        },
        txns5m: {
          buys: pairData.txns?.m5?.buys || 0,
          sells: pairData.txns?.m5?.sells || 0,
        },
        liquidity: parseFloat(pairData.liquidity?.usd || 0),
        fdv: parseFloat(pairData.fdv || 0),
      };
    } catch (error) {
      logger.debug(`Failed to fetch DexScreener data for ${poolAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch token security data from RugCheck
   */
  async fetchSecurityData(tokenAddress) {
    try {
      const response = await retry(
        () => axios.get(`${config.apis.rugcheck}/tokens/${tokenAddress}/report/summary`),
        2,
        1000
      );

      const report = response.data;
      return {
        score: report.score || 0,
        risks: report.risks || [],
        riskLevel: report.riskLevel || 'unknown',
        hasAuthority: report.mint?.mintAuthority !== null || report.mint?.freezeAuthority !== null,
      };
    } catch (error) {
      logger.debug(`Failed to fetch security data for ${tokenAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch token holder data from Helius
   */
  async fetchHolderData(tokenAddress) {
    try {
      if (!config.apis.helius) {
        return null;
      }

      const response = await retry(
        () => axios.post(config.apis.helius, {
          jsonrpc: '2.0',
          id: 'helius-holders',
          method: 'getTokenLargestAccounts',
          params: [tokenAddress],
        }),
        2,
        1000
      );

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const holders = response.data.result?.value || [];
      const totalSupply = holders.reduce((sum, h) => sum + parseFloat(h.amount), 0);

      // Calculate concentration
      const top10Sum = holders.slice(0, 10).reduce((sum, h) => sum + parseFloat(h.amount), 0);
      const concentration = totalSupply > 0 ? (top10Sum / totalSupply) * 100 : 0;

      return {
        topHolders: holders.length,
        concentration,
        holders: holders.slice(0, 5).map(h => ({
          address: h.address,
          amount: h.amount,
        })),
      };
    } catch (error) {
      logger.debug(`Failed to fetch holder data for ${tokenAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch Jupiter token data
   */
  async fetchJupiterData(tokenAddress) {
    try {
      const response = await retry(
        () => axios.get(`${config.apis.jupiter}/tokens/v2/search?query=${tokenAddress}`),
        2,
        1000
      );

      const tokenData = response.data?.[0];
      if (!tokenData) {
        return null;
      }

      return {
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
        logoURI: tokenData.logoURI,
        tags: tokenData.tags || [],
      };
    } catch (error) {
      logger.debug(`Failed to fetch Jupiter data for ${tokenAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Enrich pool data with additional sources
   */
  async enrichPoolData(pool) {
    try {
      const [dexScreener, securityX, securityY, holdersX, jupiterX, jupiterY] = await Promise.allSettled([
        this.fetchDexScreenerData(pool.address),
        this.fetchSecurityData(pool.mint_x),
        this.fetchSecurityData(pool.mint_y),
        this.fetchHolderData(pool.mint_x),
        this.fetchJupiterData(pool.mint_x),
        this.fetchJupiterData(pool.mint_y),
      ]);

      const enrichedPool = {
        ...pool,
        dexScreener: dexScreener.status === 'fulfilled' ? dexScreener.value : null,
        security: {
          tokenX: securityX.status === 'fulfilled' ? securityX.value : null,
          tokenY: securityY.status === 'fulfilled' ? securityY.value : null,
        },
        holders: {
          tokenX: holdersX.status === 'fulfilled' ? holdersX.value : null,
        },
        tokens: {
          tokenX: jupiterX.status === 'fulfilled' ? jupiterX.value : null,
          tokenY: jupiterY.status === 'fulfilled' ? jupiterY.value : null,
        },
        enrichedAt: new Date(),
      };

      return enrichedPool;
    } catch (error) {
      logger.error(`Failed to enrich pool data for ${pool.address}:`, error);
      return pool;
    }
  }

  /**
   * Update all pools data
   */
  async updateAllPools() {
    try {
      logger.info('Starting pool data update...');

      // Fetch pools from backend
      const pools = await this.fetchPoolsFromBackend();

      // Enrich pools with additional data (do in batches to avoid rate limits)
      const batchSize = 5;
      const enrichedPools = [];

      for (let i = 0; i < pools.length; i += batchSize) {
        const batch = pools.slice(i, i + batchSize);
        const enrichedBatch = await Promise.all(
          batch.map(pool => this.enrichPoolData(pool))
        );
        enrichedPools.push(...enrichedBatch);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < pools.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update cache
      enrichedPools.forEach(pool => {
        this.poolsCache.set(pool.address, pool);
      });

      // Save to database
      await this.savePoolsToDatabase(enrichedPools);

      this.lastUpdate = new Date();
      logger.info(`Updated ${enrichedPools.length} pools successfully`);

      return enrichedPools;
    } catch (error) {
      logger.error('Failed to update pools:', error);
      throw error;
    }
  }

  /**
   * Save pools to database
   */
  async savePoolsToDatabase(pools) {
    try {
      for (const pool of pools) {
        // Upsert pool
        await database.query(`
          INSERT INTO pools (address, name, mint_x, mint_y, bin_step, base_fee, is_blacklisted)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (address)
          DO UPDATE SET
            name = $2,
            mint_x = $3,
            mint_y = $4,
            bin_step = $5,
            base_fee = $6,
            is_blacklisted = $7,
            updated_at = NOW()
        `, [
          pool.address,
          pool.pairName,
          pool.mint_x,
          pool.mint_y,
          pool.binStep,
          pool.baseFee,
          pool.is_blacklisted,
        ]);

        // Save metrics
        const dex = pool.dexScreener;
        const txns24h = dex?.txns24h || { buys: 0, sells: 0 };
        const totalTxns = txns24h.buys + txns24h.sells;
        const buyPercent = totalTxns > 0 ? (txns24h.buys / totalTxns) * 100 : 50;

        await database.savePoolMetrics(pool.address, {
          price: dex?.priceUsd || pool.price || 0,
          fees24h: pool.fees24h || 0,
          apr: pool.apr || 0,
          tvl: dex?.liquidity || pool.totalLiquidity || 0,
          volume24h: dex?.volume24h || 0,
          txnCount24h: totalTxns,
          buyPercent: buyPercent,
          priceChange24h: dex?.priceChange24h || 0,
        });
      }

      logger.debug(`Saved ${pools.length} pools to database`);
    } catch (error) {
      logger.error('Failed to save pools to database:', error);
      throw error;
    }
  }

  /**
   * Get pool from cache
   */
  getPool(poolAddress) {
    return this.poolsCache.get(poolAddress);
  }

  /**
   * Get all pools from cache
   */
  getAllPools() {
    return Array.from(this.poolsCache.values());
  }

  /**
   * Get pools that meet minimum criteria
   */
  getEligiblePools() {
    const pools = this.getAllPools();

    return pools.filter(pool => {
      // Basic filters
      if (pool.is_blacklisted) return false;
      if ((pool.totalLiquidity || 0) < config.bot.minTvl) return false;
      if ((pool.apr || 0) < config.bot.minApr) return false;

      // Security filters
      const secX = pool.security?.tokenX;
      const secY = pool.security?.tokenY;

      // Exclude high-risk tokens
      if (secX?.riskLevel === 'high' || secY?.riskLevel === 'high') return false;

      // Exclude tokens with authority issues
      if (secX?.hasAuthority || secY?.hasAuthority) return false;

      // Check holder concentration (exclude if > 80% held by top 10)
      const holders = pool.holders?.tokenX;
      if (holders && holders.concentration > 80) return false;

      return true;
    });
  }

  /**
   * Get pool metrics history from database
   */
  async getPoolHistory(poolAddress, hoursBack = 24) {
    try {
      return await database.getPoolMetricsHistory(poolAddress, hoursBack);
    } catch (error) {
      logger.error(`Failed to get pool history for ${poolAddress}:`, error);
      return [];
    }
  }

  /**
   * Calculate pool volatility from history
   */
  calculateVolatility(history) {
    if (history.length < 2) return 0;

    const priceChanges = [];
    for (let i = 1; i < history.length; i++) {
      const change = Math.abs(
        ((history[i].price - history[i - 1].price) / history[i - 1].price) * 100
      );
      priceChanges.push(change);
    }

    // Calculate average volatility
    const avgVolatility = priceChanges.reduce((sum, v) => sum + v, 0) / priceChanges.length;
    return avgVolatility;
  }

  /**
   * Get last update time
   */
  getLastUpdateTime() {
    return this.lastUpdate;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.poolsCache.clear();
    logger.debug('Pool cache cleared');
  }
}

export default new DataAggregatorService();
