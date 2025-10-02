import config from '../config/config.js';
import logger from '../utils/logger.js';
import { calculateBinRange, safeDivide } from '../utils/helpers.js';
import dataAggregator from './data-aggregator.service.js';
import { strategyRegistry, initializeStrategies } from './strategies/index.js';

class StrategyService {
  constructor() {
    // Initialize modular strategies on first load
    this.strategiesInitialized = false;
  }

  /**
   * Ensure strategies are initialized
   */
  ensureStrategiesInitialized() {
    if (!this.strategiesInitialized) {
      initializeStrategies();
      this.strategiesInitialized = true;
      logger.info(`Strategy system initialized with ${strategyRegistry.getStrategyCount()} modular strategies`);
    }
  }
  /**
   * Calculate volume metrics for strategy selection
   */
  calculateVolumeMetrics(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { volume5m: 0, volume1h: 0, volumeVelocity: 0 };

    // Estimate 5-minute volume from hourly data
    const volume1h = dex.volume1h || 0;
    const volume24h = dex.volume24h || 0;

    // Approximate 5-minute volume (1h / 12)
    const volume5m = volume1h / 12;

    // Volume velocity: how much volume is accelerating
    // If 1h volume is higher proportion of 24h, volume is accelerating
    const expectedHourlyRatio = 1 / 24;
    const actualHourlyRatio = volume24h > 0 ? volume1h / volume24h : 0;
    const volumeVelocity = actualHourlyRatio / expectedHourlyRatio;

    return { volume5m, volume1h, volume24h, volumeVelocity };
  }

