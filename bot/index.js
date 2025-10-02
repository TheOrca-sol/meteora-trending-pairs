import cron from 'node-cron';
import config, { validateConfig } from './config/config.js';
import logger from './utils/logger.js';
import database from './models/database.js';
import solanaService from './services/solana.service.js';
import dataAggregator from './services/data-aggregator.service.js';
import scoringService from './services/scoring.service.js';
import strategyService from './services/strategy.service.js';
import riskManager from './services/risk-manager.service.js';
import executionService from './services/execution.service.js';

class MeteoraBot {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.monitoringInterval = null;
    this.stats = {
      totalPositionsEntered: 0,
      totalPositionsExited: 0,
      totalRewardsClaimed: 0,
      errors: 0,
    };
  }

  /**
   * Initialize bot
   */
  async initialize() {
    try {
      logger.info('====================================');
      logger.info('🤖 Meteora DLMM Automation Bot');
      logger.info('====================================');

      // Validate configuration
      validateConfig();
      logger.info('✓ Configuration validated');

      // Initialize database
      await database.initialize();
      logger.info('✓ Database initialized');

      // Initialize Solana connection and wallet
      await solanaService.initialize();
      logger.info('✓ Solana service initialized');

      // Perform initial data fetch
      logger.info('Fetching initial pool data...');
      await dataAggregator.updateAllPools();
      logger.info('✓ Initial pool data loaded');

      // Set bot state
      await database.setBotState('status', 'initialized');
      await database.setBotState('startTime', new Date().toISOString());

      logger.info('✓ Bot initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      throw error;
    }
  }

  /**
   * Start bot operations
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Bot is already running');
        return;
      }

      logger.info('🚀 Starting bot...');
      this.isRunning = true;
      this.isPaused = false;

      await database.setBotState('status', 'running');

      // Schedule data updates every 1 minute
      cron.schedule('*/1 * * * *', async () => {
        if (!this.isPaused) {
          await this.updateData();
        }
      });

      // Schedule position monitoring every 5 minutes
      cron.schedule(`*/${config.bot.rebalanceIntervalMinutes} * * * *`, async () => {
        if (!this.isPaused) {
          await this.monitorPositions();
        }
      });

      // Schedule opportunity scanning every 10 minutes
      cron.schedule('*/10 * * * *', async () => {
        if (!this.isPaused) {
          await this.scanOpportunities();
        }
      });

      // Run initial scan
      await this.scanOpportunities();

      logger.info('✓ Bot started successfully');
      logger.info(`Monitoring interval: ${config.bot.rebalanceIntervalMinutes} minutes`);
      logger.info(`Min TVL: $${config.bot.minTvl}`);
      logger.info(`Min APR: ${config.bot.minApr}%`);
      logger.info(`Max positions: ${config.bot.maxPositions}`);
    } catch (error) {
      logger.error('Failed to start bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Update pool data
   */
  async updateData() {
    try {
      logger.debug('Updating pool data...');
      await dataAggregator.updateAllPools();
      logger.debug('Pool data updated');
    } catch (error) {
      logger.error('Failed to update pool data:', error);
      this.stats.errors++;
    }
  }

  /**
   * Monitor existing positions
   */
  async monitorPositions() {
    try {
      logger.info('Monitoring active positions...');

      const activePositions = await database.getActivePositions();
      logger.info(`Found ${activePositions.length} active positions`);

      for (const position of activePositions) {
        await this.checkPosition(position);
      }
    } catch (error) {
      logger.error('Failed to monitor positions:', error);
      this.stats.errors++;
    }
  }

  /**
   * Check individual position
   */
  async checkPosition(position) {
    try {
      const pool = dataAggregator.getPool(position.pool_address);
      if (!pool) {
        logger.warn(`Pool ${position.pool_address} not found, exiting position`);
        await executionService.exitPosition(position, 'Pool data unavailable');
        return;
      }

      // Check if position should be exited
      const exitCheck = await riskManager.shouldExitPosition(position);
      if (exitCheck.shouldExit) {
        logger.warn(`Exiting position ${position.id}: ${exitCheck.reason}`);
        await executionService.exitPosition(position, exitCheck.reason);
        this.stats.totalPositionsExited++;
        return;
      }

      // Check if should claim rewards
      // TODO: Estimate reward value before claiming
      const estimatedRewards = 0; // Placeholder
      const claimCheck = await riskManager.shouldClaimRewards(position, estimatedRewards);
      if (claimCheck.shouldClaim) {
        logger.info(`Claiming rewards from position ${position.id}`);
        await executionService.claimPositionRewards(
          position,
          position.pool_address,
          position.position_pubkey
        );
        this.stats.totalRewardsClaimed++;
      }

      // Check if needs rebalancing
      const rebalanceCheck = await strategyService.needsRebalancing(position, pool);
      if (rebalanceCheck.needs && rebalanceCheck.urgency === 'high') {
        logger.info(`Rebalancing position ${position.id}: ${rebalanceCheck.reason}`);
        // Exit old position
        await executionService.exitPosition(position, `Rebalancing: ${rebalanceCheck.reason}`);
        this.stats.totalPositionsExited++;

        // Enter new position with updated parameters
        const scores = scoringService.calculatePoolScore(pool);
        const availableCapital = await this.getAvailableCapital();
        const params = await strategyService.createLiquidityParameters(pool, availableCapital, scores);
        await executionService.enterPosition(params);
        this.stats.totalPositionsEntered++;
      }

      logger.debug(`Position ${position.id} check complete`);
    } catch (error) {
      logger.error(`Failed to check position ${position.id}:`, error);
      this.stats.errors++;
    }
  }

  /**
   * Scan for new opportunities
   */
  async scanOpportunities() {
    try {
      logger.info('Scanning for opportunities...');

      // Check if we can enter new positions
      const availableCapital = await this.getAvailableCapital();
      if (availableCapital < 100) {
        logger.info('Insufficient capital for new positions');
        return;
      }

      // Get top pools by score
      const topPools = await scoringService.getTopPools(5);
      logger.info(`Found ${topPools.length} top-rated pools`);

      if (topPools.length === 0) {
        logger.info('No eligible pools found');
        return;
      }

      // Try to enter position in top pool
      const bestPool = topPools[0];
      logger.info(`Best pool: ${bestPool.pairName} (Score: ${bestPool.scores.overall})`);

      // Check if we can enter
      const entryCheck = await riskManager.canEnterNewPosition(availableCapital * 0.2); // Use 20% of available
      if (!entryCheck.canEnter) {
        logger.info(`Cannot enter new position: ${entryCheck.reason}`);
        return;
      }

      // Create liquidity parameters
      const params = await strategyService.createLiquidityParameters(
        bestPool,
        availableCapital,
        bestPool.scores
      );

      // Enter position
      logger.info(`Entering position in ${bestPool.pairName}...`);
      const result = await executionService.enterPosition(params);

      if (result.success) {
        logger.info(`✓ Position entered successfully in ${result.poolName}`);
        this.stats.totalPositionsEntered++;
      } else {
        logger.error(`✗ Failed to enter position: ${result.error}`);
        this.stats.errors++;
      }
    } catch (error) {
      logger.error('Failed to scan opportunities:', error);
      this.stats.errors++;
    }
  }

  /**
   * Get available capital
   */
  async getAvailableCapital() {
    try {
      // Get wallet balance
      const solBalance = await solanaService.getBalance();

      // Convert SOL to USD (rough estimate, TODO: get actual SOL price)
      const solPriceUsd = 100; // Placeholder
      const totalCapitalUsd = solBalance * solPriceUsd;

      // Get active positions value
      const activePositions = await database.getActivePositions();
      const allocatedCapital = activePositions.reduce((sum, pos) => {
        return sum + parseFloat(pos.liquidity_amount || 0);
      }, 0);

      // Calculate available (keeping reserve)
      const reserveAmount = totalCapitalUsd * (config.bot.minReservePercent / 100);
      const availableCapital = totalCapitalUsd - allocatedCapital - reserveAmount;

      logger.debug(`Capital - Total: $${totalCapitalUsd.toFixed(2)}, Allocated: $${allocatedCapital.toFixed(2)}, Available: $${availableCapital.toFixed(2)}`);

      return Math.max(0, availableCapital);
    } catch (error) {
      logger.error('Failed to get available capital:', error);
      return 0;
    }
  }

  /**
   * Pause bot operations
   */
  async pause() {
    logger.info('⏸️  Pausing bot...');
    this.isPaused = true;
    await database.setBotState('status', 'paused');
    logger.info('Bot paused');
  }

  /**
   * Resume bot operations
   */
  async resume() {
    logger.info('▶️  Resuming bot...');
    this.isPaused = false;
    await database.setBotState('status', 'running');
    logger.info('Bot resumed');
  }

  /**
   * Stop bot
   */
  async stop() {
    logger.info('🛑 Stopping bot...');
    this.isRunning = false;
    this.isPaused = true;

    await database.setBotState('status', 'stopped');

    logger.info('Bot stopped');
  }

  /**
   * Emergency stop - exit all positions
   */
  async emergencyStop() {
    logger.warn('🚨 EMERGENCY STOP');

    await this.pause();

    const result = await executionService.emergencyExitAll();
    logger.info(`Emergency exit: ${result.exitedCount}/${result.totalCount} positions closed`);

    await this.stop();
  }

  /**
   * Get bot status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      stats: this.stats,
      lastUpdate: dataAggregator.getLastUpdateTime(),
    };
  }

  /**
   * Print stats
   */
  printStats() {
    logger.info('====================================');
    logger.info('📊 Bot Statistics');
    logger.info('====================================');
    logger.info(`Positions Entered: ${this.stats.totalPositionsEntered}`);
    logger.info(`Positions Exited: ${this.stats.totalPositionsExited}`);
    logger.info(`Rewards Claimed: ${this.stats.totalRewardsClaimed}`);
    logger.info(`Errors: ${this.stats.errors}`);
    logger.info(`Status: ${this.isRunning ? (this.isPaused ? 'Paused' : 'Running') : 'Stopped'}`);
    logger.info('====================================');
  }
}

// Create bot instance
const bot = new MeteoraBot();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('\nReceived SIGINT, shutting down gracefully...');
  await bot.stop();
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\nReceived SIGTERM, shutting down gracefully...');
  await bot.stop();
  await database.close();
  process.exit(0);
});

// Start bot
(async () => {
  try {
    await bot.initialize();
    await bot.start();

    // Print stats every 30 minutes
    setInterval(() => {
      bot.printStats();
    }, 30 * 60 * 1000);
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
})();

export default bot;
