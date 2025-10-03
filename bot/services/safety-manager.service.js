import logger from '../utils/logger.js';
import database from '../models/database.js';
import config from '../config/config.js';

/**
 * Safety Manager Service
 * Enforces safety limits and protections for live trading
 */
class SafetyManagerService {
  constructor() {
    this.dailyStats = {
      capitalDeployed: 0,
      losses: 0,
      transactions: 0,
      lastReset: this.getStartOfDay(),
    };

    this.weeklyStats = {
      capitalDeployed: 0,
      losses: 0,
      lastReset: this.getStartOfWeek(),
    };

    this.hourlyTxCount = 0;
    this.lastHourReset = Date.now();

    this.consecutiveFailures = 0;
    this.isKillSwitchActive = false;
    this.isPaused = false;
  }

  /**
   * Check if position entry is allowed
   */
  async canEnterPosition(positionValue) {
    const checks = [];

    // Skip safety checks in paper trading
    if (config.bot.paperTrading) {
      return { allowed: true, reason: 'Paper trading mode - safety checks bypassed' };
    }

    // Check if kill switch is active
    if (this.isKillSwitchActive) {
      return { allowed: false, reason: 'Kill switch is active - all trading stopped' };
    }

    // Check if paused
    if (this.isPaused) {
      return { allowed: false, reason: 'Bot is paused' };
    }

    // Reset stats if needed
    this.resetStatsIfNeeded();

    // Check single position size limit
    if (positionValue > config.safety.maxSinglePositionSize) {
      return {
        allowed: false,
        reason: `Position size $${positionValue.toFixed(2)} exceeds max $${config.safety.maxSinglePositionSize}`,
      };
    }

    // Check daily capital deployment limit
    const projectedDailyCapital = this.dailyStats.capitalDeployed + positionValue;
    if (projectedDailyCapital > config.safety.maxDailyCapitalDeployment) {
      return {
        allowed: false,
        reason: `Daily capital limit reached ($${this.dailyStats.capitalDeployed.toFixed(2)}/$${config.safety.maxDailyCapitalDeployment})`,
      };
    }

    // Check weekly capital deployment limit
    const projectedWeeklyCapital = this.weeklyStats.capitalDeployed + positionValue;
    if (projectedWeeklyCapital > config.safety.maxWeeklyCapitalDeployment) {
      return {
        allowed: false,
        reason: `Weekly capital limit reached ($${this.weeklyStats.capitalDeployed.toFixed(2)}/$${config.safety.maxWeeklyCapitalDeployment})`,
      };
    }

    // Check daily loss limit
    if (this.dailyStats.losses >= config.safety.maxDailyLossUsd) {
      return {
        allowed: false,
        reason: `Daily loss limit reached ($${this.dailyStats.losses.toFixed(2)}/$${config.safety.maxDailyLossUsd})`,
      };
    }

    // Check weekly loss limit
    if (this.weeklyStats.losses >= config.safety.maxWeeklyLossUsd) {
      return {
        allowed: false,
        reason: `Weekly loss limit reached ($${this.weeklyStats.losses.toFixed(2)}/$${config.safety.maxWeeklyLossUsd})`,
      };
    }

    // Check transaction rate limit
    this.resetTxCountIfNeeded();
    if (this.hourlyTxCount >= config.safety.maxTxPerHour) {
      return {
        allowed: false,
        reason: `Hourly transaction limit reached (${this.hourlyTxCount}/${config.safety.maxTxPerHour})`,
      };
    }

    // Check wallet balance and reserve
    const walletCheck = await this.checkWalletReserve(positionValue);
    if (!walletCheck.allowed) {
      return walletCheck;
    }

    // All checks passed
    return {
      allowed: true,
      reason: 'All safety checks passed',
      stats: {
        dailyCapitalUsed: this.dailyStats.capitalDeployed,
        weeklyCapitalUsed: this.weeklyStats.capitalDeployed,
        dailyLosses: this.dailyStats.losses,
        weeklyLosses: this.weeklyStats.losses,
        hourlyTxCount: this.hourlyTxCount,
      },
    };
  }