  /**
   * Determine optimal strategy based on pool characteristics
   * Enhanced with LP Army battle-tested strategies and modular registry
   */
  async determineStrategy(pool) {
    try {
      // Ensure strategies are loaded
      this.ensureStrategiesInitialized();

      // Try modular strategies first (8 new strategies)
      const modularStrategy = await strategyRegistry.evaluateStrategies(pool);
      if (modularStrategy && modularStrategy.name !== 'spot') {
        const strategyConfig = modularStrategy.config;
        return {
          type: modularStrategy.name,
          reason: modularStrategy.reason,
          timeframe: strategyConfig.timeframe,
          binTightness: strategyConfig.binTightness,
          riskLevel: strategyConfig.riskLevel,
          exitCondition: modularStrategy.metadata.exitCondition,
          metadata: modularStrategy.metadata,
        };
      }

      // Fall back to legacy inline strategies if modular didn't match
      const dex = pool.dexScreener;
      if (!dex) {
        // Default to spot if no DexScreener data
        return {
          type: 'spot',
          reason: 'No market data available - using balanced spot strategy',
          timeframe: 'medium',
          binTightness: 'medium',
        };
      }

      const priceChange24h = Math.abs(dex.priceChange24h || 0);
      const priceChange1h = Math.abs(dex.priceChange1h || 0);
      const txns24h = dex.txns24h || { buys: 0, sells: 0 };
      const totalTxns = txns24h.buys + txns24h.sells;
      const buyPercent = totalTxns > 0 ? (txns24h.buys / totalTxns) * 100 : 50;

      // Calculate volume metrics
      const volumeMetrics = this.calculateVolumeMetrics(pool);
      const { volume5m, volume1h, volumeVelocity } = volumeMetrics;

      // HEART ATTACK STRATEGY: High-volume spikes with aggressive first leg
      // Quick in/out for rapid fee generation
      if (
        volume5m > 100000 && // Volume > 100K per 5 minutes
        volumeVelocity > 3 && // Volume accelerating rapidly
        priceChange1h > 10 && // Strong 1h movement
        buyPercent > 55 // Bullish sentiment
      ) {
        return {
          type: 'heartattack',
          reason: `Volume spike detected (${(volume5m / 1000).toFixed(0)}K/5min, ${priceChange1h.toFixed(1)}% 1h move) - aggressive entry`,
          timeframe: 'ultrafast',
          binTightness: 'tight',
          riskLevel: 'high',
          exitCondition: 'volumeDrop',
        };
      }

      // TIGHT RANGE QUICK ROTATION: High momentum, extremely tight bins
      // For established trending tokens with consistent volume
      if (
        volume1h > 500000 && // Strong sustained volume
        priceChange1h > 5 &&
        priceChange1h < 15 && // Moderate but consistent movement
        totalTxns > 100 // Active trading
      ) {
        return {
          type: 'tightrange',
          reason: `High momentum (${(volume1h / 1000).toFixed(0)}K/1h, ${priceChange1h.toFixed(1)}% 1h) - tight range for quick fees`,
          timeframe: 'fast',
          binTightness: 'verytight',
          riskLevel: 'high',
          exitCondition: 'priceOutOfRange',
        };
      }

      // SINGLE-SIDED SOL SPOT: For volatile/dumping markets
      // Provide only SOL side to capture fees while accumulating base token
      if (
        priceChange24h > 15 &&
        buyPercent < 40 && // Bearish/dump scenario
        dex.priceChange24h < -10 // Actual dump, not just volatility
      ) {
        return {
          type: 'singlesided',
          reason: `Bearish volatility (${priceChange24h.toFixed(1)}%, ${buyPercent.toFixed(0)}% buys) - single-sided SOL strategy`,
          timeframe: 'medium',
          binTightness: 'wide',
          riskLevel: 'medium',
          sidePreference: 'sol',
        };
      }

      // SLOW COOK STRATEGY: Multi-day, lower stress, wider ranges
      // For stable tokens with good fundamentals
      const slowCookVolume = dex.volume24h || 0;
      if (
        priceChange24h < 8 &&
        slowCookVolume > 1000000 && // Good liquidity
        (pool.tvl || 0) > 500000 && // Established pool
        buyPercent >= 45 && buyPercent <= 55 // Balanced trading
      ) {
        return {
          type: 'slowcook',
          reason: `Stable fundamentals (${priceChange24h.toFixed(1)}% vol, $${(pool.tvl / 1000).toFixed(0)}K TVL) - long-term position`,
          timeframe: 'slow',
          binTightness: 'wide',
          riskLevel: 'low',
          exitCondition: 'timeOrAprDecline',
        };
      }

      // CURVE STRATEGY: Low volatility, concentrated liquidity
      if (
        priceChange24h <= config.strategy.curveMaxPriceChange24h &&
        buyPercent >= config.strategy.curveBuyRatioMin &&
        buyPercent <= config.strategy.curveBuyRatioMax
      ) {
        return {
          type: 'curve',
          reason: `Low volatility (${priceChange24h.toFixed(2)}%), balanced trading (${buyPercent.toFixed(0)}% buys)`,
          timeframe: 'medium',
          binTightness: 'tight',
          riskLevel: 'low',
        };
      }

      // WIDE BID-ASK STRATEGY: High volatility, wide spreads
      if (priceChange24h >= config.strategy.bidAskMinPriceChange24h) {
        return {
          type: 'bidask',
          reason: `High volatility (${priceChange24h.toFixed(2)}%) - wide bid-ask spread`,
          timeframe: 'medium',
          binTightness: 'wide',
          riskLevel: 'medium',
        };
      }

      // SPOT STRATEGY: Moderate conditions (default)
      return {
        type: 'spot',
        reason: `Moderate volatility (${priceChange24h.toFixed(2)}%) - balanced spot strategy`,
        timeframe: 'medium',
        binTightness: 'medium',
        riskLevel: 'medium',
      };
    } catch (error) {
      logger.error('Failed to determine strategy:', error);
      return {
        type: 'spot',
        reason: 'Error determining strategy - using default spot',
        timeframe: 'medium',
        binTightness: 'medium',
        riskLevel: 'medium',
      };
    }
  }

