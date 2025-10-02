import config from '../config/config.js';
import logger from '../utils/logger.js';
import { calculateBinRange, safeDivide } from '../utils/helpers.js';
import dataAggregator from './data-aggregator.service.js';

class StrategyService {
  /**
   * Determine optimal strategy based on pool characteristics
   */
  async determineStrategy(pool) {
    try {
      const dex = pool.dexScreener;
      if (!dex) {
        // Default to spot if no DexScreener data
        return {
          type: 'spot',
          reason: 'No market data available - using balanced spot strategy',
        };
      }

      const priceChange24h = Math.abs(dex.priceChange24h || 0);
      const txns24h = dex.txns24h || { buys: 0, sells: 0 };
      const totalTxns = txns24h.buys + txns24h.sells;
      const buyPercent = totalTxns > 0 ? (txns24h.buys / totalTxns) * 100 : 50;

      // Curve Strategy: Low volatility, balanced trading
      if (
        priceChange24h <= config.strategy.curveMaxPriceChange24h &&
        buyPercent >= config.strategy.curveBuyRatioMin &&
        buyPercent <= config.strategy.curveBuyRatioMax
      ) {
        return {
          type: 'curve',
          reason: `Low volatility (${priceChange24h.toFixed(2)}%), balanced trading (${buyPercent.toFixed(0)}% buys)`,
        };
      }

      // Bid-Ask Strategy: High volatility
      if (priceChange24h >= config.strategy.bidAskMinPriceChange24h) {
        return {
          type: 'bidask',
          reason: `High volatility (${priceChange24h.toFixed(2)}%) - using wide bid-ask spread`,
        };
      }

      // Spot Strategy: Moderate conditions (default)
      return {
        type: 'spot',
        reason: `Moderate volatility (${priceChange24h.toFixed(2)}%) - using balanced spot strategy`,
      };
    } catch (error) {
      logger.error('Failed to determine strategy:', error);
      return {
        type: 'spot',
        reason: 'Error determining strategy - using default spot',
      };
    }
  }

  /**
   * Calculate optimal bin range for strategy
   */
  async calculateBinParameters(pool, strategy) {
    try {
      const binStep = pool.binStep || 10;

      // Get historical data to calculate volatility
      const history = await dataAggregator.getPoolHistory(pool.address, 24);
      const volatility = history.length > 0
        ? dataAggregator.calculateVolatility(history)
        : Math.abs(pool.dexScreener?.priceChange24h || 10);

      // Calculate bin range based on strategy and volatility
      const binRange = calculateBinRange(binStep, volatility, strategy.type);

      // Get current active bin (we'll estimate from price)
      // In production, we'd fetch this from DLMM
      const estimatedActiveBin = 8388608; // 2^23, typical middle bin

      return {
        lowerBinId: estimatedActiveBin - binRange,
        upperBinId: estimatedActiveBin + binRange,
        binRange,
        volatility,
        activeBinEstimate: estimatedActiveBin,
      };
    } catch (error) {
      logger.error('Failed to calculate bin parameters:', error);
      // Return safe defaults
      return {
        lowerBinId: 8388598,
        upperBinId: 8388618,
        binRange: 10,
        volatility: 10,
        activeBinEstimate: 8388608,
      };
    }
  }

  /**
   * Calculate position size based on available capital and risk parameters
   */
  calculatePositionSize(availableCapital, pool, scores) {
    try {
      // Max position size based on config
      const maxPositionValue = availableCapital * (config.bot.maxPositionPercent / 100);

      // Adjust based on pool score (higher score = larger position)
      // Score range: 0-100, Position range: 50-100% of max
      const scoreMultiplier = 0.5 + (scores.overall / 100) * 0.5;
      const adjustedPositionValue = maxPositionValue * scoreMultiplier;

      // Adjust based on risk score (lower risk = larger position)
      const riskMultiplier = scores.risk / 100;
      const finalPositionValue = adjustedPositionValue * riskMultiplier;

      // Ensure minimum position size of $100
      const positionValue = Math.max(100, Math.min(finalPositionValue, maxPositionValue));

      logger.debug(`Position size calculated: $${positionValue.toFixed(2)} (${((positionValue / availableCapital) * 100).toFixed(2)}% of capital)`);

      return positionValue;
    } catch (error) {
      logger.error('Failed to calculate position size:', error);
      // Return safe minimum
      return 100;
    }
  }

