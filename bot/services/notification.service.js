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
🤖 <b>Meteora DLMM Bot</b>

Welcome! Available commands:

<b>Status & Info:</b>
/status - View bot status
/positions - List active positions
/stats - View performance statistics
/config - View configuration

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
   * Notify rewards claimed
   */
  async notifyRewardsClaimed(position, signatures) {
    const message = `
💰 <b>Rewards Claimed</b>

📊 Pool: <b>${position.pool_name || 'Unknown'}</b>
Position ID: #${position.id}

✅ ${signatures.length} transaction(s) completed

🔗 <a href="https://solscan.io/tx/${signatures[0]}">View Transaction</a>
    `.trim();

    await this.send(message);
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
