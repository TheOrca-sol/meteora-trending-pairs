import { BaseStrategy } from './base-strategy.js';

/**
 * Volume Hunter Strategy
 * Hunt for explosive volume moments, different from Heart Attack
 * Focus on sustained volume vs sudden spikes
 */
export class VolumeHunterStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'volumehunter',
      priority: 75,
      timeframe: 'fast',
      binTightness: 'medium',
      riskLevel: 'high',
      description: 'Sustained high-volume trading strategy',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const volume1h = dex.volume1h || 0;
    const volume24h = dex.volume24h || 0;
    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const txns24h = dex.txns24h || { buys: 0, sells: 0 };
    const totalTxns = txns24h.buys + txns24h.sells;

    // Different from Heart Attack: sustained high volume, not sudden spike
    const isSustainedVolume =
      volume24h > 3000000 && // Very high 24h volume
      volume1h > 200000 && // Sustained (not spike)
      totalTxns > 400 && // Lots of transactions
      priceChange24h > 10 && priceChange24h < 40; // Volatile but not crazy

    if (isSustainedVolume) {
      return {
        matches: true,
        reason: `Sustained high volume ($${(volume24h / 1000000).toFixed(1)}M/24h) - Volume Hunter strategy`,
        score: 86,
        metadata: { volume24h, volume1h, totalTxns, priceChange24h },
      };
    }

    return { matches: false };
  }

  calculateTokenAllocation(pool) {
    return { tokenXPercent: 0.45, isSingleSided: false };
  }

  async shouldExitPosition(position, pool) {
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    const volume24h = pool.dexScreener?.volume24h || 0;

    if (hoursOpen > 12 || volume24h < 1500000) {
      return {
        shouldExit: true,
        reason: `Volume Hunter exit: ${hoursOpen > 12 ? 'Timeout' : 'Volume declined'}`,
        urgency: 'medium',
      };
    }

    return { shouldExit: false };
  }
}
