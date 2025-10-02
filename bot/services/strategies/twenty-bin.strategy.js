import { BaseStrategy } from './base-strategy.js';

/**
 * 20 Bin Strategy
 * Smaller bin steps for high-volume, low-volatility markets
 * Captures frequent small price movements
 */
export class TwentyBinStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'twentybin',
      priority: 70,
      timeframe: 'medium',
      binTightness: 'tight',
      riskLevel: 'medium',
      description: 'Small bin steps for high-volume, range-bound markets',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const volume24h = dex.volume24h || 0;
    const marketCap = dex.marketCap || 0;
    const txns24h = dex.txns24h || { buys: 0, sells: 0 };
    const totalTxns = txns24h.buys + txns24h.sells;

    // 20 Bin Strategy: High volume, low volatility, established token
    const isHighVolumeLowVol =
      volume24h > 2000000 && // Very high volume (>2M)
      priceChange24h < 15 && // Low volatility (<15%)
      marketCap > 20000000 && // Established ($20M+ mcap)
      totalTxns > 500; // Active trading

    // Check price is in defined range (not at extremes)
    const price = dex.priceUsd || 0;
    const priceChange7d = Math.abs(dex.priceChange7d || 0);
    const isInRange = priceChange7d < 30; // Not extreme 7d move

    if (isHighVolumeLowVol && isInRange) {
      return {
        matches: true,
        reason: `High-volume stable range ($${(volume24h / 1000000).toFixed(1)}M/24h, ${priceChange24h.toFixed(1)}% vol) - 20 Bin strategy`,
        score: 88,
        metadata: {
          volume24h,
          priceChange24h,
          marketCap,
          totalTxns,
        },
      };
    }

    return { matches: false };
  }

  calculateBinParams(pool, baseBinRange) {
    // Smaller bins to capture more frequent movements
    // Cover at least 25% of price range with tight steps
    return {
      binRange: Math.max(5, Math.floor(baseBinRange * 0.6)),
      tightness: 'tight',
      binStep: 20, // Smaller bin step
    };
  }

  calculateTokenAllocation(pool) {
    // Balanced allocation for range-bound trading
    return {
      tokenXPercent: 0.5,
      isSingleSided: false,
    };
  }

  async shouldExitPosition(position, pool) {
    const dex = pool.dexScreener;
    if (!dex) return { shouldExit: false };

    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const volume24h = dex.volume24h || 0;
    const entryPrice = position.entry_price;
    const currentPrice = dex.priceUsd;
    const priceMove = Math.abs(((currentPrice - entryPrice) / entryPrice) * 100);

    // Exit if breaks range (>25% from entry) or volatility spikes
    if (priceMove > 25 || priceChange24h > 20) {
      return {
        shouldExit: true,
        reason: `20 Bin exit: ${priceMove > 25 ? 'Broke range' : 'Volatility spike'} (${priceMove.toFixed(1)}% move)`,
        urgency: 'high',
      };
    }

    // Exit if volume drops significantly
    if (volume24h < 1000000) {
      return {
        shouldExit: true,
        reason: `20 Bin exit: Volume dropped to $${(volume24h / 1000).toFixed(0)}K`,
        urgency: 'medium',
      };
    }

    // Rebalance after 2 days
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursOpen > 48) {
      return {
        shouldExit: true,
        reason: `20 Bin rebalance: ${(hoursOpen / 24).toFixed(1)} days held`,
        urgency: 'low',
      };
    }

    return { shouldExit: false };
  }
}
