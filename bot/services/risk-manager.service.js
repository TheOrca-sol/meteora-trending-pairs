import config from '../config/config.js';
import logger from '../utils/logger.js';
import { calculateImpermanentLoss, calculatePercentChange } from '../utils/helpers.js';
import dataAggregator from './data-aggregator.service.js';
import database from '../models/database.js';

class RiskManagerService {
  /**
   * Check if position should be exited based on risk parameters
   * Enhanced with strategy-specific exit conditions
   */
  async shouldExitPosition(position) {
    try {
      const pool = dataAggregator.getPool(position.pool_address);
      if (!pool) {
        return {
          shouldExit: true,
          reason: 'Pool data not available',
          urgency: 'high',
        };
      }

      // Strategy-specific exit conditions
      const strategyExit = await this.checkStrategySpecificExit(position, pool);
      if (strategyExit.shouldExit) {
        return strategyExit;
      }

      const checks = [
        this.checkImpermanentLoss(position, pool),
        this.checkAprDecline(position, pool),
        this.checkSecurityAlert(position, pool),
        this.checkLiquidityDrain(position, pool),
        this.checkPriceDump(position, pool),
        this.checkBlacklist(position, pool),
      ];

      const results = await Promise.all(checks);

      // Find first failing check
      const failedCheck = results.find(r => r.shouldExit);
      if (failedCheck) {
        logger.warn(`Position ${position.id} should exit: ${failedCheck.reason}`);
        return failedCheck;
      }

      return {
        shouldExit: false,
        reason: 'All risk checks passed',
      };
    } catch (error) {
      logger.error(`Failed to check exit conditions for position ${position.id}:`, error);
      return {
        shouldExit: false,
        reason: 'Error checking exit conditions',
      };
    }
  }

