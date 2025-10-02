import config from '../config/config.js';
import logger from '../utils/logger.js';
import { safeDivide, clamp } from '../utils/helpers.js';
import dataAggregator from './data-aggregator.service.js';

class ScoringService {
  /**
   * Calculate profitability score (0-100)
   */
  calculateProfitabilityScore(pool) {
    let score = 0;

    // APR Score (40 points max)
    // Scale: 50% APR = 20pts, 100% APR = 30pts, 200%+ APR = 40pts
    const apr = pool.apr || 0;
    if (apr >= 200) {
      score += 40;
    } else if (apr >= 100) {
      score += 30 + ((apr - 100) / 100) * 10;
    } else if (apr >= 50) {
      score += 20 + ((apr - 50) / 50) * 10;
    } else {
      score += (apr / 50) * 20;
    }

    // 24h Fees Score (30 points max)
    const fees24h = pool.fees24h || 0;
    const tvl = pool.dexScreener?.liquidity || pool.totalLiquidity || 1;
    const feeVelocity = safeDivide(fees24h, tvl, 0) * 100; // Fee as % of TVL

    if (feeVelocity >= 1) {
      score += 30;
    } else if (feeVelocity >= 0.5) {
      score += 20 + ((feeVelocity - 0.5) / 0.5) * 10;
    } else if (feeVelocity >= 0.1) {
      score += 10 + ((feeVelocity - 0.1) / 0.4) * 10;
    } else {
      score += (feeVelocity / 0.1) * 10;
    }

    // Volume Score (20 points max)
    const volume24h = pool.dexScreener?.volume24h || 0;
    const volumeRatio = safeDivide(volume24h, tvl, 0);

    if (volumeRatio >= 2) {
      score += 20;
    } else if (volumeRatio >= 1) {
      score += 15 + ((volumeRatio - 1) * 5);
    } else if (volumeRatio >= 0.5) {
      score += 10 + ((volumeRatio - 0.5) * 10);
    } else {
      score += volumeRatio * 20;
    }

    // LM Rewards Bonus (10 points max)
    // TODO: Check if pool has active farming rewards
    // For now, assume no farming rewards
    score += 0;

    return clamp(score, 0, 100);
  }

  /**
   * Calculate risk score (0-100, higher is safer)
   */
  calculateRiskScore(pool) {
    let score = 100; // Start with perfect score and deduct points

    // Security Risk (40 points max penalty)
    const secX = pool.security?.tokenX;
    const secY = pool.security?.tokenY;

    if (secX?.riskLevel === 'high' || secY?.riskLevel === 'high') {
      score -= 40; // High risk
    } else if (secX?.riskLevel === 'medium' || secY?.riskLevel === 'medium') {
      score -= 20; // Medium risk
    } else if (secX?.riskLevel === 'low' || secY?.riskLevel === 'low') {
      score -= 5; // Low risk
    }

    // Authority Risk (20 points max penalty)
    if (secX?.hasAuthority) score -= 10;
    if (secY?.hasAuthority) score -= 10;

    // Holder Concentration Risk (20 points max penalty)
    const holders = pool.holders?.tokenX;
    if (holders) {
      if (holders.concentration > 80) {
        score -= 20; // Very concentrated
      } else if (holders.concentration > 60) {
        score -= 15; // Highly concentrated
      } else if (holders.concentration > 40) {
        score -= 10; // Moderately concentrated
      } else if (holders.concentration > 20) {
        score -= 5; // Somewhat concentrated
      }
    }

    // Volatility Risk (10 points max penalty)
    const priceChange24h = Math.abs(pool.dexScreener?.priceChange24h || 0);
    if (priceChange24h > 50) {
      score -= 10; // Extreme volatility
    } else if (priceChange24h > 30) {
      score -= 7; // High volatility
    } else if (priceChange24h > 20) {
      score -= 5; // Moderate volatility
    } else if (priceChange24h > 10) {
      score -= 3; // Low volatility
    }

    // Blacklist (10 points max penalty)
    if (pool.is_blacklisted) {
      score -= 10;
    }

    return clamp(score, 0, 100);
  }

