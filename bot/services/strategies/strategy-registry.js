import logger from '../../utils/logger.js';

/**
 * Strategy Registry - Flexible framework for managing DLMM strategies
 * Allows easy addition of new strategies without modifying core code
 */
class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.strategyPriority = []; // Ordered by evaluation priority
  }

  /**
   * Register a new strategy
   */
  registerStrategy(strategyDefinition) {
    const { name, priority = 50 } = strategyDefinition;

    if (!name) {
      throw new Error('Strategy must have a name');
    }

    if (this.strategies.has(name)) {
      logger.warn(`Strategy ${name} already registered, overwriting`);
    }

    this.strategies.set(name, strategyDefinition);

    // Insert into priority array maintaining sort order
    this.strategyPriority = [...this.strategies.values()]
      .sort((a, b) => (b.priority || 50) - (a.priority || 50));

    logger.info(`✓ Registered strategy: ${name} (priority: ${priority})`);
  }

  /**
   * Evaluate all strategies and return the best match
   */
  async evaluateStrategies(pool) {
    for (const strategy of this.strategyPriority) {
      try {
        const shouldUse = await strategy.shouldUse(pool);

        if (shouldUse.matches) {
          logger.debug(`Strategy ${strategy.name} matched with score ${shouldUse.score || 'N/A'}`);
          return {
            name: strategy.name,
            config: strategy,
            reason: shouldUse.reason,
            metadata: shouldUse.metadata || {},
          };
        }
      } catch (error) {
        logger.error(`Error evaluating strategy ${strategy.name}:`, error);
      }
    }

    // Fallback to default spot strategy
    return {
      name: 'spot',
      config: this.strategies.get('spot'),
      reason: 'No specific strategy matched, using default',
      metadata: {},
    };
  }

  /**
   * Get strategy configuration by name
   */
  getStrategy(name) {
    return this.strategies.get(name);
  }

  /**
   * List all registered strategies
   */
  listStrategies() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get strategy count
   */
  getStrategyCount() {
    return this.strategies.size;
  }
}

export default new StrategyRegistry();
