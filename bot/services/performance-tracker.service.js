import logger from '../utils/logger.js';
import database from '../models/database.js';

/**
 * Performance Tracker Service
 * Tracks and analyzes strategy performance metrics
 */
class PerformanceTrackerService {
  constructor() {
    this.performanceCache = new Map();
    this.lastCacheUpdate = null;
  }

  /**
   * Track position entry with strategy metadata
   */
  async trackPositionEntry(position, strategy, metadata = {}) {
    try {
      await database.pool.query(
        `UPDATE positions
         SET metadata = $1,
             strategy_priority = $2,
             strategy_risk_level = $3
         WHERE id = $4`,
        [
          JSON.stringify({
            ...metadata,
            strategyName: strategy.type,
            timeframe: strategy.timeframe,
            binTightness: strategy.binTightness,
            riskLevel: strategy.riskLevel,
            entryReason: strategy.reason,
          }),
          strategy.metadata?.priority || 50,
          strategy.riskLevel || 'medium',
          position.id,
        ]
      );

      logger.debug(`Tracked entry for position ${position.id} with strategy ${strategy.type}`);
    } catch (error) {
      logger.error('Failed to track position entry:', error);
    }
  }

  /**
   * Calculate strategy performance metrics
   */
  async getStrategyPerformance(strategyName, timeframe = '7d') {
    try {
      const daysBack = this.parseDaysFromTimeframe(timeframe);
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      // Get all positions using this strategy
      const result = await database.pool.query(
        `SELECT
          id, strategy, status, created_at, updated_at,
          entry_price, liquidity_amount,
          metadata
         FROM positions
         WHERE strategy = $1
           AND created_at >= $2
         ORDER BY created_at DESC`,
        [strategyName, cutoffDate]
      );

      const positions = result.rows;
      if (positions.length === 0) {
        return this.getEmptyPerformance(strategyName);
      }

      // Calculate metrics
      const metrics = await this.calculateMetrics(positions);

      return {
        strategy: strategyName,
        timeframe,
        ...metrics,
      };
    } catch (error) {
      logger.error(`Failed to get performance for ${strategyName}:`, error);
      return this.getEmptyPerformance(strategyName);
    }
  }

  /**
   * Calculate detailed metrics for positions
   */
  async calculateMetrics(positions) {
    const total = positions.length;
    const active = positions.filter(p => p.status === 'active').length;
    const closed = positions.filter(p => p.status === 'closed').length;

    // Calculate hold times
    const holdTimes = positions
      .filter(p => p.status === 'closed')
      .map(p => {
        const entry = new Date(p.created_at);
        const exit = new Date(p.updated_at);
        return (exit - entry) / (1000 * 60 * 60); // Hours
      });

    const avgHoldTime = holdTimes.length > 0
      ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
      : 0;

    // Calculate total capital deployed
    const totalCapital = positions.reduce((sum, p) => {
      return sum + parseFloat(p.liquidity_amount || 0);
    }, 0);

    // Get events for these positions (for fee tracking)
    const positionIds = positions.map(p => p.id);
    const eventsResult = await database.pool.query(
      `SELECT position_id, event_type, data
       FROM events
       WHERE position_id = ANY($1)
         AND event_type IN ('rewards_claimed', 'paper_rewards_claimed')`,
      [positionIds]
    );

    const totalFeesEarned = eventsResult.rows.reduce((sum, event) => {
      // Estimate fees (placeholder until we track actual amounts)
      return sum + 10; // TODO: Extract actual fee amounts
    }, 0);

    // Calculate win rate (positions that earned fees vs didn't)
    const positionsWithFees = new Set(eventsResult.rows.map(e => e.position_id));
    const winRate = closed > 0 ? (positionsWithFees.size / closed) * 100 : 0;

    // Parse metadata for additional insights
    const timeframes = {};
    const riskLevels = {};

    positions.forEach(p => {
      if (p.metadata) {
        const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
        const tf = meta.timeframe || 'unknown';
        const risk = meta.riskLevel || 'unknown';

        timeframes[tf] = (timeframes[tf] || 0) + 1;
        riskLevels[risk] = (riskLevels[risk] || 0) + 1;
      }
    });

    return {
      totalPositions: total,
      activePositions: active,
      closedPositions: closed,
      winRate: winRate.toFixed(1),
      avgHoldTimeHours: avgHoldTime.toFixed(1),
      totalCapitalDeployed: totalCapital.toFixed(2),
      totalFeesEarned: totalFeesEarned.toFixed(2),
      feeYield: totalCapital > 0 ? ((totalFeesEarned / totalCapital) * 100).toFixed(2) : '0.00',
      timeframeDistribution: timeframes,
      riskLevelDistribution: riskLevels,
    };
  }

