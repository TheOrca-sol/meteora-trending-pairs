import { BaseStrategy } from './base-strategy.js';

/**
 * Overnight DLMM Strategy
 * "Earn while sleeping" - multi-day positions with steady fees
 */
export class OvernightStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'overnight',
      priority: 35,
      timeframe: 'slow',
      binTightness: 'wide',
      riskLevel: 'low',
      description: 'Multi-day passive earning strategy',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const volume24h = dex.volume24h || 0;
    const apr = pool.apr || 0;
    const tvl = pool.tvl || 0;

    // Overnight: Stable, good APR, established pool
    const isGoodOvernightCandidate =
      priceChange24h < 12 && // Stable
      volume24h > 800000 && // Good volume
      apr > 40 && // Decent APR
      tvl > 400000; // Established

    if (isGoodOvernightCandidate) {
      return {
        matches: true,
        reason: `Good overnight candidate (${apr.toFixed(0)}% APR, ${priceChange24h.toFixed(1)}% vol) - Overnight strategy`,
        score: 75,
        metadata: { apr, priceChange24h, volume24h, tvl },
      };
    }

    return { matches: false };
  }

  calculateTokenAllocation(pool) {
    return { tokenXPercent: 0.5, isSingleSided: false };
  }

  async shouldExitPosition(position, pool) {
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    const apr = pool.apr || 0;
    const priceChange24h = Math.abs(pool.dexScreener?.priceChange24h || 0);

    // Exit after 48 hours or if conditions worsen
    if (hoursOpen > 48 || apr < 20 || priceChange24h > 25) {
      return {
        shouldExit: true,
        reason: `Overnight exit: ${hoursOpen > 48 ? 'Duration reached' : 'Conditions changed'}`,
        urgency: 'low',
      };
    }

    return { shouldExit: false };
  }
}
