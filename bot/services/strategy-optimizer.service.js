import logger from '../utils/logger.js';
import database from '../models/database.js';
import strategyRegistry from './strategies/index.js';
import performanceTracker from './performance-tracker.service.js';

/**
 * Strategy Optimizer Service
 * Monitors position performance and recommends/executes strategy switches
 */
class StrategyOptimizerService {
  constructor() {
    this.optimizationCache = new Map();
    this.switchCooldowns = new Map(); // Prevent rapid switching
    this.minHoldTimeMinutes = 30; // Minimum time before considering switch
    this.switchThresholdScore = 20; // Score difference required to switch
  }

  /**
   * Evaluate if position should switch strategies
   */
  async evaluatePositionOptimization(position, currentPool) {
    try {
      // Check if position is old enough to consider switching
      const positionAge = this.getPositionAgeMinutes(position);
      if (positionAge < this.minHoldTimeMinutes) {
        return {
          shouldSwitch: false,
          reason: `Position too new (${positionAge.toFixed(0)}m < ${this.minHoldTimeMinutes}m minimum)`,
        };
      }

      // Check cooldown (prevent switching too frequently)
      const cooldownKey = `${position.id}`;
      const lastSwitch = this.switchCooldowns.get(cooldownKey);
      if (lastSwitch && Date.now() - lastSwitch < 60 * 60 * 1000) {
        return {
          shouldSwitch: false,
          reason: 'Switch cooldown active (1 hour)',
        };
      }

      // Get current strategy performance
      const currentStrategy = position.strategy;
      const currentPerf = await performanceTracker.getStrategyPerformance(currentStrategy, '24h');
      const currentScore = performanceTracker.calculateScore(currentPerf);

      // Evaluate what strategy would be chosen now
      const bestStrategy = await strategyRegistry.evaluateStrategies(currentPool);

      // If same strategy, no need to switch
      if (bestStrategy.name === currentStrategy) {
        return {
          shouldSwitch: false,
          reason: 'Current strategy is still optimal',
          currentStrategy,
          currentScore,
        };
      }

      // Get performance of the suggested strategy
      const suggestedPerf = await performanceTracker.getStrategyPerformance(bestStrategy.name, '24h');
      const suggestedScore = performanceTracker.calculateScore(suggestedPerf);

      // Calculate score difference
      const scoreDiff = suggestedScore - currentScore;

      // Check if improvement is significant enough
      if (scoreDiff < this.switchThresholdScore) {
        return {
          shouldSwitch: false,
          reason: `Score improvement too small (${scoreDiff} < ${this.switchThresholdScore} threshold)`,
          currentStrategy,
          currentScore,
          suggestedStrategy: bestStrategy.name,
          suggestedScore,
          scoreDiff,
        };
      }

      // Check market conditions changed significantly
      const conditionsChanged = await this.haveConditionsChangedSignificantly(position, currentPool);

      // Recommend switch
      return {
        shouldSwitch: true,
        reason: bestStrategy.reason,
        currentStrategy,
        currentScore,
        suggestedStrategy: bestStrategy.name,
        suggestedScore,
        scoreDiff,
        conditionsChanged,
        confidence: this.calculateSwitchConfidence(scoreDiff, conditionsChanged, currentPerf, suggestedPerf),
      };
    } catch (error) {
      logger.error('Error evaluating position optimization:', error);
      return {
        shouldSwitch: false,
        reason: 'Evaluation error',
      };
    }
  }

  /**
   * Check if market conditions changed significantly since entry
   */
  async haveConditionsChangedSignificantly(position, currentPool) {
    try {
      // Parse metadata to get entry conditions
      let metadata = position.metadata;
      if (typeof metadata === 'string') {
        metadata = JSON.parse(metadata);
      }

      if (!metadata || !metadata.scoresSnapshot) {
        return { changed: false, reason: 'No baseline data' };
      }

      const entryScores = metadata.scoresSnapshot;
      const currentScores = currentPool.scores || {};

      // Compare key metrics
      const changes = {
        profitability: Math.abs((currentScores.profitability || 0) - (entryScores.profitability || 0)),
        risk: Math.abs((currentScores.risk || 0) - (entryScores.risk || 0)),
        liquidity: Math.abs((currentScores.liquidityHealth || 0) - (entryScores.liquidityHealth || 0)),
      };

      // Check if any metric changed by >20 points
      const significantChange = Object.entries(changes).find(([key, change]) => change > 20);

      if (significantChange) {
        return {
          changed: true,
          metric: significantChange[0],
          change: significantChange[1],
        };
      }

      // Check price movement
      const priceChange = position.entry_price
        ? Math.abs(((currentPool.price - position.entry_price) / position.entry_price) * 100)
        : 0;

      if (priceChange > 25) {
        return {
          changed: true,
          metric: 'price',
          change: priceChange,
        };
      }

      return { changed: false };
    } catch (error) {
      logger.error('Error checking condition changes:', error);
      return { changed: false, reason: 'Check error' };
    }
  }

