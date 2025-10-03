import TelegramBot from 'node-telegram-bot-api';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class NotificationService {
  constructor() {
    this.bot = null;
    this.isEnabled = false;
    this.meteoraBot = null; // Reference to main bot instance
  }

  /**
   * Initialize Telegram bot
   */
  initialize(meteoraBotInstance = null) {
    try {
      if (!config.notifications.telegram.enabled) {
        logger.info('Telegram notifications disabled');
        return false;
      }

      const token = config.notifications.telegram.botToken;
      const chatId = config.notifications.telegram.chatId;

      if (!token || !chatId || token === 'your_telegram_bot_token' || chatId === 'your_chat_id') {
        logger.warn('Telegram credentials not configured, notifications disabled');
        return false;
      }

      // Store reference to main bot
      this.meteoraBot = meteoraBotInstance;

      // Create bot instance with polling enabled for commands
      this.bot = new TelegramBot(token, { polling: true });
      this.isEnabled = true;

      // Setup command handlers
      this.setupCommands();

      logger.info('✓ Telegram notifications and commands enabled');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Telegram bot:', error);
      this.isEnabled = false;
      return false;
    }
  }

  /**
   * Setup Telegram command handlers
   */
  setupCommands() {
    if (!this.bot) return;

    const chatId = config.notifications.telegram.chatId;

    // Helper to check if message is from authorized chat
    const isAuthorized = (msg) => msg.chat.id.toString() === chatId.toString();

    // /start - Welcome message
    this.bot.onText(/\/start/, async (msg) => {
      if (!isAuthorized(msg)) return;

      const message = `
🤖 <b>Meteora DLMM Bot - Signal Mode</b>

Welcome! Available commands:

<b>Status & Info:</b>
/status - View bot status
/positions - List active positions
/stats - View performance statistics
/config - View configuration
/fees [position_id] - View fee statistics

<b>Signal Settings:</b>
/settings - View current filtering settings
/settvl [amount] - Set minimum TVL (e.g., /settvl 50000)
/setapr [percent] - Set minimum APR (e.g., /setapr 40)
/resetsettings - Reset all to defaults

<b>Strategies & Performance:</b>
/strategies - List all available strategies
/leaderboard [timeframe] - Strategy leaderboard
/report [timeframe] - Performance report
/optimize - Show optimization opportunities
/risk - Portfolio risk report
/health - System health check

<b>Control:</b>
/pause - Pause bot operations
/resume - Resume bot operations
/stop - Stop bot
/emergency - Emergency exit all positions

<b>Help:</b>
/help - Show this help message
      `.trim();

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
    });

    // /help - Help message
    this.bot.onText(/\/help/, async (msg) => {
      if (!isAuthorized(msg)) return;

      const message = `
📖 <b>Bot Commands Help</b>

<b>/status</b> - Shows current bot status, running state, and capital info

<b>/positions</b> - Lists all active positions with entry prices and APR

<b>/stats</b> - Displays performance statistics including PnL and success rate

<b>/config</b> - Shows current bot configuration (TVL, APR thresholds, etc.)

<b>/fees [position_id]</b> - View portfolio fee stats or specific position fees with ROI

<b>/strategies</b> - List all available strategies grouped by priority

<b>/leaderboard [timeframe]</b> - Strategy performance leaderboard (default: 7d)

<b>/report [timeframe]</b> - Generate performance report (default: 24h)

<b>/optimize</b> - Show strategy optimization opportunities for active positions

<b>/risk</b> - Portfolio risk analysis with drawdown and circuit breaker status

<b>/health</b> - System health check for all critical components

<b>/pause</b> - Temporarily pauses bot operations without closing positions

<b>/resume</b> - Resumes paused bot operations

<b>/stop</b> - Stops the bot completely

<b>/emergency</b> - Emergency exits all positions and stops the bot
      `.trim();

      await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
    });

    // /status - Bot status
    this.bot.onText(/\/status/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const status = this.meteoraBot ? this.meteoraBot.getStatus() : null;
        if (!status) {
          await this.bot.sendMessage(msg.chat.id, '❌ Bot instance not available');
          return;
        }

        const mode = config.bot.paperTrading ? '📝 PAPER TRADING' : '💵 LIVE TRADING';
        const state = status.isRunning ? (status.isPaused ? '⏸️ Paused' : '✅ Running') : '🛑 Stopped';

        const message = `
📊 <b>Bot Status</b>

State: ${state}
Mode: ${mode}

<b>Statistics:</b>
• Positions Entered: ${status.stats.totalPositionsEntered}
• Positions Exited: ${status.stats.totalPositionsExited}
• Rewards Claimed: ${status.stats.totalRewardsClaimed}
• Errors: ${status.stats.errors}

Last Update: ${status.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : 'N/A'}
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /status command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving status');
      }
    });

    // /positions - List active positions
    this.bot.onText(/\/positions/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const database = (await import('../models/database.js')).default;
        const positions = await database.getActivePositions();

        if (positions.length === 0) {
          await this.bot.sendMessage(msg.chat.id, '📭 No active positions');
          return;
        }

        let message = `📈 <b>Active Positions (${positions.length})</b>\n\n`;

        for (const pos of positions) {
          const entryDate = new Date(pos.created_at).toLocaleDateString();
          message += `<b>${pos.pool_name || 'Unknown Pool'}</b>\n`;
          message += `• Strategy: ${pos.strategy?.toUpperCase()}\n`;
          message += `• Entry APR: ${pos.entry_apr ? pos.entry_apr.toFixed(2) + '%' : 'N/A'}\n`;
          message += `• Value: $${pos.liquidity_amount ? parseFloat(pos.liquidity_amount).toFixed(2) : 'N/A'}\n`;
          message += `• Entry Date: ${entryDate}\n`;
          message += `• ID: #${pos.id}\n\n`;
        }

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /positions command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving positions');
      }
    });

    // /stats - Performance statistics
    this.bot.onText(/\/stats/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const database = (await import('../models/database.js')).default;
        const activePositions = await database.getActivePositions();

        // Get all positions for total count
        const allPositionsResult = await database.pool.query(
          'SELECT COUNT(*) as total FROM positions'
        );
        const totalPositions = parseInt(allPositionsResult.rows[0].total);

        const status = this.meteoraBot ? this.meteoraBot.getStatus() : null;

        const mode = config.bot.paperTrading ? '📝 PAPER TRADING' : '💵 LIVE TRADING';

        const message = `
📊 <b>Performance Statistics</b>
Mode: ${mode}

<b>Positions:</b>
• Total Created: ${totalPositions}
• Currently Active: ${activePositions.length}
• Entered: ${status?.stats.totalPositionsEntered || 0}
• Exited: ${status?.stats.totalPositionsExited || 0}

<b>Rewards:</b>
• Total Claims: ${status?.stats.totalRewardsClaimed || 0}

<b>System:</b>
• Errors: ${status?.stats.errors || 0}

Note: PnL tracking coming soon
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /stats command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving statistics');
      }
    });

    // /config - Show configuration
    this.bot.onText(/\/config/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const mode = config.bot.paperTrading ? '📝 Paper Trading' : '💵 Live Trading';
        const capital = config.bot.paperTrading
          ? `$${config.bot.paperTradingStartingCapital.toLocaleString()} (simulated)`
          : 'Live wallet balance';

        const message = `
⚙️ <b>Bot Configuration</b>

<b>Mode:</b> ${mode}
<b>Capital:</b> ${capital}

<b>Trading Parameters:</b>
• Min TVL: $${config.bot.minTvl.toLocaleString()}
• Min APR: ${config.bot.minApr}%
• Max Positions: ${config.bot.maxPositions}
• Max Position %: ${config.bot.maxPositionPercent}%
• Min Reserve %: ${config.bot.minReservePercent}%

<b>Monitoring:</b>
• Rebalance Interval: ${config.bot.rebalanceIntervalMinutes} min
• Claim Threshold: $${config.bot.claimThresholdUsd}

<b>Risk Management:</b>
• Max IL: ${config.risk.maxImpermanentLossPercent}%
• Max APR Decline: ${config.risk.maxAprDeclinePercent}%
• Max Price Drop: ${config.risk.maxPriceDropPercent}%
• Max TVL Drop: ${config.risk.maxTvlDropPercent}%
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /config command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving configuration');
      }
    });

    // /pause - Pause bot
    this.bot.onText(/\/pause/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        if (!this.meteoraBot) {
          await this.bot.sendMessage(msg.chat.id, '❌ Bot instance not available');
          return;
        }

        if (this.meteoraBot.isPaused) {
          await this.bot.sendMessage(msg.chat.id, 'ℹ️ Bot is already paused');
          return;
        }

        await this.meteoraBot.pause();
        await this.bot.sendMessage(msg.chat.id, '⏸️ <b>Bot Paused</b>\n\nAll operations suspended. Use /resume to continue.', { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /pause command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error pausing bot');
      }
    });

    // /resume - Resume bot
    this.bot.onText(/\/resume/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        if (!this.meteoraBot) {
          await this.bot.sendMessage(msg.chat.id, '❌ Bot instance not available');
          return;
        }

        if (!this.meteoraBot.isPaused) {
          await this.bot.sendMessage(msg.chat.id, 'ℹ️ Bot is not paused');
          return;
        }

        await this.meteoraBot.resume();
        await this.bot.sendMessage(msg.chat.id, '▶️ <b>Bot Resumed</b>\n\nOperations continuing normally.', { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /resume command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error resuming bot');
      }
    });

    // /stop - Stop bot
    this.bot.onText(/\/stop/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        if (!this.meteoraBot) {
          await this.bot.sendMessage(msg.chat.id, '❌ Bot instance not available');
          return;
        }

        await this.bot.sendMessage(msg.chat.id, '🛑 <b>Stopping Bot...</b>\n\nPositions will remain open.', { parse_mode: 'HTML' });
        await this.meteoraBot.stop();
      } catch (error) {
        logger.error('Error handling /stop command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error stopping bot');
      }
    });

    // /emergency - Emergency exit all positions
    this.bot.onText(/\/emergency/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        if (!this.meteoraBot) {
          await this.bot.sendMessage(msg.chat.id, '❌ Bot instance not available');
          return;
        }

        await this.bot.sendMessage(msg.chat.id, '🚨 <b>EMERGENCY STOP INITIATED</b>\n\nExiting all positions...', { parse_mode: 'HTML' });
        await this.meteoraBot.emergencyStop();
      } catch (error) {
        logger.error('Error handling /emergency command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error during emergency stop');
      }
    });

    // /strategies - List all available strategies
    this.bot.onText(/\/strategies/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const strategyRegistry = (await import('./strategies/index.js')).default;
        const strategies = strategyRegistry.listStrategies();

        if (strategies.length === 0) {
          await this.bot.sendMessage(msg.chat.id, '❌ No strategies registered');
          return;
        }

        let message = '📋 <b>Available Strategies</b>\n\n';
        message += `Total: ${strategies.length} strategies\n\n`;

        // Group by priority level
        const highPrio = strategies.filter(s => s.priority >= 75);
        const medPrio = strategies.filter(s => s.priority >= 40 && s.priority < 75);
        const lowPrio = strategies.filter(s => s.priority < 40);

        if (highPrio.length > 0) {
          message += '<b>🔥 High Priority (75+)</b>\n';
          highPrio.forEach(s => {
            message += `• <b>${s.name}</b> (${s.priority}) - ${s.riskLevel} risk\n`;
            message += `  ⏱ ${s.timeframe} | 📊 ${s.binTightness} bins\n`;
          });
          message += '\n';
        }

        if (medPrio.length > 0) {
          message += '<b>⚡ Medium Priority (40-74)</b>\n';
          medPrio.forEach(s => {
            message += `• <b>${s.name}</b> (${s.priority}) - ${s.riskLevel} risk\n`;
            message += `  ⏱ ${s.timeframe} | 📊 ${s.binTightness} bins\n`;
          });
          message += '\n';
        }

        if (lowPrio.length > 0) {
          message += '<b>📌 Low Priority (<40)</b>\n';
          lowPrio.forEach(s => {
            message += `• <b>${s.name}</b> (${s.priority}) - ${s.riskLevel} risk\n`;
            message += `  ⏱ ${s.timeframe} | 📊 ${s.binTightness} bins\n`;
          });
        }

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /strategies command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving strategies');
      }
    });

    // /leaderboard - Strategy performance leaderboard
    this.bot.onText(/\/leaderboard(?:\s+(\S+))?/, async (msg, match) => {
      if (!isAuthorized(msg)) return;

      try {
        const performanceTracker = (await import('./performance-tracker.service.js')).default;
        const timeframe = match[1] || '7d';
        const leaderboard = await performanceTracker.getStrategyLeaderboard(timeframe, 10);

        if (leaderboard.length === 0) {
          await this.bot.sendMessage(msg.chat.id, '📭 No strategy data available yet');
          return;
        }

        let message = `🏆 <b>Strategy Leaderboard</b>\nTimeframe: ${timeframe}\n\n`;

        leaderboard.forEach((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
          message += `${medal} <b>${entry.strategy}</b> (Score: ${entry.score})\n`;
          message += `   📊 ${entry.totalPositions} pos | 🎯 ${entry.winRate}% win | 💰 ${entry.feeYield}% yield\n`;
          message += `   ⏱ ${entry.avgHoldTimeHours}h avg | 💵 $${entry.totalFeesEarned}\n\n`;
        });

        message += '<i>Score = (positions×2) + (winRate×40) + (yield×40)</i>';

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /leaderboard command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error generating leaderboard');
      }
    });

    // /report - Performance report
    this.bot.onText(/\/report(?:\s+(\S+))?/, async (msg, match) => {
      if (!isAuthorized(msg)) return;

      try {
        const performanceTracker = (await import('./performance-tracker.service.js')).default;
        const timeframe = match[1] || '24h';
        const report = await performanceTracker.generateReport(timeframe);

        if (!report) {
          await this.bot.sendMessage(msg.chat.id, '❌ Error generating report');
          return;
        }

        let message = `📊 <b>Performance Report</b>\nTimeframe: ${report.timeframe}\n\n`;

        message += '<b>Summary:</b>\n';
        message += `• Total Strategies: ${report.totalStrategies}\n`;
        message += `• Total Positions: ${report.summary.totalPositions}\n`;
        message += `• Active Positions: ${report.summary.activePositions}\n`;
        message += `• Capital Deployed: $${report.summary.totalCapital}\n`;
        message += `• Total Fees: $${report.summary.totalFees}\n\n`;

        if (report.topStrategies.length > 0) {
          message += '<b>Top Performers:</b>\n';
          report.topStrategies.forEach((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
            message += `${medal} ${s.name} - Score: ${s.score}\n`;
            message += `   ${s.positions} positions | ${s.winRate} win rate\n`;
          });
        }

        message += `\n<i>Generated: ${new Date(report.generatedAt).toLocaleString()}</i>`;

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /report command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error generating report');
      }
    });

    // /optimize - Show optimization opportunities
    this.bot.onText(/\/optimize/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const strategyOptimizer = (await import('./strategy-optimizer.service.js')).default;
        const report = await strategyOptimizer.generateOptimizationReport();

        let message = `🔧 <b>Optimization Report</b>\n\n`;
        message += `<b>Active Positions:</b> ${report.totalPositions}\n`;
        message += `<b>Opportunities:</b> ${report.opportunitiesFound}\n\n`;

        if (report.opportunities.length > 0) {
          message += '<b>Top Opportunities:</b>\n\n';
          report.opportunities.forEach((opp, i) => {
            message += `${i + 1}. <b>${opp.pool.pairName || 'Unknown'}</b>\n`;
            message += `   Current: ${opp.evaluation.currentStrategy} (${opp.evaluation.currentScore})\n`;
            message += `   → ${opp.evaluation.suggestedStrategy} (${opp.evaluation.suggestedScore})\n`;
            message += `   Gain: +${opp.evaluation.scoreDiff} | Confidence: ${opp.evaluation.confidence}%\n\n`;
          });

          if (report.opportunitiesFound > 5) {
            message += `<i>...and ${report.opportunitiesFound - 5} more</i>\n\n`;
          }

          message += `<b>Total Potential:</b> +${report.totalPotentialGain} score points`;
        } else {
          message += '✅ All positions are using optimal strategies!';
        }

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /optimize command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error generating optimization report');
      }
    });

    // /risk - Portfolio risk report
    this.bot.onText(/\/risk/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const database = (await import('../models/database.js')).default;
        const riskManager = (await import('./risk-manager.service.js')).default;
        const dataAggregator = (await import('./data-aggregator.service.js')).default;

        const activePositions = await database.getActivePositions();
        const poolsMap = new Map();
        for (const pos of activePositions) {
          const pool = dataAggregator.getPool(pos.pool_address);
          if (pool) poolsMap.set(pos.pool_address, pool);
        }

        const report = await riskManager.getPortfolioRiskReport(activePositions, poolsMap);

        if (!report) {
          await this.bot.sendMessage(msg.chat.id, '❌ Error generating risk report');
          return;
        }

        const statusEmoji = {
          'LOW': '🟢',
          'MEDIUM': '🟡',
          'HIGH': '🟠',
          'CRITICAL': '🔴',
        };

        let message = `${statusEmoji[report.riskStatus]} <b>Portfolio Risk Report</b>\n\n`;
        message += `<b>Status:</b> ${report.riskStatus}\n\n`;

        message += '<b>Portfolio:</b>\n';
        message += `• Positions: ${report.portfolio.positions}\n`;
        message += `• Total Value: $${report.portfolio.totalValue.toFixed(2)}\n`;
        message += `• Peak Value: $${report.portfolio.peakValue.toFixed(2)}\n`;
        message += `• PnL: ${report.portfolio.totalPnL >= 0 ? '+' : ''}$${report.portfolio.totalPnL.toFixed(2)} (${report.portfolio.pnlPercent >= 0 ? '+' : ''}${report.portfolio.pnlPercent.toFixed(2)}%)\n\n`;

        message += '<b>Risk Metrics:</b>\n';
        message += `• Current Drawdown: ${report.portfolio.currentDrawdown.toFixed(2)}%\n`;
        message += `• Max Drawdown Limit: ${report.portfolio.maxDrawdownLimit}%\n\n`;

        message += '<b>Circuit Breaker:</b>\n';
        message += `• Status: ${report.circuitBreaker.active ? '🔴 ACTIVE' : '🟢 Inactive'}\n`;
        if (report.circuitBreaker.active) {
          message += `• Reason: ${report.circuitBreaker.reason}\n`;
        }

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /risk command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error generating risk report');
      }
    });

    // /health - System health check
    this.bot.onText(/\/health/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const healthCheck = (await import('./health-check.service.js')).default;
        const results = await healthCheck.runAllChecks();

        const statusEmoji = {
          'HEALTHY': '🟢',
          'DEGRADED': '🟡',
          'UNHEALTHY': '🔴',
          'CRITICAL': '🔴',
        };

        let message = `${statusEmoji[results.overall]} <b>System Health Check</b>\n\n`;
        message += `<b>Overall Status:</b> ${results.overall}\n`;
        message += `<b>Timestamp:</b> ${new Date(results.timestamp).toLocaleTimeString()}\n\n`;

        message += `<b>Summary:</b>\n`;
        message += `• ✅ Healthy: ${results.summary.healthy}\n`;
        message += `• ⚠️ Degraded: ${results.summary.degraded}\n`;
        message += `• ❌ Unhealthy: ${results.summary.unhealthy}\n\n`;

        message += '<b>Checks:</b>\n';
        for (const [name, check] of Object.entries(results.checks)) {
          const emoji = statusEmoji[check.status] || '⚪';
          message += `${emoji} ${name}: ${check.status}\n`;
          if (check.message) {
            message += `   ${check.message}\n`;
          }
          if (check.error) {
            message += `   Error: ${check.error}\n`;
          }
        }

        await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /health command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error running health checks');
      }
    });

    // /fees - Fee tracking statistics
    this.bot.onText(/\/fees(?:\s+(\d+))?/, async (msg, match) => {
      if (!isAuthorized(msg)) return;

      try {
        const feeTracker = (await import('./fee-tracker.service.js')).default;
        const positionId = match[1] ? parseInt(match[1]) : null;

        if (positionId) {
          // Show fees for specific position
          const fees = await feeTracker.getPositionFees(positionId);

          if (!fees) {
            await this.bot.sendMessage(msg.chat.id, `❌ Position #${positionId} not found`);
            return;
          }

          let message = `💰 <b>Position #${positionId} Fees</b>\n\n`;
          message += `<b>Total Fees:</b> $${fees.totalFees.toFixed(4)}\n`;
          message += `<b>Gas Costs:</b> $${fees.totalGas.toFixed(4)}\n`;
          message += `<b>Net Profit:</b> $${fees.netFees.toFixed(4)}\n\n`;

          if (fees.capitalDeployed > 0) {
            message += `<b>Capital Deployed:</b> $${fees.capitalDeployed.toFixed(2)}\n`;
            message += `<b>ROI:</b> ${fees.roi?.toFixed(2)}%\n`;
            message += `<b>Days Active:</b> ${fees.daysActive?.toFixed(1)}\n`;
            message += `<b>Daily ROI:</b> ${fees.dailyRoi?.toFixed(3)}%\n`;
            message += `<b>Annualized ROI:</b> ${fees.annualizedRoi?.toFixed(2)}%\n`;
          }

          await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
        } else {
          // Show portfolio-wide statistics
          const stats = await feeTracker.getPortfolioFeeStats();

          if (!stats) {
            await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving fee statistics');
            return;
          }

          let message = `💰 <b>Portfolio Fee Statistics</b>\n\n`;
          message += `<b>Positions:</b>\n`;
          message += `• Total: ${stats.totalPositions}\n`;
          message += `• Active: ${stats.activePositions}\n\n`;

          message += `<b>Fees & Costs:</b>\n`;
          message += `• Total Fees Earned: $${stats.totalFeesEarned.toFixed(4)}\n`;
          message += `• Total Gas Costs: $${stats.totalGasCosts.toFixed(4)}\n`;
          message += `• <b>Net Profit: $${stats.netFeesEarned.toFixed(4)}</b>\n\n`;

          message += `<b>Capital:</b>\n`;
          message += `• Total Deployed: $${stats.totalCapitalDeployed.toFixed(2)}\n`;
          if (stats.totalCapitalDeployed > 0) {
            const roiEmoji = stats.portfolioROI >= 0 ? '📈' : '📉';
            message += `• ${roiEmoji} Portfolio ROI: ${stats.portfolioROI.toFixed(2)}%\n`;
          }

          // Get top earning positions
          const topPositions = await feeTracker.getAllPositionsFees();
          if (topPositions.length > 0) {
            message += `\n<b>Top Earners:</b>\n`;
            topPositions.slice(0, 5).forEach((pos, i) => {
              message += `${i + 1}. Position #${pos.positionId} - $${pos.netFees.toFixed(4)} (${pos.roi.toFixed(2)}%)\n`;
            });
          }

          message += `\n<i>Use /fees [position_id] for details</i>`;

          await this.bot.sendMessage(msg.chat.id, message.trim(), { parse_mode: 'HTML' });
        }
      } catch (error) {
        logger.error('Error handling /fees command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving fee statistics');
      }
    });

    // /settings - View current filtering settings
    this.bot.onText(/\/settings/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const message = `
⚙️ <b>Current Signal Filtering Settings</b>

<b>Basic Filters:</b>
• MIN_TVL: $${config.bot.minTvl.toLocaleString()}
• MIN_APR: ${config.bot.minApr}%

<b>Position Limits:</b>
• MAX_POSITIONS: ${config.bot.maxPositions}
• MAX_POSITION_PERCENT: ${config.bot.maxPositionPercent}%
• MIN_RESERVE_PERCENT: ${config.bot.minReservePercent}%

<b>Risk Limits:</b>
• MAX_IMPERMANENT_LOSS: ${config.risk.maxImpermanentLossPercent}%
• MAX_APR_DECLINE: ${config.risk.maxAprDeclinePercent}%
• MAX_PRICE_DROP: ${config.risk.maxPriceDropPercent}%
• MAX_TVL_DROP: ${config.risk.maxTvlDropPercent}%
• MAX_DRAWDOWN: ${config.risk.maxDrawdownPercent}%

<b>Adjust Settings:</b>
/settvl [amount] - Set minimum TVL (e.g., /settvl 50000)
/setapr [percent] - Set minimum APR (e.g., /setapr 40)
/resetsettings - Reset all to defaults
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
      } catch (error) {
        logger.error('Error handling /settings command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error retrieving settings');
      }
    });

    // /settvl - Set minimum TVL
    this.bot.onText(/\/settvl (.+)/, async (msg, match) => {
      if (!isAuthorized(msg)) return;

      try {
        const newTvl = parseFloat(match[1]);

        if (isNaN(newTvl) || newTvl < 0) {
          await this.bot.sendMessage(msg.chat.id, '❌ Invalid TVL value. Use: /settvl [amount]');
          return;
        }

        if (newTvl < 1000) {
          await this.bot.sendMessage(msg.chat.id, '⚠️ Warning: TVL below $1,000 may include very low liquidity pools');
        }

        const oldTvl = config.bot.minTvl;
        config.bot.minTvl = newTvl;

        const message = `
✅ <b>MIN_TVL Updated</b>

Old value: $${oldTvl.toLocaleString()}
New value: $${newTvl.toLocaleString()}

<i>This will affect the next opportunity scan.</i>
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
        logger.info(`MIN_TVL updated from ${oldTvl} to ${newTvl} via Telegram`);
      } catch (error) {
        logger.error('Error handling /settvl command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error updating TVL setting');
      }
    });

    // /setapr - Set minimum APR
    this.bot.onText(/\/setapr (.+)/, async (msg, match) => {
      if (!isAuthorized(msg)) return;

      try {
        const newApr = parseFloat(match[1]);

        if (isNaN(newApr) || newApr < 0) {
          await this.bot.sendMessage(msg.chat.id, '❌ Invalid APR value. Use: /setapr [percent]');
          return;
        }

        if (newApr < 10) {
          await this.bot.sendMessage(msg.chat.id, '⚠️ Warning: APR below 10% may not be profitable after gas costs');
        }

        const oldApr = config.bot.minApr;
        config.bot.minApr = newApr;

        const message = `
✅ <b>MIN_APR Updated</b>

Old value: ${oldApr}%
New value: ${newApr}%

<i>This will affect the next opportunity scan.</i>
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
        logger.info(`MIN_APR updated from ${oldApr} to ${newApr} via Telegram`);
      } catch (error) {
        logger.error('Error handling /setapr command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error updating APR setting');
      }
    });

    // /resetsettings - Reset settings to defaults
    this.bot.onText(/\/resetsettings/, async (msg) => {
      if (!isAuthorized(msg)) return;

      try {
        const oldTvl = config.bot.minTvl;
        const oldApr = config.bot.minApr;

        // Reset to .env defaults
        config.bot.minTvl = parseFloat(process.env.MIN_TVL || '10000');
        config.bot.minApr = parseFloat(process.env.MIN_APR || '30');

        const message = `
✅ <b>Settings Reset to Defaults</b>

<b>Changes:</b>
MIN_TVL: $${oldTvl.toLocaleString()} → $${config.bot.minTvl.toLocaleString()}
MIN_APR: ${oldApr}% → ${config.bot.minApr}%

<i>These are the values from your .env file.</i>
        `.trim();

        await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'HTML' });
        logger.info(`Settings reset to defaults via Telegram`);
      } catch (error) {
        logger.error('Error handling /resetsettings command:', error);
        await this.bot.sendMessage(msg.chat.id, '❌ Error resetting settings');
      }
    });

    logger.info('Telegram command handlers registered');
  }

  /**
   * Send message to Telegram
   */
  async send(message, options = {}) {
    try {
      if (!this.isEnabled || !this.bot) {
        logger.debug('Telegram notification skipped (disabled)');
        return false;
      }

      const chatId = config.notifications.telegram.chatId;

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options,
      });

      logger.debug('Telegram notification sent');
      return true;
    } catch (error) {
      logger.error('Failed to send Telegram message:', error);
      return false;
    }
  }

  /**
   * Notify position entered
   */
  async notifyPositionEntered(result) {
    const isPaper = result.signature?.startsWith('PAPER_');
    const modeIndicator = isPaper ? '📝 PAPER MODE' : '💵 LIVE';
    const txLink = isPaper
      ? '(Simulated transaction)'
      : `🔗 <a href="https://solscan.io/tx/${result.signature}">View Transaction</a>`;

    const message = `
🟢 <b>Position Entered</b> ${modeIndicator}

📊 Pool: <b>${result.poolName}</b>
💰 Value: $${result.positionValue?.toFixed(2) || 'N/A'}
📈 Strategy: <b>${result.strategy?.toUpperCase()}</b>
🎯 APR: ${result.entryApr?.toFixed(2)}%

💡 ${result.strategyReason || 'Optimal opportunity detected'}

${txLink}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify position exited
   */
  async notifyPositionExited(position, reason, pnl = null) {
    let pnlText = '';
    if (pnl) {
      const emoji = pnl.pnlPercent >= 0 ? '📈' : '📉';
      const sign = pnl.pnlPercent >= 0 ? '+' : '';
      pnlText = `\n${emoji} PnL: ${sign}${pnl.pnlPercent.toFixed(2)}% (${sign}$${pnl.pnl.toFixed(2)})`;
    }

    const message = `
🔴 <b>Position Exited</b>

📊 Pool: <b>${position.pool_name || 'Unknown'}</b>
⚠️ Reason: ${reason}${pnlText}

Position ID: #${position.id}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify strategy switch
   */
  async notifyStrategySwitch(position, optimizationCheck) {
    const message = `
🔄 <b>Strategy Optimization</b>

📊 Pool: <b>${position.pool_name || 'Unknown'}</b>

<b>Switch Details:</b>
• From: ${optimizationCheck.currentStrategy?.toUpperCase()} (Score: ${optimizationCheck.currentScore})
• To: ${optimizationCheck.suggestedStrategy?.toUpperCase()} (Score: ${optimizationCheck.suggestedScore})
• Improvement: +${optimizationCheck.scoreDiff} points
• Confidence: ${optimizationCheck.confidence}%

💡 ${optimizationCheck.reason}

${optimizationCheck.conditionsChanged?.changed
  ? `📈 Market changed: ${optimizationCheck.conditionsChanged.metric} (${optimizationCheck.conditionsChanged.change.toFixed(1)}${optimizationCheck.conditionsChanged.metric === 'price' ? '%' : ' pts'})`
  : ''}

Position ID: #${position.id}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify rewards claimed
   */
  async notifyRewardsClaimed(position, signatures, claimInfo = null) {
    let message = `
💰 <b>Rewards Claimed</b>

📊 Pool: <b>${position.pool_name || 'Unknown'}</b>
Position ID: #${position.id}

✅ ${signatures.length} transaction(s) completed`;

    if (claimInfo && claimInfo.estimatedFeesUsd) {
      message += `\n\n<b>Estimated Profitability:</b>`;
      message += `\n• Fees: $${claimInfo.estimatedFeesUsd.toFixed(4)}`;
      message += `\n• Gas: $${claimInfo.estimatedGasCostUsd?.toFixed(4)}`;
      message += `\n• Net: $${claimInfo.netProfit?.toFixed(4)}`;
    }

    message += `\n\n🔗 <a href="https://solscan.io/tx/${signatures[0]}">View Transaction</a>`;

    await this.send(message.trim());
  }

  /**
   * Notify risk alert
   */
  async notifyRiskAlert(position, alertType, details) {
    const message = `
⚠️ <b>Risk Alert</b>

📊 Pool: <b>${position.pool_name || 'Unknown'}</b>
🚨 Alert: ${alertType}

${details}

Position ID: #${position.id}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify error
   */
  async notifyError(errorType, details) {
    const message = `
❌ <b>Bot Error</b>

Error: ${errorType}
Details: ${details}

Time: ${new Date().toLocaleString()}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify bot started
   */
  async notifyBotStarted() {
    const mode = config.bot.paperTrading ? '📝 PAPER TRADING MODE' : '💵 LIVE TRADING MODE';
    const capitalInfo = config.bot.paperTrading
      ? `• Starting Capital: $${config.bot.paperTradingStartingCapital.toLocaleString()} (simulated)`
      : '• Live wallet connected';

    const message = `
🤖 <b>Meteora Bot Started</b>

Status: ✅ Running
Mode: ${mode}

Config:
${capitalInfo}
• Min TVL: $${config.bot.minTvl.toLocaleString()}
• Min APR: ${config.bot.minApr}%
• Max Positions: ${config.bot.maxPositions}
• Rebalance Interval: ${config.bot.rebalanceIntervalMinutes} min

Time: ${new Date().toLocaleString()}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify bot stopped
   */
  async notifyBotStopped() {
    const message = `
🛑 <b>Meteora Bot Stopped</b>

Status: Stopped
Time: ${new Date().toLocaleString()}
    `.trim();

    await this.send(message);
  }

  /**
   * Notify emergency stop
   */
  async notifyEmergencyStop(exitedCount, totalCount) {
    const message = `
🚨 <b>EMERGENCY STOP</b>

⚠️ All positions being closed
✅ Exited: ${exitedCount}/${totalCount}

Time: ${new Date().toLocaleString()}
    `.trim();

    await this.send(message);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(stats) {
    const message = `
📊 <b>Daily Summary</b>

Positions:
• Entered: ${stats.totalPositionsEntered}
• Exited: ${stats.totalPositionsExited}
• Active: ${stats.activePositions || 0}

Rewards:
• Claimed: ${stats.totalRewardsClaimed}

Performance:
• Total PnL: ${stats.totalPnL ? `$${stats.totalPnL.toFixed(2)}` : 'N/A'}
• Success Rate: ${stats.successRate ? `${stats.successRate.toFixed(1)}%` : 'N/A'}

Errors: ${stats.errors}

Time: ${new Date().toLocaleString()}
    `.trim();

    await this.send(message);
  }

  /**
   * Test notification
   */
  async testNotification() {
    const message = `
✅ <b>Test Notification</b>

Telegram notifications are working correctly!

Bot is ready to send updates.

Time: ${new Date().toLocaleString()}
    `.trim();

    return await this.send(message);
  }
}

export default new NotificationService();