  /**
   * Get strategy leaderboard
   */
  async getStrategyLeaderboard(timeframe = '7d', limit = 10) {
    try {
      const daysBack = this.parseDaysFromTimeframe(timeframe);
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

      // Get all strategies used in timeframe
      const strategiesResult = await database.pool.query(
        `SELECT DISTINCT strategy
         FROM positions
         WHERE created_at >= $1`,
        [cutoffDate]
      );

      const strategies = strategiesResult.rows.map(r => r.strategy);

      // Calculate performance for each
      const leaderboard = await Promise.all(
        strategies.map(async strategy => {
          const perf = await this.getStrategyPerformance(strategy, timeframe);
          return {
            strategy,
            score: this.calculateScore(perf),
            ...perf,
          };
        })
      );

      // Sort by score
      leaderboard.sort((a, b) => b.score - a.score);

      return leaderboard.slice(0, limit);
    } catch (error) {
      logger.error('Failed to generate leaderboard:', error);
      return [];
    }
  }

  /**
   * Calculate overall strategy score
   */
  calculateScore(performance) {
    const {
      totalPositions,
      winRate,
      feeYield,
      closedPositions,
    } = performance;

    // Score formula: weighted combination of metrics
    const positionWeight = Math.min(totalPositions / 10, 1) * 20; // Up to 20 points
    const winRateWeight = (parseFloat(winRate) / 100) * 40; // Up to 40 points
    const yieldWeight = Math.min(parseFloat(feeYield) / 10, 1) * 40; // Up to 40 points

    return Math.round(positionWeight + winRateWeight + yieldWeight);
  }

  /**
   * Generate comprehensive performance report
   */
  async generateReport(timeframe = '24h') {
    try {
      const leaderboard = await this.getStrategyLeaderboard(timeframe, 15);

      const report = {
        timeframe,
        generatedAt: new Date().toISOString(),
        totalStrategies: leaderboard.length,
        leaderboard,
        summary: {
          totalPositions: leaderboard.reduce((sum, s) => sum + s.totalPositions, 0),
          activePositions: leaderboard.reduce((sum, s) => sum + s.activePositions, 0),
          totalCapital: leaderboard.reduce((sum, s) => sum + parseFloat(s.totalCapitalDeployed), 0).toFixed(2),
          totalFees: leaderboard.reduce((sum, s) => sum + parseFloat(s.totalFeesEarned), 0).toFixed(2),
        },
        topStrategies: leaderboard.slice(0, 3).map(s => ({
          name: s.strategy,
          score: s.score,
          positions: s.totalPositions,
          winRate: s.winRate + '%',
        })),
      };

      return report;
    } catch (error) {
      logger.error('Failed to generate report:', error);
      return null;
    }
  }

  /**
   * Get empty performance object
   */
  getEmptyPerformance(strategy) {
    return {
      strategy,
      totalPositions: 0,
      activePositions: 0,
      closedPositions: 0,
      winRate: '0.0',
      avgHoldTimeHours: '0.0',
      totalCapitalDeployed: '0.00',
      totalFeesEarned: '0.00',
      feeYield: '0.00',
      timeframeDistribution: {},
      riskLevelDistribution: {},
    };
  }

  /**
   * Parse days from timeframe string
   */
  parseDaysFromTimeframe(timeframe) {
    const match = timeframe.match(/(\d+)([hdwm])/);
    if (!match) return 7; // Default 7 days

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'h': return num / 24;
      case 'd': return num;
      case 'w': return num * 7;
      case 'm': return num * 30;
      default: return 7;
    }
  }
}

export default new PerformanceTrackerService();