  /**
   * Calculate confidence score for switch recommendation (0-100)
   */
  calculateSwitchConfidence(scoreDiff, conditionsChanged, currentPerf, suggestedPerf) {
    let confidence = 50; // Base confidence

    // Score difference contribution (0-30 points)
    confidence += Math.min(scoreDiff / 2, 30);

    // Conditions changed adds confidence (0-20 points)
    if (conditionsChanged.changed) {
      confidence += Math.min(conditionsChanged.change || 10, 20);
    }

    // Historical performance adds confidence (0-20 points)
    if (suggestedPerf.totalPositions > 5) {
      const winRateDiff = parseFloat(suggestedPerf.winRate) - parseFloat(currentPerf.winRate);
      confidence += Math.min(winRateDiff / 2, 20);
    }

    // Position count penalty if suggested strategy is new
    if (suggestedPerf.totalPositions < 3) {
      confidence -= 15;
    }

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Get all optimization opportunities
   */
  async scanAllPositionsForOptimization(positions, poolsMap) {
    const opportunities = [];

    for (const position of positions) {
      const pool = poolsMap.get(position.pool_address);
      if (!pool) continue;

      const evaluation = await this.evaluatePositionOptimization(position, pool);

      if (evaluation.shouldSwitch && evaluation.confidence >= 60) {
        opportunities.push({
          position,
          pool,
          evaluation,
        });
      }
    }

    // Sort by score difference (highest first)
    opportunities.sort((a, b) => b.evaluation.scoreDiff - a.evaluation.scoreDiff);

    return opportunities;
  }

  /**
   * Record strategy switch for cooldown
   */
  recordStrategySwitch(positionId) {
    this.switchCooldowns.set(`${positionId}`, Date.now());
  }

  /**
   * Get position age in minutes
   */
  getPositionAgeMinutes(position) {
    const entryTime = new Date(position.entry_timestamp || position.created_at);
    return (Date.now() - entryTime.getTime()) / (1000 * 60);
  }

  /**
   * Calculate estimated opportunity cost of not switching
   */
  calculateOpportunityCost(evaluation, position) {
    try {
      const holdTimeHours = this.getPositionAgeMinutes(position) / 60;
      const scoreDiffPerHour = evaluation.scoreDiff / Math.max(holdTimeHours, 1);

      // Estimate potential additional fees (rough approximation)
      const currentYield = parseFloat(evaluation.currentScore) / 100;
      const suggestedYield = parseFloat(evaluation.suggestedScore) / 100;
      const yieldDiff = suggestedYield - currentYield;

      const positionValue = parseFloat(position.liquidity_amount || 0);
      const opportunityCostUsd = positionValue * (yieldDiff / 100);

      return {
        scoreDiffPerHour: scoreDiffPerHour.toFixed(2),
        estimatedCostUsd: opportunityCostUsd.toFixed(2),
      };
    } catch (error) {
      return {
        scoreDiffPerHour: '0.00',
        estimatedCostUsd: '0.00',
      };
    }
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport(timeframe = '1h') {
    try {
      const activePositions = await database.getActivePositions();

      if (activePositions.length === 0) {
        return {
          totalPositions: 0,
          opportunities: [],
          summary: 'No active positions to optimize',
        };
      }

      // Build pools map
      const dataAggregator = (await import('./data-aggregator.service.js')).default;
      const poolsMap = new Map();
      for (const pos of activePositions) {
        const pool = dataAggregator.getPool(pos.pool_address);
        if (pool) poolsMap.set(pos.pool_address, pool);
      }

      // Scan for opportunities
      const opportunities = await this.scanAllPositionsForOptimization(activePositions, poolsMap);

      // Calculate total potential gains
      const totalPotentialGain = opportunities.reduce((sum, opp) => {
        return sum + opp.evaluation.scoreDiff;
      }, 0);

      return {
        totalPositions: activePositions.length,
        opportunitiesFound: opportunities.length,
        opportunities: opportunities.slice(0, 5), // Top 5
        totalPotentialGain: totalPotentialGain.toFixed(0),
        summary: opportunities.length > 0
          ? `${opportunities.length} optimization opportunities found`
          : 'All positions using optimal strategies',
      };
    } catch (error) {
      logger.error('Error generating optimization report:', error);
      return {
        totalPositions: 0,
        opportunities: [],
        summary: 'Error generating report',
      };
    }
  }
}

export default new StrategyOptimizerService();