  /**
   * Check wallet reserve requirements
   */
  async checkWalletReserve(positionValue) {
    try {
      const { Connection, PublicKey } = await import('@solana/web3.js');
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const walletPublicKey = new PublicKey(config.wallet.publicKey);
      const balance = await connection.getBalance(walletPublicKey);
      const solBalance = balance / 1e9;

      // Check minimum reserve
      if (solBalance < config.safety.minWalletReserveSOL) {
        return {
          allowed: false,
          reason: `Wallet balance too low: ${solBalance.toFixed(4)} SOL (min reserve: ${config.safety.minWalletReserveSOL} SOL)`,
        };
      }

      // Check max wallet usage
      const priceFeed = (await import('./price-feed.service.js')).default;
      const solPrice = await priceFeed.getSolPrice();
      const walletValueUsd = solBalance * solPrice;
      const maxUsableCapital = (walletValueUsd * config.safety.maxWalletUsagePercent) / 100;

      // Get current deployed capital
      const activePositions = await database.getActivePositions();
      const currentDeployed = activePositions.reduce((sum, pos) => {
        return sum + parseFloat(pos.liquidity_amount || 0);
      }, 0);

      const projectedDeployed = currentDeployed + positionValue;

      if (projectedDeployed > maxUsableCapital) {
        return {
          allowed: false,
          reason: `Max wallet usage exceeded: $${projectedDeployed.toFixed(2)} > $${maxUsableCapital.toFixed(2)} (${config.safety.maxWalletUsagePercent}% of wallet)`,
        };
      }

      return { allowed: true };

    } catch (error) {
      logger.error('Error checking wallet reserve:', error);
      return {
        allowed: false,
        reason: 'Failed to verify wallet balance',
      };
    }
  }

  /**
   * Record position entry
   */
  recordPositionEntry(positionValue) {
    this.dailyStats.capitalDeployed += positionValue;
    this.weeklyStats.capitalDeployed += positionValue;
    this.recordTransaction();

    logger.debug(`Safety: Position entered - Daily: $${this.dailyStats.capitalDeployed.toFixed(2)}, Weekly: $${this.weeklyStats.capitalDeployed.toFixed(2)}`);
  }

  /**
   * Record position loss
   */
  recordLoss(lossAmount) {
    if (lossAmount <= 0) return;

    this.dailyStats.losses += lossAmount;
    this.weeklyStats.losses += lossAmount;

    logger.warn(`Safety: Loss recorded - Daily: $${this.dailyStats.losses.toFixed(2)}, Weekly: $${this.weeklyStats.losses.toFixed(2)}`);

    // Check if loss limits triggered
    if (this.dailyStats.losses >= config.safety.maxDailyLossUsd) {
      this.triggerPause('Daily loss limit reached');
    } else if (this.weeklyStats.losses >= config.safety.maxWeeklyLossUsd) {
      this.triggerPause('Weekly loss limit reached');
    }
  }

