import { BaseStrategy } from './base-strategy.js';

/**
 * Alpha/Launch Day Strategy
 * Target token launches and high-volume events for 1-5% daily returns
 */
export class AlphaLaunchStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'alphalaunch',
      priority: 95, // Highest priority for launches
      timeframe: 'fast',
      binTightness: 'medium',
      riskLevel: 'high',
      description: 'Launch day and high-volume event strategy',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const volume24h = dex.volume24h || 0;
    const volume1h = dex.volume1h || 0;
    const priceChange1h = Math.abs(dex.priceChange1h || 0);
    const txns24h = dex.txns24h || { buys: 0, sells: 0 };
    const totalTxns = txns24h.buys + txns24h.sells;

    // Detect launch/event: massive volume spike, high activity
    const isLaunchEvent =
      volume24h > 1500000 && // >1.5M volume
      volume1h > 500000 && // Sustained high volume
      totalTxns > 300 && // Very active
      priceChange1h > 8; // Significant movement

    if (isLaunchEvent) {
      return {
        matches: true,
        reason: `Launch/event detected ($${(volume24h / 1000000).toFixed(1)}M vol, ${priceChange1h.toFixed(1)}% 1h) - Alpha strategy`,
        score: 98,
        metadata: { volume24h, volume1h, priceChange1h, totalTxns },
      };
    }

    return { matches: false };
  }

  calculateTokenAllocation(pool) {
    return { tokenXPercent: 0.4, isSingleSided: false };
  }

  async shouldExitPosition(position, pool) {
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    const dex = pool.dexScreener;
    const volume1h = dex?.volume1h || 0;

    if (hoursOpen > 6 || volume1h < 200000) {
      return {
        shouldExit: true,
        reason: `Alpha exit: ${hoursOpen > 6 ? 'Event cooled' : 'Volume dropped'}`,
        urgency: 'high',
      };
    }

    return { shouldExit: false };
  }
}
