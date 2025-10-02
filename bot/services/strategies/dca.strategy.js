import { BaseStrategy } from './base-strategy.js';

/**
 * DCA (Dollar Cost Averaging) Strategy
 * Single-sided Bid-Ask for accumulation or distribution
 */
export class DCAStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'dca',
      priority: 40,
      timeframe: 'medium',
      binTightness: 'wide',
      riskLevel: 'medium',
      description: 'DCA in/out using single-sided bid-ask',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const priceChange24h = dex.priceChange24h || 0; // Keep sign
    const priceChange7d = dex.priceChange7d || 0;
    const volume24h = dex.volume24h || 0;
    const marketCap = dex.marketCap || 0;

    // DCA: Good fundamentals, clear trend direction
    const isGoodDCACandidate =
      marketCap > 10000000 && // Established
      volume24h > 500000 && // Liquid
      (Math.abs(priceChange24h) > 5 && Math.abs(priceChange24h) < 20); // Trending not crazy

    // Determine DCA direction
    const isDCABuy = priceChange7d < -10; // Down trend = buy
    const isDCASell = priceChange7d > 15; // Up trend = sell

    if (isGoodDCACandidate && (isDCABuy || isDCASell)) {
      return {
        matches: true,
        reason: `DCA ${isDCABuy ? 'accumulation' : 'distribution'} opportunity (${priceChange7d.toFixed(1)}% 7d) - DCA strategy`,
        score: 78,
        metadata: {
          direction: isDCABuy ? 'buy' : 'sell',
          priceChange7d,
          marketCap,
        },
      };
    }

    return { matches: false };
  }

  calculateTokenAllocation(pool) {
    const priceChange7d = pool.dexScreener?.priceChange7d || 0;

    // Single-sided based on direction
    if (priceChange7d < -10) {
      // DCA buy: provide SOL below price
      return {
        tokenXPercent: 0,
        isSingleSided: true,
        sidePreference: 'sol',
      };
    } else {
      // DCA sell: provide token above price
      return {
        tokenXPercent: 1.0,
        isSingleSided: true,
        sidePreference: 'token',
      };
    }
  }

  async shouldExitPosition(position, pool) {
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    const priceChange7d = pool.dexScreener?.priceChange7d || 0;

    // Exit if trend reverses or after 5 days
    const trendReversed =
      (position.metadata?.direction === 'buy' && priceChange7d > 5) ||
      (position.metadata?.direction === 'sell' && priceChange7d < -5);

    if (trendReversed || hoursOpen > 120) {
      return {
        shouldExit: true,
        reason: `DCA exit: ${trendReversed ? 'Trend reversed' : 'Duration complete'}`,
        urgency: 'low',
      };
    }

    return { shouldExit: false };
  }
}
