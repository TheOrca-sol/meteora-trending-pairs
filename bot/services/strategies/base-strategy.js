/**
 * Base Strategy Class
 * All strategies should extend this class
 */
export class BaseStrategy {
  constructor(config) {
    this.name = config.name || 'unnamed';
    this.priority = config.priority || 50;
    this.timeframe = config.timeframe || 'medium'; // ultrafast, fast, medium, slow
    this.binTightness = config.binTightness || 'medium'; // verytight, tight, medium, wide
    this.riskLevel = config.riskLevel || 'medium'; // low, medium, high
    this.description = config.description || '';
  }

  /**
   * Should this strategy be used for the given pool?
   * Must be implemented by subclass
   * @returns {matches: boolean, reason: string, score?: number, metadata?: object}
   */
  async shouldUse(pool) {
    throw new Error('shouldUse() must be implemented by strategy');
  }

  /**
   * Calculate bin parameters for this strategy
   * Can be overridden by subclass
   */
  calculateBinParams(pool, baseBinRange) {
    let binRange = baseBinRange;

    // Adjust based on binTightness
    switch (this.binTightness) {
      case 'verytight':
        binRange = Math.max(2, Math.floor(binRange * 0.5));
        break;
      case 'tight':
        binRange = Math.max(3, Math.floor(binRange * 0.7));
        break;
      case 'wide':
        binRange = Math.floor(binRange * 1.5);
        break;
      case 'verywide':
        binRange = Math.floor(binRange * 2.5);
        break;
    }

    return {
      binRange,
      tightness: this.binTightness,
    };
  }

  /**
   * Calculate token allocation for this strategy
   * Can be overridden by subclass
   */
  calculateTokenAllocation(pool) {
    // Default 50/50
    return {
      tokenXPercent: 0.5,
      isSingleSided: false,
    };
  }

  /**
   * Check if position should exit based on strategy-specific conditions
   * Can be overridden by subclass
   */
  async shouldExitPosition(position, pool) {
    return { shouldExit: false, reason: 'No strategy-specific exit condition' };
  }

  /**
   * Get strategy metadata
   */
  getMetadata() {
    return {
      name: this.name,
      timeframe: this.timeframe,
      binTightness: this.binTightness,
      riskLevel: this.riskLevel,
      description: this.description,
    };
  }
}