  /**
   * Calculate liquidity health score (0-100)
   */
  calculateLiquidityHealthScore(pool) {
    let score = 0;

    const tvl = pool.dexScreener?.liquidity || pool.totalLiquidity || 0;
    const volume24h = pool.dexScreener?.volume24h || 0;

    // TVL Score (40 points max)
    if (tvl >= 1000000) {
      score += 40; // > $1M
    } else if (tvl >= 500000) {
      score += 35; // $500K - $1M
    } else if (tvl >= 250000) {
      score += 30; // $250K - $500K
    } else if (tvl >= 100000) {
      score += 25; // $100K - $250K
    } else {
      score += (tvl / 100000) * 25;
    }

    // Volume/TVL Ratio Score (30 points max)
    const volumeRatio = safeDivide(volume24h, tvl, 0);
    if (volumeRatio >= 1) {
      score += 30; // Healthy turnover
    } else if (volumeRatio >= 0.5) {
      score += 20 + ((volumeRatio - 0.5) * 20);
    } else if (volumeRatio >= 0.2) {
      score += 10 + ((volumeRatio - 0.2) * 33);
    } else {
      score += volumeRatio * 50;
    }

    // Transaction Activity Score (30 points max)
    const txns24h = pool.dexScreener?.txns24h;
    const totalTxns = (txns24h?.buys || 0) + (txns24h?.sells || 0);

    if (totalTxns >= 1000) {
      score += 30;
    } else if (totalTxns >= 500) {
      score += 25;
    } else if (totalTxns >= 250) {
      score += 20;
    } else if (totalTxns >= 100) {
      score += 15;
    } else if (totalTxns >= 50) {
      score += 10;
    } else {
      score += (totalTxns / 50) * 10;
    }

    return clamp(score, 0, 100);
  }

  /**
   * Calculate market conditions score (0-100)
   */
  calculateMarketConditionsScore(pool) {
    let score = 50; // Start neutral

    const dex = pool.dexScreener;
    if (!dex) return score;

    // Price Trend Score (50 points)
    const priceChange24h = dex.priceChange24h || 0;
    const priceChange1h = dex.priceChange1h || 0;
    const priceChange6h = dex.priceChange6h || 0;

    // Positive trend bonus
    if (priceChange24h > 0 && priceChange6h > 0 && priceChange1h > 0) {
      score += 20; // Consistent uptrend
    } else if (priceChange24h > 0) {
      score += 10; // 24h uptrend
    }

    // Extreme volatility penalty
    if (Math.abs(priceChange24h) > 50) {
      score -= 20; // Too volatile
    } else if (Math.abs(priceChange24h) > 30) {
      score -= 10; // High volatility
    }

    // Buy/Sell Balance Score (50 points)
    const txns24h = dex.txns24h;
    if (txns24h) {
      const total = txns24h.buys + txns24h.sells;
      if (total > 0) {
        const buyPercent = (txns24h.buys / total) * 100;

        // Ideal range: 40-60% (balanced)
        if (buyPercent >= 40 && buyPercent <= 60) {
          score += 30; // Balanced
        } else if (buyPercent >= 50 && buyPercent <= 70) {
          score += 20; // Slightly bullish
        } else if (buyPercent >= 30 && buyPercent <= 80) {
          score += 10; // Acceptable
        } else if (buyPercent > 80 || buyPercent < 20) {
          score -= 10; // Extreme imbalance
        }
      }
    }

    return clamp(score, 0, 100);
  }

  /**
   * Calculate overall score for a pool
   */
  calculatePoolScore(pool) {
    const profitability = this.calculateProfitabilityScore(pool);
    const risk = this.calculateRiskScore(pool);
    const liquidityHealth = this.calculateLiquidityHealthScore(pool);
    const marketConditions = this.calculateMarketConditionsScore(pool);

    const weights = config.scoring;
    const overallScore =
      profitability * weights.profitabilityWeight +
      risk * weights.riskWeight +
      liquidityHealth * weights.liquidityHealthWeight +
      marketConditions * weights.marketConditionsWeight;

    return {
      overall: Math.round(overallScore),
      profitability: Math.round(profitability),
      risk: Math.round(risk),
      liquidityHealth: Math.round(liquidityHealth),
      marketConditions: Math.round(marketConditions),
    };
  }

  /**
   * Score all eligible pools and return sorted by overall score
   */
  async scoreAllPools() {
    try {
      const eligiblePools = dataAggregator.getEligiblePools();
      logger.info(`Scoring ${eligiblePools.length} eligible pools...`);

      const scoredPools = eligiblePools.map(pool => {
        const scores = this.calculatePoolScore(pool);
        return {
          ...pool,
          scores,
        };
      });

      // Sort by overall score (descending)
      scoredPools.sort((a, b) => b.scores.overall - a.scores.overall);

      logger.info(`Scored ${scoredPools.length} pools. Top score: ${scoredPools[0]?.scores.overall || 0}`);

      return scoredPools;
    } catch (error) {
      logger.error('Failed to score pools:', error);
      throw error;
    }
  }

  /**
   * Get top N pools by score
   */
  async getTopPools(limit = 10) {
    const scoredPools = await this.scoreAllPools();
    return scoredPools.slice(0, limit);
  }

  /**
   * Get pool score by address
   */
  getPoolScore(poolAddress) {
    const pool = dataAggregator.getPool(poolAddress);
    if (!pool) {
      throw new Error(`Pool ${poolAddress} not found`);
    }

    return this.calculatePoolScore(pool);
  }

  /**
   * Check if pool meets minimum score threshold
   */
  meetsThreshold(pool, minScore = 60) {
    const scores = this.calculatePoolScore(pool);
    return scores.overall >= minScore;
  }
}

export default new ScoringService();