  /**
   * Record transaction
   */
  recordTransaction(failed = false) {
    this.resetTxCountIfNeeded();
    this.hourlyTxCount++;
    this.dailyStats.transactions++;

    if (failed) {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= config.safety.maxFailedTxBeforePause) {
        this.triggerPause(`${this.consecutiveFailures} consecutive transaction failures`);
      }
    } else {
      this.consecutiveFailures = 0; // Reset on success
    }
  }

  /**
   * Trigger auto-pause
   */
  async triggerPause(reason) {
    this.isPaused = true;
    logger.error(`🚨 SAFETY AUTO-PAUSE: ${reason}`);

    // Notify via Telegram
    try {
      const notification = (await import('./notification.service.js')).default;
      const message = `
🚨 <b>SAFETY AUTO-PAUSE</b>

<b>Reason:</b> ${reason}

<b>Daily Stats:</b>
• Capital Deployed: $${this.dailyStats.capitalDeployed.toFixed(2)}/$${config.safety.maxDailyCapitalDeployment}
• Losses: $${this.dailyStats.losses.toFixed(2)}/$${config.safety.maxDailyLossUsd}
• Transactions: ${this.dailyStats.transactions}

<b>Action Required:</b>
Review the situation and use /resume to continue trading.

Use /stats and /risk to assess current state.
      `.trim();

      await notification.send(message);
    } catch (error) {
      logger.error('Failed to send pause notification:', error);
    }
  }

  /**
   * Activate kill switch
   */
  async activateKillSwitch(reason = 'Manual activation') {
    if (!config.safety.enableKillSwitch) {
      logger.warn('Kill switch is disabled in config');
      return false;
    }

    this.isKillSwitchActive = true;
    logger.error(`🚨 KILL SWITCH ACTIVATED: ${reason}`);

    // Notify via Telegram
    try {
      const notification = (await import('./notification.service.js')).default;
      const message = `
🚨 <b>KILL SWITCH ACTIVATED</b>

<b>Reason:</b> ${reason}

All trading operations have been stopped.
No new positions will be entered.

<b>Action Required:</b>
Investigate the issue immediately.
Use /emergency to exit all positions if needed.
      `.trim();

      await notification.send(message);
    } catch (error) {
      logger.error('Failed to send kill switch notification:', error);
    }

    return true;
  }

  /**
   * Deactivate kill switch
   */
  deactivateKillSwitch() {
    this.isKillSwitchActive = false;
    logger.info('Kill switch deactivated');
  }

  /**
   * Resume from pause
   */
  resume() {
    this.isPaused = false;
    this.consecutiveFailures = 0;
    logger.info('Safety pause lifted - resuming normal operations');
  }

  /**
   * Reset stats if needed (daily/weekly)
   */
  resetStatsIfNeeded() {
    const now = Date.now();
    const startOfDay = this.getStartOfDay();
    const startOfWeek = this.getStartOfWeek();

    // Reset daily stats
    if (startOfDay > this.dailyStats.lastReset) {
      logger.info('Resetting daily safety stats');
      this.dailyStats = {
        capitalDeployed: 0,
        losses: 0,
        transactions: 0,
        lastReset: startOfDay,
      };
    }

    // Reset weekly stats
    if (startOfWeek > this.weeklyStats.lastReset) {
      logger.info('Resetting weekly safety stats');
      this.weeklyStats = {
        capitalDeployed: 0,
        losses: 0,
        lastReset: startOfWeek,
      };
    }
  }

  /**
   * Reset transaction count if hour has passed
   */
  resetTxCountIfNeeded() {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);

    if (this.lastHourReset < hourAgo) {
      this.hourlyTxCount = 0;
      this.lastHourReset = now;
    }
  }

  /**
   * Get start of current day
   */
  getStartOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  /**
   * Get start of current week (Monday)
   */
  getStartOfWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
  }

  /**
   * Get safety status
   */
  getStatus() {
    this.resetStatsIfNeeded();

    return {
      killSwitch: this.isKillSwitchActive,
      paused: this.isPaused,
      consecutiveFailures: this.consecutiveFailures,
      daily: {
        capitalDeployed: this.dailyStats.capitalDeployed,
        capitalLimit: config.safety.maxDailyCapitalDeployment,
        capitalRemaining: Math.max(0, config.safety.maxDailyCapitalDeployment - this.dailyStats.capitalDeployed),
        losses: this.dailyStats.losses,
        lossLimit: config.safety.maxDailyLossUsd,
        transactions: this.dailyStats.transactions,
      },
      weekly: {
        capitalDeployed: this.weeklyStats.capitalDeployed,
        capitalLimit: config.safety.maxWeeklyCapitalDeployment,
        capitalRemaining: Math.max(0, config.safety.maxWeeklyCapitalDeployment - this.weeklyStats.capitalDeployed),
        losses: this.weeklyStats.losses,
        lossLimit: config.safety.maxWeeklyLossUsd,
      },
      hourly: {
        transactions: this.hourlyTxCount,
        limit: config.safety.maxTxPerHour,
      },
    };
  }
}

export default new SafetyManagerService();
