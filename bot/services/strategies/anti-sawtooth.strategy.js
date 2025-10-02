import { BaseStrategy } from './base-strategy.js';

/**
 * Anti-Sawtooth (AST) Strategy
 * Counteracts impermanent loss from choppy price movements
 * Uses narrow ranges and frequent rebalancing
 */
export class AntiSawtoothStrategy extends BaseStrategy {
  constructor() {
    super({
      name: 'antisawtooth',
      priority: 60,
      timeframe: 'fast',
      binTightness: 'tight',
      riskLevel: 'medium',
      description: 'Tight range mean-reversion strategy for choppy markets',
    });
  }

  async shouldUse(pool) {
    const dex = pool.dexScreener;
    if (!dex) return { matches: false };

    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const priceChange1h = Math.abs(dex.priceChange1h || 0);
    const volume24h = dex.volume24h || 0;

    // Calculate volatility pattern (choppy = frequent but limited swings)
    const isChoppy =
      priceChange24h > 8 && priceChange24h < 25 && // Moderate overall volatility
      priceChange1h > 2 && priceChange1h < 8 && // Frequent small moves
      volume24h > 500000; // Good liquidity

    // Check for mean-reversion (price bounces within range)
    const buyPercent = this.calculateBuyPercent(dex);
    const isMeanReverting = buyPercent >= 40 && buyPercent <= 60; // Balanced trading

    if (isChoppy && isMeanReverting) {
      return {
        matches: true,
        reason: `Choppy mean-reverting market (${priceChange24h.toFixed(1)}% 24h, ${priceChange1h.toFixed(1)}% 1h) - AST strategy`,
        score: 85,
        metadata: {
          priceChange24h,
          priceChange1h,
          volume24h,
          buyPercent,
        },
      };
    }

    return { matches: false };
  }

  calculateTokenAllocation(pool) {
    // Balanced allocation for mean-reversion
    return {
      tokenXPercent: 0.5,
      isSingleSided: false,
    };
  }

  async shouldExitPosition(position, pool) {
    const dex = pool.dexScreener;
    if (!dex) return { shouldExit: false };

    const priceChange24h = Math.abs(dex.priceChange24h || 0);
    const entryPrice = position.entry_price;
    const currentPrice = dex.priceUsd;
    const priceMove = Math.abs(((currentPrice - entryPrice) / entryPrice) * 100);

    // Exit if breaks out of range (>12%) or volatility drops too low
    if (priceMove > 12 || priceChange24h < 5) {
      return {
        shouldExit: true,
        reason: `AST exit: Price ${priceMove > 12 ? 'broke range' : 'stabilized'} (${priceMove.toFixed(1)}% move, ${priceChange24h.toFixed(1)}% vol)`,
        urgency: priceMove > 12 ? 'high' : 'low',
      };
    }

    // Exit after 8 hours for active rebalancing
    const hoursOpen = (Date.now() - new Date(position.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursOpen > 8) {
      return {
        shouldExit: true,
        reason: `AST rebalance: Position held for ${hoursOpen.toFixed(1)}h`,
        urgency: 'low',
      };
    }

    return { shouldExit: false };
  }

  calculateBuyPercent(dex) {
    const txns24h = dex.txns24h || { buys: 0, sells: 0 };
    const totalTxns = txns24h.buys + txns24h.sells;
    return totalTxns > 0 ? (txns24h.buys / totalTxns) * 100 : 50;
  }
}