  /**
   * Check strategy-specific exit conditions
   * Based on LP Army battle-tested strategies
   */
  async checkStrategySpecificExit(position, pool) {
    try {
      const strategy = position.strategy;
      const dex = pool.dexScreener;
      if (!dex) return { shouldExit: false };

      // Get position age
      const positionAge = Date.now() - new Date(position.created_at).getTime();
      const hoursOpen = positionAge / (1000 * 60 * 60);

      // HEART ATTACK STRATEGY: Exit on volume drop
      if (strategy === 'heartattack') {
        const volumeMetrics = this.calculateVolumeMetrics(pool);

        // Exit if volume drops below threshold or position age > 1 hour
        if (volumeMetrics.volume5m < 50000 || hoursOpen > 1) {
          return {
            shouldExit: true,
            reason: `Heart Attack exit: Volume dropped to ${(volumeMetrics.volume5m / 1000).toFixed(0)}K or timeout (${hoursOpen.toFixed(1)}h)`,
            urgency: 'high',
          };
        }
      }

      // TIGHT RANGE STRATEGY: Exit if price moves out of range
      if (strategy === 'tightrange') {
        const entryPrice = position.entry_price;
        const currentPrice = dex.priceUsd;
        const priceChange = Math.abs(((currentPrice - entryPrice) / entryPrice) * 100);

        // Exit if price moved > 10% (out of tight range) or position age > 4 hours
        if (priceChange > 10 || hoursOpen > 4) {
          return {
            shouldExit: true,
            reason: `Tight range exit: Price moved ${priceChange.toFixed(1)}% or timeout (${hoursOpen.toFixed(1)}h)`,
            urgency: 'medium',
          };
        }
      }

      // SINGLE-SIDED STRATEGY: Exit when market stabilizes
      if (strategy === 'singlesided') {
        const priceChange24h = Math.abs(dex.priceChange24h || 0);
        const buyPercent = this.calculateBuyPercent(dex);

        // Exit if volatility decreases < 10% or market becomes balanced
        if (priceChange24h < 10 || (buyPercent >= 45 && buyPercent <= 55)) {
          return {
            shouldExit: true,
            reason: `Single-sided exit: Market stabilized (${priceChange24h.toFixed(1)}% vol, ${buyPercent.toFixed(0)}% buys)`,
            urgency: 'low',
          };
        }
      }

      // SLOW COOK STRATEGY: Time-based exit (multi-day hold)
      if (strategy === 'slowcook') {
        // Exit after 3 days or if APR declines significantly
        if (hoursOpen > 72) {
          return {
            shouldExit: true,
            reason: `Slow cook timeout: Position held for ${(hoursOpen / 24).toFixed(1)} days`,
            urgency: 'low',
          };
        }
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check strategy-specific exit:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Calculate volume metrics for strategy checks
   */
  calculateVolumeMetrics(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { volume5m: 0, volume1h: 0, volumeVelocity: 0 };

    const volume1h = dex.volume1h || 0;
    const volume24h = dex.volume24h || 0;
    const volume5m = volume1h / 12;

    const expectedHourlyRatio = 1 / 24;
    const actualHourlyRatio = volume24h > 0 ? volume1h / volume24h : 0;
    const volumeVelocity = actualHourlyRatio / expectedHourlyRatio;

    return { volume5m, volume1h, volume24h, volumeVelocity };
  }

  /**
   * Calculate buy percentage from transaction data
   */
  calculateBuyPercent(dex) {
    const txns24h = dex.txns24h || { buys: 0, sells: 0 };
    const totalTxns = txns24h.buys + txns24h.sells;
    return totalTxns > 0 ? (txns24h.buys / totalTxns) * 100 : 50;
  }

  /**
   * Check impermanent loss threshold
   */
  async checkImpermanentLoss(position, pool) {
    try {
      const entryPrice = position.entry_price;
      const currentPrice = pool.dexScreener?.priceUsd || pool.price;

      if (!entryPrice || !currentPrice) {
        return { shouldExit: false };
      }

      const priceRatio = currentPrice / entryPrice;
      const il = calculateImpermanentLoss(priceRatio);

      if (Math.abs(il) > config.risk.maxImpermanentLossPercent) {
        return {
          shouldExit: true,
          reason: `Impermanent loss ${il.toFixed(2)}% exceeds threshold ${config.risk.maxImpermanentLossPercent}%`,
          urgency: 'high',
          data: { il, priceRatio },
        };
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check impermanent loss:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Check APR decline
   */
  async checkAprDecline(position, pool) {
    try {
      const entryApr = position.entry_apr;
      const currentApr = pool.apr;

      if (!entryApr || !currentApr) {
        return { shouldExit: false };
      }

      const aprDecline = calculatePercentChange(entryApr, currentApr);

      // APR declined significantly (negative change)
      if (aprDecline < -config.risk.maxAprDeclinePercent) {
        return {
          shouldExit: true,
          reason: `APR declined ${Math.abs(aprDecline).toFixed(2)}% from ${entryApr.toFixed(2)}% to ${currentApr.toFixed(2)}%`,
          urgency: 'medium',
          data: { entryApr, currentApr, decline: aprDecline },
        };
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check APR decline:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Check for security alerts
   */
  async checkSecurityAlert(position, pool) {
    try {
      const secX = pool.security?.tokenX;
      const secY = pool.security?.tokenY;

      // Check for high risk rating
      if (secX?.riskLevel === 'high' || secY?.riskLevel === 'high') {
        return {
          shouldExit: true,
          reason: 'Token security risk elevated to HIGH',
          urgency: 'high',
          data: { securityX: secX?.riskLevel, securityY: secY?.riskLevel },
        };
      }

      // Check for new authority (rug pull risk)
      if (secX?.hasAuthority || secY?.hasAuthority) {
        return {
          shouldExit: true,
          reason: 'Token mint/freeze authority detected',
          urgency: 'high',
          data: { hasAuthority: true },
        };
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check security alert:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Check for liquidity drain
   */
  async checkLiquidityDrain(position, pool) {
    try {
      const entryTvl = position.entry_tvl;
      const currentTvl = pool.dexScreener?.liquidity || pool.totalLiquidity;

      if (!entryTvl || !currentTvl) {
        return { shouldExit: false };
      }

      const tvlChange = calculatePercentChange(entryTvl, currentTvl);

      // TVL dropped significantly
      if (tvlChange < -config.risk.maxTvlDropPercent) {
        return {
          shouldExit: true,
          reason: `TVL dropped ${Math.abs(tvlChange).toFixed(2)}% from $${entryTvl.toFixed(0)} to $${currentTvl.toFixed(0)}`,
          urgency: 'high',
          data: { entryTvl, currentTvl, drop: tvlChange },
        };
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check liquidity drain:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Check for sudden price dump
   */
  async checkPriceDump(position, pool) {
    try {
      const dex = pool.dexScreener;
      if (!dex) return { shouldExit: false };

      // Check 1h price change for sudden dumps
      const priceChange1h = dex.priceChange1h || 0;

      if (priceChange1h < -config.risk.maxPriceDropPercent) {
        return {
          shouldExit: true,
          reason: `Price dumped ${Math.abs(priceChange1h).toFixed(2)}% in last hour`,
          urgency: 'high',
          data: { priceChange1h },
        };
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check price dump:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Check if pool became blacklisted
   */
  async checkBlacklist(position, pool) {
    try {
      if (pool.is_blacklisted) {
        return {
          shouldExit: true,
          reason: 'Pool was blacklisted by Meteora',
          urgency: 'high',
          data: { blacklisted: true },
        };
      }

      return { shouldExit: false };
    } catch (error) {
      logger.error('Failed to check blacklist:', error);
      return { shouldExit: false };
    }
  }

  /**
   * Check if new position is within risk limits
   */
  async canEnterNewPosition(positionValue) {
    try {
      // Get active positions
      const activePositions = await database.getActivePositions();

      // Check max positions limit
      if (activePositions.length >= config.bot.maxPositions) {
        return {
          canEnter: false,
          reason: `Maximum ${config.bot.maxPositions} positions already active`,
        };
      }

      // Calculate total exposure
      const totalExposure = activePositions.reduce((sum, pos) => {
        return sum + parseFloat(pos.liquidity_amount || 0);
      }, 0);

      // Get available capital (this should come from wallet balance check)
      // For now, we'll estimate based on config
      const estimatedTotalCapital = 10000; // TODO: Get from actual wallet balance
      const newTotalExposure = totalExposure + positionValue;
      const exposurePercent = (newTotalExposure / estimatedTotalCapital) * 100;

      // Check max exposure limit (90%)
      if (exposurePercent > 90) {
        return {
          canEnter: false,
          reason: `Total exposure would be ${exposurePercent.toFixed(2)}%, exceeds 90% limit`,
        };
      }

      return {
        canEnter: true,
        currentExposure: totalExposure,
        newExposure: newTotalExposure,
        exposurePercent,
      };
    } catch (error) {
      logger.error('Failed to check position entry limits:', error);
      return {
        canEnter: false,
        reason: 'Error checking entry limits',
      };
    }
  }

  /**
   * Check if rewards should be claimed
   */
  async shouldClaimRewards(position, estimatedRewardValue) {
    try {
      // Only claim if reward value exceeds threshold
      if (estimatedRewardValue >= config.bot.claimThresholdUsd) {
        return {
          shouldClaim: true,
          reason: `Rewards worth $${estimatedRewardValue.toFixed(2)} exceed threshold $${config.bot.claimThresholdUsd}`,
        };
      }

      return {
        shouldClaim: false,
        reason: `Rewards worth $${estimatedRewardValue.toFixed(2)} below threshold`,
      };
    } catch (error) {
      logger.error('Failed to check reward claiming:', error);
      return { shouldClaim: false };
    }
  }

  /**
   * Perform comprehensive pre-transaction security check
   */
  async performSecurityCheck(poolAddress) {
    try {
      const pool = dataAggregator.getPool(poolAddress);
      if (!pool) {
        return {
          passed: false,
          reason: 'Pool data not available',
        };
      }

      const checks = [
        // Security checks
        {
          name: 'RugCheck Score',
          passed: pool.security?.tokenX?.riskLevel !== 'high' && pool.security?.tokenY?.riskLevel !== 'high',
          details: `X: ${pool.security?.tokenX?.riskLevel || 'unknown'}, Y: ${pool.security?.tokenY?.riskLevel || 'unknown'}`,
        },
        // Authority checks
        {
          name: 'Token Authority',
          passed: !pool.security?.tokenX?.hasAuthority && !pool.security?.tokenY?.hasAuthority,
          details: 'No mint/freeze authority',
        },
        // Blacklist check
        {
          name: 'Blacklist Status',
          passed: !pool.is_blacklisted,
          details: pool.is_blacklisted ? 'Blacklisted' : 'Not blacklisted',
        },
        // Liquidity check
        {
          name: 'Sufficient Liquidity',
          passed: (pool.totalLiquidity || 0) >= config.bot.minTvl,
          details: `TVL: $${(pool.totalLiquidity || 0).toFixed(0)}`,
        },
        // Holder concentration check
        {
          name: 'Holder Distribution',
          passed: !pool.holders?.tokenX || pool.holders.tokenX.concentration < 80,
          details: `Concentration: ${pool.holders?.tokenX?.concentration?.toFixed(2) || 'unknown'}%`,
        },
      ];

      const failedChecks = checks.filter(c => !c.passed);

      if (failedChecks.length > 0) {
        return {
          passed: false,
          reason: 'Security checks failed',
          failedChecks: failedChecks.map(c => `${c.name}: ${c.details}`),
        };
      }

      return {
        passed: true,
        reason: 'All security checks passed',
        checks: checks.map(c => `${c.name}: ${c.details}`),
      };
    } catch (error) {
      logger.error('Failed to perform security check:', error);
      return {
        passed: false,
        reason: 'Error performing security check',
      };
    }
  }

  /**
   * Calculate position PnL
   */
  async calculatePositionPnL(position, currentPoolData) {
    try {
      const entryValue = parseFloat(position.liquidity_amount || 0);

      // This is simplified - in production you'd calculate exact token values
      const entryPrice = position.entry_price;
      const currentPrice = currentPoolData.dexScreener?.priceUsd || currentPoolData.price;

      if (!entryPrice || !currentPrice) {
        return { pnl: 0, pnlPercent: 0 };
      }

      // Estimate current value (simplified)
      const priceRatio = currentPrice / entryPrice;
      const il = calculateImpermanentLoss(priceRatio);

      // Current value = entry value + fees earned - IL
      const feesEarned = 0; // TODO: Track fees from claims
      const currentValue = entryValue * (1 + (il / 100)) + feesEarned;

      const pnl = currentValue - entryValue;
      const pnlPercent = (pnl / entryValue) * 100;

      return {
        entryValue,
        currentValue,
        pnl,
        pnlPercent,
        il,
        feesEarned,
      };
    } catch (error) {
      logger.error('Failed to calculate position PnL:', error);
      return { pnl: 0, pnlPercent: 0 };
    }
  }
}

export default new RiskManagerService();
