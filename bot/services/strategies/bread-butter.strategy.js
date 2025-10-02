import { BaseStrategy } from './base-strategy.js';

/**
 * Ole Bread 'n Butter Strategy
 * Conservative long-term approach with wide ranges
 * Single-sided positions, minimal monitoring
 */
export class BreadButterStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'breadbutter',
      priority: 20, // Low priority, only if others don't match
      timeframe: 'slow',
      binTightness: 'verywide',
      riskLevel: 'low',
      description: 'Conservative wide-range strategy for stable tokens',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const volume24h = dex.volume24h || 0;
    const tvl = pool.tvl || 0;
    const marketCap = dex.marketCap || 0;

    // Bread & Butter: Established tokens with stable fundamentals
    const isStable =
      priceChange24h < 15 && // Relatively stable
      volume24h > 200000 && // Decent volume
      tvl > 300000 && // Good liquidity
      marketCap > 5000000; // Established project

    // Check for upward potential (not dumping)
    const priceChange7d = dex.priceChange7d || 0;
    const hasUpwardTrend = priceChange7d > -20; // Not in heavy decline

    if (isStable && hasUpwardTrend) {
      return {
        matches: true,
        reason: `Stable fundamentals ($${(marketCap / 1000000).toFixed(1)}M mcap, ${priceChange24h.toFixed(1)}% vol) - Bread & Butter strategy`,
        score: 70,
        metadata: {
          marketCap,
          tvl,
          priceChange24h,
          priceChange7d,
        },
      };
    }

    return { matches: false };
  }

  calculateBinParams(pool, baseBinRange) {
    // Very wide range: up to -74% from current price
    return {
      binRange: Math.floor(baseBinRange * 3),
      tightness: 'verywide',
    };
  }

  calculateTokenAllocation(pool) {
    const dex = pool.dexScreener;
    const priceChange7d = dex?.priceChange7d || 0;

    // Single-sided SOL if token is trending up (DCA accumulation)
    if (priceChange7d > 0) {
      return {
        tokenXPercent: 0,
        isSingleSided: true,
        sidePreference: 'sol',
      };
    }

    // Balanced if neutral/slightly down
    return {
      tokenXPercent: 0.5,
      isSingleSided: false,
    };
  }

  async shouldExitPosition(position, pool) {
    const dex = pool.dexScreener;
    if (!dex) return { shouldExit: false };

    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    const priceChange24h = Math.abs(dex.priceChange24h || 0);

    // Exit after 5 days or if volatility spikes (market changing)
    if (hoursOpen > 120 || priceChange24h > 30) {
      return {
        shouldExit: true,
        reason: `Bread & Butter exit: ${hoursOpen > 120 ? `${(hoursOpen / 24).toFixed(1)} days held` : `Volatility spike ${priceChange24h.toFixed(1)}%`}`,
        urgency: 'low',
      };
    }

    return { shouldExit: false };
  }
}
