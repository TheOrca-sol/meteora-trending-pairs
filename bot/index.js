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
import notificationService from './services/notification.service.js';
import performanceTracker from './services/performance-tracker.service.js';
import strategyOptimizer from './services/strategy-optimizer.service.js';
import priceFeed from './services/price-feed.service.js';

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

    // Signal tracking cache to prevent duplicates
    this.signalCache = new Map(); // poolAddress -> { timestamp, apr, tvl, score }
    this.lastTopPools = new Set(); // Pool addresses from last scan
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

      // Initialize notifications (pass bot instance for commands)
      notificationService.initialize(this);

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

      // Schedule opportunity scanning every 1 minute
      cron.schedule('*/1 * * * *', async () => {
        if (!this.isPaused) {
          await this.scanOpportunities();
        }
      });

      // Run initial scan
      await this.scanOpportunities();

      // Send start notification
      await notificationService.notifyBotStarted();

      logger.info('✓ Bot started successfully');
      logger.warn('⚠️  SIGNAL MODE - Bot will send manual entry notifications (DLMM SDK not yet implemented)');
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
        const pnl = await riskManager.calculatePositionPnL(position, pool);
        const result = await executionService.exitPosition(position, exitCheck.reason);
        if (result.success) {
          await notificationService.notifyPositionExited(position, exitCheck.reason, pnl);
        }
        this.stats.totalPositionsExited++;
        return;
      }

      // Check if should claim rewards (with profitability analysis)
      const claimCheck = await riskManager.shouldClaimRewards(position, pool);
      if (claimCheck.shouldClaim) {
        logger.info(`Claiming rewards from position ${position.id}: ${claimCheck.reason}`);
        logger.info(`  Estimated fees: $${claimCheck.estimatedFeesUsd?.toFixed(4)}, Gas: $${claimCheck.estimatedGasCostUsd?.toFixed(4)}, Net: $${claimCheck.netProfit?.toFixed(4)}`);

        const result = await executionService.claimPositionRewards(
          position,
          position.pool_address,
          position.position_pubkey
        );

        if (result.success && result.signatures) {
          await notificationService.notifyRewardsClaimed(position, result.signatures, claimCheck);
        }
        this.stats.totalRewardsClaimed++;
      } else if (claimCheck.estimatedFeesUsd) {
        logger.debug(`Skipping claim for position ${position.id}: ${claimCheck.reason}`);
      }

      // Check if should switch strategies (optimization)
      const optimizationCheck = await strategyOptimizer.evaluatePositionOptimization(position, pool);
      if (optimizationCheck.shouldSwitch && optimizationCheck.confidence >= 70) {
        logger.info(`Strategy switch recommended for position ${position.id}:`);
        logger.info(`  Current: ${optimizationCheck.currentStrategy} (score: ${optimizationCheck.currentScore})`);
        logger.info(`  Suggested: ${optimizationCheck.suggestedStrategy} (score: ${optimizationCheck.suggestedScore})`);
        logger.info(`  Confidence: ${optimizationCheck.confidence}% | Score diff: +${optimizationCheck.scoreDiff}`);
        logger.info(`  Reason: ${optimizationCheck.reason}`);

        // Record switch decision
        await database.logEvent(
          'strategy_switch_recommended',
          position.id,
          position.pool_address,
          `Switch from ${optimizationCheck.currentStrategy} to ${optimizationCheck.suggestedStrategy}`,
          {
            ...optimizationCheck,
            actionTaken: 'switch_executed',
          }
        );

        // Exit old position
        await executionService.exitPosition(position, `Strategy optimization: switching to ${optimizationCheck.suggestedStrategy}`);
        this.stats.totalPositionsExited++;

        // Record the switch
        strategyOptimizer.recordStrategySwitch(position.id);

        // Enter new position with optimized strategy
        const scores = scoringService.calculatePoolScore(pool);
        const availableCapital = await this.getAvailableCapital();
        const params = await strategyService.createLiquidityParameters(pool, availableCapital, scores);
        const result = await executionService.enterPosition(params);

        if (result.success) {
          await notificationService.notifyStrategySwitch(position, optimizationCheck);
          this.stats.totalPositionsEntered++;
        }

        return; // Skip rebalancing check after strategy switch
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

      // SIGNAL MODE: Get reference capital for position sizing (using simulated capital)
      const referenceCapital = 1000; // Reference amount for position size calculations
      logger.info(`Signal mode: Using $${referenceCapital} reference capital for recommendations`);

      // Get top pools by score
      const topPools = await scoringService.getTopPools(10);
      logger.info(`Found ${topPools.length} top-rated pools`);

      if (topPools.length === 0) {
        logger.info('No eligible pools found');
        return;
      }

      // Track current top pools
      const currentTopPools = new Set(topPools.map(p => p.address));

      // Clean up old signals (older than 24 hours)
      const now = Date.now();
      const SIGNAL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
      for (const [poolAddress, data] of this.signalCache.entries()) {
        if (now - data.timestamp > SIGNAL_CACHE_TTL) {
          this.signalCache.delete(poolAddress);
          logger.debug(`Removed stale signal cache for ${poolAddress}`);
        }
      }

      // SIGNAL MODE: Send signals for new/changed pools only
      let signalsSent = 0;
      let skippedDuplicates = 0;

      for (const pool of topPools) {
        try {
          const tvl = pool.tvl || pool.totalLiquidity || 0;
          const apr = pool.apr || 0;
          const score = pool.scores?.overall || 0;

          // Check if we should send signal for this pool
          const shouldSignal = this.shouldSendSignal(pool.address, tvl, apr, score, currentTopPools);

          if (!shouldSignal.send) {
            logger.debug(`Skipping ${pool.pairName}: ${shouldSignal.reason}`);
            skippedDuplicates++;
            continue;
          }

          logger.info(`Evaluating pool: ${pool.pairName} (Score: ${score}) - ${shouldSignal.reason}`);

          // Calculate base position size (20% of reference capital)
          const basePositionSize = referenceCapital * 0.2;

          // Apply volatility-based sizing
          const sizeAdjustment = riskManager.calculateVolatilityAdjustedSize(pool, basePositionSize);
          const adjustedPositionSize = sizeAdjustment.adjustedSize || basePositionSize;

          if (sizeAdjustment.volatility) {
            logger.info(`Volatility adjustment: ${sizeAdjustment.volatility.toFixed(1)}% → ${(sizeAdjustment.multiplier * 100).toFixed(0)}% size ($${adjustedPositionSize.toFixed(2)})`);
          }

          // Create liquidity parameters
          const params = await strategyService.createLiquidityParameters(
            pool,
            referenceCapital,
            pool.scores
          );

          // Send manual entry signal to Telegram
          await this.sendManualEntrySignal(pool, params);
          signalsSent++;

          // Cache this signal
          this.signalCache.set(pool.address, {
            timestamp: now,
            apr,
            tvl,
            score,
          });

          logger.info(`📊 Signal #${signalsSent} sent for ${pool.pairName}`);

          // Add small delay between signals to avoid rate limiting
          if (signalsSent < topPools.length) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          logger.error(`Failed to process pool ${pool.pairName}:`, error);
        }
      }

      // Update last top pools for next scan
      this.lastTopPools = currentTopPools;

      logger.info(`✓ Sent ${signalsSent} new signals, skipped ${skippedDuplicates} duplicates`);
      return;

      // COMMENTED OUT - Will be re-enabled when DLMM SDK is implemented
      /*
      // Enter position
      logger.info(`Entering position in ${bestPool.pairName}...`);
      const result = await executionService.enterPosition(params);

      if (result.success) {
        logger.info(`✓ Position entered successfully in ${result.poolName}`);

        // Track position entry with performance tracker
        if (result.positionId) {
          await performanceTracker.trackPositionEntry(
            { id: result.positionId },
            {
              type: params.strategy,
              timeframe: params.strategyMetadata?.timeframe || 'medium',
              binTightness: params.strategyMetadata?.binTightness || 'medium',
              riskLevel: params.strategyMetadata?.riskLevel || 'medium',
              reason: params.strategyReason,
              metadata: params.strategyMetadata,
            },
            {
              poolAddress: result.poolAddress,
              entryPrice: params.entryPrice,
              entryApr: params.entryApr,
              entryTvl: bestPool.tvl,
              scoresSnapshot: bestPool.scores,
            }
          );
        }

        await notificationService.notifyPositionEntered({
          ...result,
          positionValue: params.positionValue,
          strategy: params.strategy,
          strategyReason: params.strategyReason,
          entryApr: params.entryApr,
        });
        this.stats.totalPositionsEntered++;
      } else {
        logger.error(`✗ Failed to enter position: ${result.error}`);
        await notificationService.notifyError('Position Entry Failed', result.error);
        this.stats.errors++;
      }
      */
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
      let totalCapitalUsd;

      if (config.bot.paperTrading) {
        // Paper trading: Use simulated starting capital
        totalCapitalUsd = config.bot.paperTradingStartingCapital;
      } else {
        // Live trading: Get wallet balance with real SOL price
        const solBalance = await solanaService.getBalance();
        const solPriceUsd = await priceFeed.getSolPrice();
        totalCapitalUsd = solBalance * solPriceUsd;

        logger.debug(`Live wallet: ${solBalance.toFixed(4)} SOL × $${solPriceUsd.toFixed(2)} = $${totalCapitalUsd.toFixed(2)}`);
      }

      // Get active positions value
      const activePositions = await database.getActivePositions();
      const allocatedCapital = activePositions.reduce((sum, pos) => {
        return sum + parseFloat(pos.liquidity_amount || 0);
      }, 0);

      // Calculate available (keeping reserve)
      const reserveAmount = totalCapitalUsd * (config.bot.minReservePercent / 100);
      const availableCapital = totalCapitalUsd - allocatedCapital - reserveAmount;

      const mode = config.bot.paperTrading ? '[PAPER]' : '[LIVE]';
      logger.debug(`${mode} Capital - Total: $${totalCapitalUsd.toFixed(2)}, Allocated: $${allocatedCapital.toFixed(2)}, Available: $${availableCapital.toFixed(2)}`);

      return Math.max(0, availableCapital);
    } catch (error) {
      logger.error('Failed to get available capital:', error);
      return 0;
    }
  }

  /**
   * Check if signal should be sent for a pool
   */
  shouldSendSignal(poolAddress, currentTvl, currentApr, currentScore, currentTopPools) {
    const cached = this.signalCache.get(poolAddress);

    // Case 1: Never signaled before - SEND
    if (!cached) {
      return { send: true, reason: 'New opportunity detected' };
    }

    // Case 2: Was NOT in top 10 last scan, but is NOW - SEND (re-entered top 10)
    if (!this.lastTopPools.has(poolAddress) && currentTopPools.has(poolAddress)) {
      return { send: true, reason: 'Re-entered top 10' };
    }

    // Case 3: Significant APR increase (>20%) - SEND
    const aprChange = ((currentApr - cached.apr) / cached.apr) * 100;
    if (aprChange > 20) {
      return { send: true, reason: `APR increased ${aprChange.toFixed(1)}%` };
    }

    // Case 4: Significant TVL increase (>50%) - SEND
    const tvlChange = ((currentTvl - cached.tvl) / cached.tvl) * 100;
    if (tvlChange > 50) {
      return { send: true, reason: `TVL increased ${tvlChange.toFixed(1)}%` };
    }

    // Case 5: Score improved significantly (>10 points) - SEND
    const scoreChange = currentScore - cached.score;
    if (scoreChange > 10) {
      return { send: true, reason: `Score improved by ${scoreChange} points` };
    }

    // Otherwise: Already signaled recently with no significant changes - SKIP
    const hoursSinceSignal = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
    return {
      send: false,
      reason: `Already signaled ${hoursSinceSignal.toFixed(1)}h ago, no significant changes`
    };
  }

  /**
   * Clear signal cache (for manual reset)
   */
  clearSignalCache() {
    const count = this.signalCache.size;
    this.signalCache.clear();
    this.lastTopPools.clear();
    logger.info(`Cleared ${count} cached signals`);
    return count;
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
    await notificationService.notifyBotStopped();

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

    await notificationService.notifyEmergencyStop(result.exitedCount, result.totalCount);

    await this.stop();
  }

  /**
   * Send manual entry signal to Telegram
   */
  async sendManualEntrySignal(pool, params) {
    // Extract data with fallbacks from multiple sources
    const tvl = pool.tvl || pool.totalLiquidity || pool.dexScreener?.liquidity || 0;
    const volume24h = pool.volume24h || pool.dexScreener?.volume24h || 0;
    const priceChange24h = pool.priceChange24h || pool.dexScreener?.priceChange24h || 0;
    const score = pool.scores?.overall || pool.scores?.totalScore || 0;
    const fee = pool.fee || pool.baseFee || 0;
    const trade5m = pool.trade5m || (pool.dexScreener?.txns1h ? (pool.dexScreener.txns1h.buys + pool.dexScreener.txns1h.sells) : 0);

    // Calculate 24h Fee/TVL ratio
    const feeToTvlRatio = pool.fees24h && tvl
      ? ((pool.fees24h / tvl) * 100).toFixed(4)
      : 'N/A';

    const message = `
🎯 <b>ENTRY SIGNAL - Manual Action Required</b>

<b>Pool:</b> ${pool.pairName}
<b>Score:</b> ${score} (Top Opportunity)

<b>📊 Pool Details:</b>
• Address: <code>${pool.address}</code>
• TVL: $${tvl?.toLocaleString() || 'N/A'}
• APR: ${pool.apr?.toFixed(2) || 'N/A'}%
• Bin Step: ${pool.binStep || 'N/A'}
• Fee: ${fee ? (fee / 100).toFixed(2) + '%' : 'N/A'}
• 24h Volume: $${volume24h?.toLocaleString() || 'N/A'}
• 24h Fees: $${pool.fees24h?.toFixed(2) || 'N/A'}
• 24h Fee/TVL: ${feeToTvlRatio}%
• 5m Transactions: ${trade5m || 'N/A'}
• Price Change: ${priceChange24h?.toFixed(2) || 'N/A'}%

<b>💡 Strategy:</b> ${params.strategy?.toUpperCase()}
${params.strategyReason || 'Optimal strategy for current conditions'}

<b>💰 Position Parameters:</b>
• Recommended Size: $${params.positionValue?.toFixed(2) || 'N/A'}
• Token X: ${params.tokenX || pool.mintX}
• Token Y: ${params.tokenY || pool.mintY}
${params.lowerBinId ? `• Lower Bin: ${params.lowerBinId}` : ''}
${params.upperBinId ? `• Upper Bin: ${params.upperBinId}` : ''}
${params.activeBinId ? `• Active Bin: ${params.activeBinId}` : ''}

<b>🔗 Quick Links:</b>
• <a href="https://app.meteora.ag/dlmm/${pool.address}">Open in Meteora</a>
• <a href="https://solscan.io/account/${pool.address}">View on Solscan</a>

⏰ Found at: ${new Date().toLocaleString()}

<i>Enter this position manually on Meteora using the parameters above.</i>
    `.trim();

    await notificationService.send(message);

    // Also log to terminal for easy viewing
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 ENTRY SIGNAL GENERATED');
    logger.info('='.repeat(80));
    logger.info(`Pool: ${pool.pairName} | Score: ${score}`);
    logger.info(`Address: ${pool.address}`);
    logger.info(`TVL: $${tvl?.toLocaleString() || 'N/A'} | APR: ${pool.apr?.toFixed(2) || 'N/A'}%`);
    logger.info(`Bin Step: ${pool.binStep || 'N/A'} | Fee: ${fee ? (fee / 100).toFixed(2) + '%' : 'N/A'}`);
    logger.info(`24h Volume: $${volume24h?.toLocaleString() || 'N/A'} | Fees: $${pool.fees24h?.toFixed(2) || 'N/A'}`);
    logger.info(`24h Fee/TVL: ${feeToTvlRatio}% | 5m Tx: ${trade5m || 'N/A'} | Price Change: ${priceChange24h?.toFixed(2) || 'N/A'}%`);
    logger.info(`Strategy: ${params.strategy?.toUpperCase()} | Size: $${params.positionValue?.toFixed(2) || 'N/A'}`);
    logger.info(`Meteora: https://app.meteora.ag/dlmm/${pool.address}`);
    logger.info('='.repeat(80) + '\n');
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