  /**
   * Calculate optimal bin range for strategy
   * Enhanced with dynamic bin tightness based on LP Army strategies
   */
  async calculateBinParameters(pool, strategy) {
    try {
      const binStep = pool.binStep || 10;

      // Get historical data to calculate volatility
      const history = await dataAggregator.getPoolHistory(pool.address, 24);
      const volatility = history.length > 0
        ? dataAggregator.calculateVolatility(history)
        : Math.abs(pool.dexScreener?.priceChange24h || 10);

      // Calculate base bin range
      let binRange = calculateBinRange(binStep, volatility, strategy.type);

      // Adjust bin range based on strategy tightness
      switch (strategy.binTightness) {
        case 'verytight':
          // Extremely tight for quick rotation (50% of normal)
          binRange = Math.max(2, Math.floor(binRange * 0.5));
          break;
        case 'tight':
          // Tight for concentrated liquidity (70% of normal)
          binRange = Math.max(3, Math.floor(binRange * 0.7));
          break;
        case 'medium':
          // Normal range (100%)
          break;
        case 'wide':
          // Wide for slow cook and volatile markets (150% of normal)
          binRange = Math.floor(binRange * 1.5);
          break;
      }

      // Special handling for single-sided strategy
      if (strategy.type === 'singlesided') {
        // Very wide range (-95% for SOL side)
        binRange = Math.floor(binRange * 2.5);
      }

      // Get current active bin (we'll estimate from price)
      // In production, we'd fetch this from DLMM
      const estimatedActiveBin = 8388608; // 2^23, typical middle bin

      // For single-sided, adjust to provide liquidity on one side only
      let lowerBinId, upperBinId;
      if (strategy.type === 'singlesided' && strategy.sidePreference === 'sol') {
        // Provide liquidity below current price (buying side)
        lowerBinId = estimatedActiveBin - binRange;
        upperBinId = estimatedActiveBin;
      } else {
        // Symmetric range
        lowerBinId = estimatedActiveBin - binRange;
        upperBinId = estimatedActiveBin + binRange;
      }

      return {
        lowerBinId,
        upperBinId,
        binRange,
        volatility,
        activeBinEstimate: estimatedActiveBin,
        tightness: strategy.binTightness,
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
        tightness: 'medium',
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
   * Enhanced with single-sided support and dynamic allocation
   */
  calculateTokenAmounts(positionValue, pool, strategy) {
    try {
      const price = pool.dexScreener?.priceUsd || pool.price || 0;

      if (price === 0) {
        throw new Error('Pool price is zero');
      }

      // Strategy-based allocation
      let tokenXPercent = 0.5; // Default 50/50

      // SINGLE-SIDED STRATEGY: Provide only one token
      if (strategy.type === 'singlesided') {
        if (strategy.sidePreference === 'sol') {
          // Only SOL (tokenY)
          tokenXPercent = 0;
        } else {
          // Only base token (tokenX)
          tokenXPercent = 1.0;
        }
      }
      // HEART ATTACK & TIGHT RANGE: Aggressive positioning based on momentum
      else if (strategy.type === 'heartattack' || strategy.type === 'tightrange') {
        const priceChange1h = pool.dexScreener?.priceChange1h || 0;
        if (priceChange1h > 0) {
          // Strong uptrend: More Y token (SOL) to sell into rallies
          tokenXPercent = 0.2;
        } else {
          // Downtrend: More X token (base) to buy dips
          tokenXPercent = 0.8;
        }
      }
      // SLOW COOK: Conservative balanced approach
      else if (strategy.type === 'slowcook') {
        tokenXPercent = 0.5; // Balanced
      }
      // CURVE: Concentrated in middle
      else if (strategy.type === 'curve') {
        tokenXPercent = 0.5;
      }
      // BID-ASK: Depends on trend
      else if (strategy.type === 'bidask') {
        const priceChange24h = pool.dexScreener?.priceChange24h || 0;
        if (priceChange24h > 0) {
          // Uptrend: More Y token (quote) to sell into
          tokenXPercent = 0.3;
        } else {
          // Downtrend: More X token (base) to buy
          tokenXPercent = 0.7;
        }
      }
      // SPOT: Balanced
      else {
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
        isSingleSided: strategy.type === 'singlesided',
        sidePreference: strategy.sidePreference,
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