  /**
   * Calculate token amounts for liquidity provision
   */
  calculateTokenAmounts(positionValue, pool, strategy) {
    try {
      const price = pool.dexScreener?.priceUsd || pool.price || 0;

      if (price === 0) {
        throw new Error('Pool price is zero');
      }

      // Strategy-based allocation
      let tokenXPercent = 0.5; // Default 50/50

      if (strategy.type === 'curve') {
        // Curve: More balanced, concentrated in middle
        tokenXPercent = 0.5;
      } else if (strategy.type === 'bidask') {
        // Bid-Ask: More extreme, depends on price trend
        const priceChange24h = pool.dexScreener?.priceChange24h || 0;
        if (priceChange24h > 0) {
          // Uptrend: More Y token (quote) to sell into
          tokenXPercent = 0.3;
        } else {
          // Downtrend: More X token (base) to buy
          tokenXPercent = 0.7;
        }
      } else {
        // Spot: Balanced
        tokenXPercent = 0.5;
      }

      const tokenXValue = positionValue * tokenXPercent;
      const tokenYValue = positionValue * (1 - tokenXPercent);

      // Convert to token amounts (assuming tokenX is the base)
      const tokenXAmount = tokenXValue / price;
      const tokenYAmount = tokenYValue; // Assuming tokenY is USD-denominated

      return {
        tokenX: tokenXAmount,
        tokenY: tokenYAmount,
        tokenXValue,
        tokenYValue,
        ratio: tokenXPercent,
      };
    } catch (error) {
      logger.error('Failed to calculate token amounts:', error);
      throw error;
    }
  }

  /**
   * Create complete liquidity provision parameters
   */
  async createLiquidityParameters(pool, availableCapital, scores) {
    try {
      // Determine strategy
      const strategy = await this.determineStrategy(pool);
      logger.info(`Selected ${strategy.type} strategy for ${pool.pairName}: ${strategy.reason}`);

      // Calculate bin parameters
      const binParams = await this.calculateBinParameters(pool, strategy);

      // Calculate position size
      const positionValue = this.calculatePositionSize(availableCapital, pool, scores);

      // Calculate token amounts
      const tokenAmounts = this.calculateTokenAmounts(positionValue, pool, strategy);

      return {
        poolAddress: pool.address,
        poolName: pool.pairName,
        strategy: strategy.type,
        strategyReason: strategy.reason,
        positionValue,
        binParams,
        tokenAmounts,
        slippage: 1, // 1% slippage tolerance
        entryPrice: pool.dexScreener?.priceUsd || pool.price,
        entryTvl: pool.dexScreener?.liquidity || pool.totalLiquidity,
        entryApr: pool.apr,
        scores,
      };
    } catch (error) {
      logger.error(`Failed to create liquidity parameters for ${pool.address}:`, error);
      throw error;
    }
  }

  /**
   * Check if position needs rebalancing
   */
  async needsRebalancing(position, currentPoolData) {
    try {
      // Get current active bin
      const dex = currentPoolData.dexScreener;
      if (!dex) return { needs: false, reason: 'No market data' };

      // Check if price has moved significantly
      const entryPrice = position.entry_price;
      const currentPrice = dex.priceUsd;
      const priceChange = Math.abs(((currentPrice - entryPrice) / entryPrice) * 100);

      // Rebalance if price moved > 15%
      if (priceChange > 15) {
        return {
          needs: true,
          reason: `Price moved ${priceChange.toFixed(2)}% from entry`,
          urgency: priceChange > 25 ? 'high' : 'medium',
        };
      }

      // Check if APR declined significantly
      const entryApr = position.entry_apr;
      const currentApr = currentPoolData.apr;
      const aprDecline = ((entryApr - currentApr) / entryApr) * 100;

      if (aprDecline > config.risk.maxAprDeclinePercent) {
        return {
          needs: true,
          reason: `APR declined ${aprDecline.toFixed(2)}%`,
          urgency: 'medium',
        };
      }

      // Check if strategy is still optimal
      const currentStrategy = await this.determineStrategy(currentPoolData);
      if (currentStrategy.type !== position.strategy) {
        return {
          needs: true,
          reason: `Strategy changed from ${position.strategy} to ${currentStrategy.type}`,
          urgency: 'low',
        };
      }

      return { needs: false, reason: 'Position is optimal' };
    } catch (error) {
      logger.error('Failed to check rebalancing need:', error);
      return { needs: false, reason: 'Error checking rebalancing' };
    }
  }

  /**
   * Find better opportunity than current position
   */
  async findBetterOpportunity(currentPosition, currentScore) {
    try {
      const scoringService = (await import('./scoring.service.js')).default;
      const topPools = await scoringService.getTopPools(5);

      // Find pool with score 20% better than current
      const betterPool = topPools.find(pool => {
        // Don't switch to same pool
        if (pool.address === currentPosition.pool_address) return false;

        // Require 20% better score
        return pool.scores.overall >= currentScore * 1.2;
      });

      if (betterPool) {
        return {
          found: true,
          pool: betterPool,
          reason: `Found pool with ${betterPool.scores.overall} score vs current ${currentScore}`,
        };
      }

      return { found: false, reason: 'No significantly better opportunities' };
    } catch (error) {
      logger.error('Failed to find better opportunity:', error);
      return { found: false, reason: 'Error finding opportunities' };
    }
  }
}

export default new StrategyService();
