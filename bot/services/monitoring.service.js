import logger from '../utils/logger.js';
import database from '../models/database.js';
import config from '../config/config.js';

/**
 * Enhanced Monitoring Service
 * Real-time monitoring and alerting for live deployment
 */
class MonitoringService {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      positionsEntered: 0,
      positionsExited: 0,
      rewardsClaimed: 0,
      errors: 0,
      warnings: 0,
      transactions: {
        total: 0,
        successful: 0,
        failed: 0,
      },
      lastActivity: Date.now(),
    };

    this.alerts = [];
    this.thresholds = {
      maxErrorsPerHour: 10,
      maxFailedTxPerHour: 5,
      minActivityIntervalMinutes: 60, // Alert if no activity for 60 min
      maxDrawdownPercent: 15,
      minWalletBalanceSOL: 0.05, // Alert if balance drops below 0.05 SOL
    };

    this.errorHistory = [];
    this.txHistory = [];
  }

  /**
   * Start monitoring
   */
  start() {
    logger.info('📊 Monitoring service started');

    // Run periodic checks every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.runPeriodicChecks();
    }, 5 * 60 * 1000);

    // Daily summary at midnight
    this.scheduleDailySummary();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.dailySummaryInterval) {
      clearInterval(this.dailySummaryInterval);
    }
    logger.info('📊 Monitoring service stopped');
  }

  /**
   * Record position entry
   */
  recordPositionEntry(position) {
    this.metrics.positionsEntered++;
    this.metrics.lastActivity = Date.now();
    logger.debug(`Monitoring: Position entered (total: ${this.metrics.positionsEntered})`);
  }

  /**
   * Record position exit
   */
  recordPositionExit(position, reason) {
    this.metrics.positionsExited++;
    this.metrics.lastActivity = Date.now();

    // Alert on forced exits due to risk
    if (reason.includes('risk') || reason.includes('stop-loss') || reason.includes('drawdown')) {
      this.createAlert('RISK_EXIT', `Position exited due to risk: ${reason}`, 'HIGH');
    }

    logger.debug(`Monitoring: Position exited (total: ${this.metrics.positionsExited})`);
  }

  /**
   * Record reward claim
   */
  recordRewardClaim(position, amount) {
    this.metrics.rewardsClaimed++;
    this.metrics.lastActivity = Date.now();
    logger.debug(`Monitoring: Rewards claimed (total: ${this.metrics.rewardsClaimed})`);
  }

  /**
   * Record transaction
   */
  recordTransaction(success, txType, signature = null) {
    this.metrics.transactions.total++;
    this.metrics.lastActivity = Date.now();

    const txRecord = {
      timestamp: Date.now(),
      success,
      type: txType,
      signature,
    };

    this.txHistory.push(txRecord);

    // Keep only last 100 transactions
    if (this.txHistory.length > 100) {
      this.txHistory.shift();
    }

    if (success) {
      this.metrics.transactions.successful++;
    } else {
      this.metrics.transactions.failed++;

      // Check for excessive failures
      const recentFailures = this.getRecentFailedTx(60); // Last hour
      if (recentFailures >= this.thresholds.maxFailedTxPerHour) {
        this.createAlert(
          'TX_FAILURES',
          `${recentFailures} failed transactions in the last hour`,
          'CRITICAL'
        );
      }
    }
  }

  /**
   * Record error
   */
  recordError(error, context = '') {
    this.metrics.errors++;

    const errorRecord = {
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      context,
    };

    this.errorHistory.push(errorRecord);

    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    // Check for excessive errors
    const recentErrors = this.getRecentErrors(60); // Last hour
    if (recentErrors >= this.thresholds.maxErrorsPerHour) {
      this.createAlert(
        'EXCESSIVE_ERRORS',
        `${recentErrors} errors in the last hour`,
        'CRITICAL'
      );
    }
  }

  /**
   * Record warning
   */
  recordWarning(message, context = '') {
    this.metrics.warnings++;
    logger.warn(`[Monitoring] ${context}: ${message}`);
  }

  /**
   * Create alert
   */
  createAlert(type, message, severity = 'MEDIUM') {
    const alert = {
      type,
      message,
      severity,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Log and notify
    const emoji = severity === 'CRITICAL' ? '🚨' : severity === 'HIGH' ? '⚠️' : 'ℹ️';
    logger.warn(`${emoji} ALERT [${severity}] ${type}: ${message}`);

    // Send Telegram notification for high/critical alerts
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this.notifyAlert(alert);
    }

    return alert;
  }

  /**
   * Notify alert via Telegram
   */
  async notifyAlert(alert) {
    try {
      const notification = (await import('./notification.service.js')).default;
      const emoji = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';

      const message = `
${emoji} <b>ALERT - ${alert.severity}</b>

<b>Type:</b> ${alert.type}
<b>Message:</b> ${alert.message}
<b>Time:</b> ${new Date(alert.timestamp).toLocaleString()}

Use /health and /risk to check system status
      `.trim();

      await notification.send(message);
    } catch (error) {
      logger.error('Failed to send alert notification:', error);
    }
  }

  /**
   * Run periodic checks
   */
  async runPeriodicChecks() {
    try {
      // Check for inactivity
      const minutesSinceActivity = (Date.now() - this.metrics.lastActivity) / (1000 * 60);
      if (minutesSinceActivity > this.thresholds.minActivityIntervalMinutes) {
        this.createAlert(
          'INACTIVITY',
          `No activity for ${minutesSinceActivity.toFixed(0)} minutes`,
          'MEDIUM'
        );
      }

      // Check wallet balance
      if (!config.bot.paperTrading) {
        await this.checkWalletBalance();
      }

      // Check portfolio drawdown
      await this.checkPortfolioDrawdown();

      // Check database health
      await this.checkDatabaseHealth();

    } catch (error) {
      logger.error('Error in periodic checks:', error);
      this.recordError(error, 'Periodic checks');
    }
  }

  /**
   * Check wallet balance
   */
  async checkWalletBalance() {
    try {
      const { Connection, PublicKey } = await import('@solana/web3.js');
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const walletPublicKey = new PublicKey(config.wallet.publicKey);
      const balance = await connection.getBalance(walletPublicKey);
      const solBalance = balance / 1e9;

      if (solBalance < this.thresholds.minWalletBalanceSOL) {
        this.createAlert(
          'LOW_BALANCE',
          `Wallet balance critically low: ${solBalance.toFixed(4)} SOL`,
          'CRITICAL'
        );
      } else if (solBalance < this.thresholds.minWalletBalanceSOL * 2) {
        this.createAlert(
          'LOW_BALANCE',
          `Wallet balance low: ${solBalance.toFixed(4)} SOL`,
          'HIGH'
        );
      }
    } catch (error) {
      logger.error('Failed to check wallet balance:', error);
    }
  }

  /**
   * Check portfolio drawdown
   */
  async checkPortfolioDrawdown() {
    try {
      const riskManager = (await import('./risk-manager.service.js')).default;
      const activePositions = await database.getActivePositions();

      if (activePositions.length === 0) return;

      const currentDrawdown = riskManager.currentDrawdown || 0;

      if (currentDrawdown > this.thresholds.maxDrawdownPercent) {
        this.createAlert(
          'HIGH_DRAWDOWN',
          `Portfolio drawdown: ${currentDrawdown.toFixed(2)}%`,
          'HIGH'
        );
      }
    } catch (error) {
      logger.error('Failed to check portfolio drawdown:', error);
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    try {
      await database.query('SELECT 1');
    } catch (error) {
      this.createAlert(
        'DATABASE_ERROR',
        `Database connection issue: ${error.message}`,
        'CRITICAL'
      );
    }
  }

  /**
   * Get recent errors count
   */
  getRecentErrors(minutes) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.errorHistory.filter(e => e.timestamp > cutoff).length;
  }

  /**
   * Get recent failed transactions count
   */
  getRecentFailedTx(minutes) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.txHistory.filter(tx => !tx.success && tx.timestamp > cutoff).length;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get metrics summary
   */
  getMetrics() {
    const uptimeHours = (Date.now() - this.metrics.startTime) / (1000 * 60 * 60);

    return {
      uptime: {
        hours: uptimeHours.toFixed(2),
        startTime: new Date(this.metrics.startTime).toISOString(),
      },
      activity: {
        positionsEntered: this.metrics.positionsEntered,
        positionsExited: this.metrics.positionsExited,
        rewardsClaimed: this.metrics.rewardsClaimed,
        lastActivity: new Date(this.metrics.lastActivity).toISOString(),
      },
      transactions: {
        total: this.metrics.transactions.total,
        successful: this.metrics.transactions.successful,
        failed: this.metrics.transactions.failed,
        successRate: this.metrics.transactions.total > 0
          ? ((this.metrics.transactions.successful / this.metrics.transactions.total) * 100).toFixed(2) + '%'
          : 'N/A',
      },
      errors: {
        total: this.metrics.errors,
        warnings: this.metrics.warnings,
        recentErrors: this.getRecentErrors(60),
      },
      alerts: {
        total: this.alerts.length,
        active: this.getActiveAlerts().length,
      },
    };
  }

  /**
   * Generate daily summary
   */
  async generateDailySummary() {
    try {
      const metrics = this.getMetrics();
      const feeTracker = (await import('./fee-tracker.service.js')).default;
      const portfolioFees = await feeTracker.getPortfolioFeeStats();

      logger.info('\n' + '='.repeat(60));
      logger.info('DAILY SUMMARY - ' + new Date().toLocaleDateString());
      logger.info('='.repeat(60));
      logger.info(`Uptime: ${metrics.uptime.hours} hours`);
      logger.info(`Positions Entered: ${metrics.activity.positionsEntered}`);
      logger.info(`Positions Exited: ${metrics.activity.positionsExited}`);
      logger.info(`Rewards Claimed: ${metrics.activity.rewardsClaimed}`);
      logger.info(`Transactions: ${metrics.transactions.total} (${metrics.transactions.successRate} success rate)`);
      logger.info(`Net Fees Earned: $${portfolioFees?.netFeesEarned.toFixed(4) || '0.0000'}`);
      logger.info(`Errors: ${metrics.errors.total} total, ${metrics.errors.recentErrors} recent`);
      logger.info(`Active Alerts: ${metrics.alerts.active}`);
      logger.info('='.repeat(60) + '\n');

      // Send via Telegram
      const notification = (await import('./notification.service.js')).default;
      await notification.sendDailySummary({
        totalPositionsEntered: metrics.activity.positionsEntered,
        totalPositionsExited: metrics.activity.positionsExited,
        totalRewardsClaimed: metrics.activity.rewardsClaimed,
        errors: metrics.errors.total,
        activePositions: portfolioFees?.activePositions || 0,
        totalPnL: portfolioFees?.netFeesEarned || 0,
        successRate: parseFloat(metrics.transactions.successRate),
      });

      // Reset daily counters
      this.metrics.positionsEntered = 0;
      this.metrics.positionsExited = 0;
      this.metrics.rewardsClaimed = 0;
      this.metrics.errors = 0;
      this.metrics.warnings = 0;

    } catch (error) {
      logger.error('Failed to generate daily summary:', error);
    }
  }

  /**
   * Schedule daily summary
   */
  scheduleDailySummary() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow - now;

    // First summary at midnight
    setTimeout(() => {
      this.generateDailySummary();

      // Then every 24 hours
      this.dailySummaryInterval = setInterval(() => {
        this.generateDailySummary();
      }, 24 * 60 * 60 * 1000);

    }, msUntilMidnight);

    logger.info(`Daily summary scheduled for ${tomorrow.toLocaleString()}`);
  }
}

export default new MonitoringService();
