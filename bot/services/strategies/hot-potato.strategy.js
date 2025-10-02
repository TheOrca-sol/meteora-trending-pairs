import { BaseStrategy } from './base-strategy.js';

/**
 * Hot Potato Strategy
 * Short-term fee farming during liquidity surges
 * Quick entry during peak volume, exit before stabilization
 */
export class HotPotatoStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'hotpotato',
      priority: 90, // Very high priority for volume spikes
      timeframe: 'ultrafast',
      binTightness: 'medium',
      riskLevel: 'high',
      description: 'Quick fee farming during volume surges, rapid exits',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const volume1h = dex.volume1h || 0;
    const volume24h = dex.volume24h || 0;
    const priceChange1h = Math.abs(dex.priceChange1h || 0);

    // Calculate volume surge
    const expectedHourlyVol = volume24h / 24;
    const volumeSurge = expectedHourlyVol > 0 ? volume1h / expectedHourlyVol : 0;

    // Hot Potato conditions: Massive volume surge happening NOW
    const isVolumeSurge =
      volume1h > 1000000 && // High absolute volume (>1M/hr)
      volumeSurge > 4 && // 4x expected volume
      priceChange1h > 5; // Significant price movement

    // Additional check: Pool must have sustained interest
    const hasLiquidity = (pool.tvl || 0) > 200000;

    if (isVolumeSurge && hasLiquidity) {
      return {
        matches: true,
        reason: `Volume surge detected (${(volume1h / 1000).toFixed(0)}K/hr, ${volumeSurge.toFixed(1)}x normal) - Hot Potato entry`,
        score: 95,
        metadata: {
          volume1h,
          volumeSurge,
          priceChange1h,
        },
      };
    }

    return { matches: false };
  }

  calculateTokenAllocation(pool) {
    const dex = pool.dexScreener;
    const priceChange1h = dex?.priceChange1h || 0;

    // Aggressive positioning based on momentum
    if (priceChange1h > 0) {
      // Uptrend: More quote token to sell into rally
      return {
        tokenXPercent: 0.25,
        isSingleSided: false,
      };
    } else {
      // Downtrend: More base token to buy dip
      return {
        tokenXPercent: 0.75,
        isSingleSided: false,
      };
    }
  }

  async shouldExitPosition(position, pool) {
    const dex = pool.dexScreener;
    if (!dex) return { shouldExit: true, reason: 'No market data', urgency: 'high' };

    const volume1h = dex.volume1h || 0;
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);

    // Exit if volume drops below threshold
    if (volume1h < 500000) {
      return {
        shouldExit: true,
        reason: `Hot Potato exit: Volume cooled to ${(volume1h / 1000).toFixed(0)}K/hr`,
        urgency: 'high',
      };
    }

    // Exit after 30 minutes (ultra-short hold)
    if (hoursOpen > 0.5) {
      return {
        shouldExit: true,
        reason: `Hot Potato timeout: Held for ${(hoursOpen * 60).toFixed(0)} minutes`,
        urgency: 'medium',
      };
    }

    return { shouldExit: false };
  }
}
