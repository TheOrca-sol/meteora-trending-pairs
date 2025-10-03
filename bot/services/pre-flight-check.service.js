import { Connection, PublicKey } from '@solana/web3.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import database from '../models/database.js';

/**
 * Pre-Flight Check Service
 * Comprehensive validation before live trading deployment
 */
class PreFlightCheckService {
  constructor() {
    this.checks = [];
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  /**
   * Run all pre-flight checks
   */
  async runAllChecks() {
    logger.info('🚀 Starting pre-flight checks...\n');

    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };

    // Critical checks (must pass)
    await this.checkWalletConfiguration();
    await this.checkWalletBalance();
    await this.checkDatabaseConnection();
    await this.checkSolanaRPC();
    await this.checkTelegramConfiguration();
    await this.checkConfigurationSettings();
    await this.checkStrategyRegistry();
    await this.checkPriceFeedService();

    // Warning checks (should pass, but not critical)
    await this.checkDiskSpace();
    await this.checkMemory();

    // Generate report
    return this.generateReport();
  }

  /**
   * Check wallet configuration
   */
  async checkWalletConfiguration() {
    const checkName = 'Wallet Configuration';
    try {
      if (config.bot.paperTrading) {
        this.addWarning(checkName, 'Paper trading mode enabled - no wallet validation needed');
        return;
      }

      if (!config.wallet.privateKey || config.wallet.privateKey === 'your_wallet_private_key') {
        this.addFailure(checkName, 'Wallet private key not configured in .env');
        return;
      }

      // Validate private key format (should be base58 string)
      if (config.wallet.privateKey.length < 32) {
        this.addFailure(checkName, 'Invalid private key format');
        return;
      }

      this.addSuccess(checkName, 'Wallet private key configured');
    } catch (error) {
      this.addFailure(checkName, error.message);
    }
  }

  /**
   * Check wallet balance
   */
  async checkWalletBalance() {
    const checkName = 'Wallet Balance';
    try {
      if (config.bot.paperTrading) {
        this.addSuccess(checkName, `Paper trading: $${config.bot.paperTradingStartingCapital} simulated capital`);
        return;
      }

      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const walletPublicKey = new PublicKey(config.wallet.publicKey);
      const balance = await connection.getBalance(walletPublicKey);
      const solBalance = balance / 1e9;

      if (solBalance < 0.1) {
        this.addFailure(checkName, `Insufficient balance: ${solBalance} SOL (minimum 0.1 SOL recommended)`);
        return;
      }

      if (solBalance < 0.5) {
        this.addWarning(checkName, `Low balance: ${solBalance} SOL (0.5+ SOL recommended for meaningful positions)`);
        return;
      }

      this.addSuccess(checkName, `Wallet balance: ${solBalance.toFixed(4)} SOL`);
    } catch (error) {
      this.addFailure(checkName, error.message);
    }
  }

  /**
   * Check database connection
   */
  async checkDatabaseConnection() {
    const checkName = 'Database Connection';
    try {
      await database.query('SELECT 1');
      this.addSuccess(checkName, 'Database connected and responsive');
    } catch (error) {
      this.addFailure(checkName, `Database connection failed: ${error.message}`);
    }
  }

  /**
   * Check Solana RPC connection
   */
  async checkSolanaRPC() {
    const checkName = 'Solana RPC Connection';
    try {
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const slot = await connection.getSlot();

      if (!slot || slot === 0) {
        this.addFailure(checkName, 'RPC returned invalid slot');
        return;
      }

      this.addSuccess(checkName, `RPC connected (current slot: ${slot})`);
    } catch (error) {
      this.addFailure(checkName, `RPC connection failed: ${error.message}`);
    }
  }

  /**
   * Check Telegram configuration
   */
  async checkTelegramConfiguration() {
    const checkName = 'Telegram Configuration';
    try {
      if (!config.notifications.telegram.enabled) {
        this.addWarning(checkName, 'Telegram notifications disabled');
        return;
      }

      if (!config.notifications.telegram.botToken ||
          config.notifications.telegram.botToken === 'your_telegram_bot_token') {
        this.addWarning(checkName, 'Telegram bot token not configured');
        return;
      }

      if (!config.notifications.telegram.chatId ||
          config.notifications.telegram.chatId === 'your_chat_id') {
        this.addWarning(checkName, 'Telegram chat ID not configured');
        return;
      }

      this.addSuccess(checkName, 'Telegram notifications configured');
    } catch (error) {
      this.addWarning(checkName, error.message);
    }
  }

  /**
   * Check configuration settings
   */
  async checkConfigurationSettings() {
    const checkName = 'Configuration Settings';
    try {
      const warnings = [];

      // Check trading parameters
      if (config.bot.maxPositions < 1) {
        warnings.push('maxPositions should be at least 1');
      }

      if (config.bot.maxPositions > 20) {
        warnings.push('maxPositions > 20 may be difficult to manage');
      }

      if (config.bot.minTvl < 10000) {
        warnings.push('minTvl < $10k may have low liquidity');
      }

      if (config.bot.minApr < 10) {
        warnings.push('minApr < 10% may not be profitable after gas costs');
      }

      if (config.bot.maxPositionPercent > 50) {
        warnings.push('maxPositionPercent > 50% is risky (not diversified)');
      }

      if (config.bot.minReservePercent < 10) {
        warnings.push('minReservePercent < 10% leaves little safety margin');
      }

      // Check risk parameters
      if (config.risk.maxImpermanentLossPercent > 30) {
        warnings.push('maxImpermanentLossPercent > 30% is very risky');
      }

      if (warnings.length > 0) {
        this.addWarning(checkName, warnings.join('; '));
      } else {
        this.addSuccess(checkName, 'Configuration parameters look reasonable');
      }
    } catch (error) {
      this.addWarning(checkName, error.message);
    }
  }

  /**
   * Check strategy registry
   */
  async checkStrategyRegistry() {
    const checkName = 'Strategy Registry';
    try {
      const { initializeStrategies, strategyRegistry } = await import('./strategies/index.js');

      // Initialize strategies
      initializeStrategies();

      const strategies = strategyRegistry.listStrategies();

      if (strategies.length === 0) {
        this.addFailure(checkName, 'No strategies registered');
        return;
      }

      this.addSuccess(checkName, `${strategies.length} strategies registered and ready`);
    } catch (error) {
      this.addFailure(checkName, `Failed to load strategies: ${error.message}`);
    }
  }

  /**
   * Check price feed service
   */
  async checkPriceFeedService() {
    const checkName = 'Price Feed Service';
    try {
      const priceFeed = (await import('./price-feed.service.js')).default;
      const solPrice = await priceFeed.getSolPrice();

      if (!solPrice || solPrice <= 0) {
        this.addFailure(checkName, 'Invalid SOL price returned');
        return;
      }

      if (solPrice < 10 || solPrice > 1000) {
        this.addWarning(checkName, `SOL price seems unusual: $${solPrice}`);
        return;
      }

      this.addSuccess(checkName, `Price feed working (SOL: $${solPrice.toFixed(2)})`);
    } catch (error) {
      this.addFailure(checkName, `Price feed failed: ${error.message}`);
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    const checkName = 'Disk Space';
    try {
      const { execSync } = await import('child_process');
      const output = execSync("df -h / | tail -1 | awk '{print $5}'").toString().trim();
      const usagePercent = parseInt(output);

      if (usagePercent > 90) {
        this.addWarning(checkName, `Disk ${usagePercent}% full - consider cleanup`);
      } else {
        this.addSuccess(checkName, `Disk usage: ${usagePercent}%`);
      }
    } catch (error) {
      this.addWarning(checkName, 'Could not check disk space');
    }
  }

  /**
   * Check available memory
   */
  async checkMemory() {
    const checkName = 'System Memory';
    try {
      const { execSync } = await import('child_process');
      const output = execSync("free -m | grep Mem | awk '{print $3/$2 * 100.0}'").toString().trim();
      const usagePercent = parseFloat(output);

      if (usagePercent > 90) {
        this.addWarning(checkName, `Memory ${usagePercent.toFixed(1)}% used - system may be slow`);
      } else {
        this.addSuccess(checkName, `Memory usage: ${usagePercent.toFixed(1)}%`);
      }
    } catch (error) {
      this.addWarning(checkName, 'Could not check memory usage');
    }
  }

  /**
   * Add successful check
   */
  addSuccess(name, message) {
    this.results.passed.push({ name, message });
    logger.info(`✅ ${name}: ${message}`);
  }

  /**
   * Add failed check
   */
  addFailure(name, message) {
    this.results.failed.push({ name, message });
    logger.error(`❌ ${name}: ${message}`);
  }

  /**
   * Add warning
   */
  addWarning(name, message) {
    this.results.warnings.push({ name, message });
    logger.warn(`⚠️  ${name}: ${message}`);
  }

  /**
   * Generate final report
   */
  generateReport() {
    const totalChecks = this.results.passed.length + this.results.failed.length + this.results.warnings.length;
    const allPassed = this.results.failed.length === 0;

    logger.info('\n' + '='.repeat(60));
    logger.info('PRE-FLIGHT CHECK REPORT');
    logger.info('='.repeat(60));
    logger.info(`Total Checks: ${totalChecks}`);
    logger.info(`✅ Passed: ${this.results.passed.length}`);
    logger.info(`⚠️  Warnings: ${this.results.warnings.length}`);
    logger.info(`❌ Failed: ${this.results.failed.length}`);
    logger.info('='.repeat(60));

    if (allPassed) {
      logger.info('✅ ALL CHECKS PASSED - READY FOR DEPLOYMENT');
    } else {
      logger.error('❌ SOME CHECKS FAILED - FIX ISSUES BEFORE DEPLOYING');
      logger.info('\nFailed checks:');
      this.results.failed.forEach(check => {
        logger.error(`  - ${check.name}: ${check.message}`);
      });
    }

    if (this.results.warnings.length > 0) {
      logger.info('\nWarnings (review recommended):');
      this.results.warnings.forEach(check => {
        logger.warn(`  - ${check.name}: ${check.message}`);
      });
    }

    logger.info('='.repeat(60) + '\n');

    return {
      passed: allPassed,
      totalChecks,
      passedCount: this.results.passed.length,
      warningCount: this.results.warnings.length,
      failedCount: this.results.failed.length,
      checks: this.results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get live deployment checklist
   */
  getLiveDeploymentChecklist() {
    return {
      before: [
        '☐ Run pre-flight checks and ensure all pass',
        '☐ Verify wallet has sufficient SOL (0.5+ SOL recommended)',
        '☐ Backup wallet private key securely',
        '☐ Set PAPER_TRADING=false in .env',
        '☐ Review and adjust config parameters (maxPositions, minTvl, minApr)',
        '☐ Set conservative limits for first deployment',
        '☐ Ensure Telegram notifications are working',
        '☐ Document emergency contact procedures',
      ],
      during: [
        '☐ Monitor bot logs continuously for first 1-2 hours',
        '☐ Watch Telegram notifications',
        '☐ Verify first position entry executes correctly',
        '☐ Check transaction signatures on Solscan',
        '☐ Monitor wallet balance changes',
        '☐ Be ready to use /pause or /emergency commands',
      ],
      after: [
        '☐ Review first 24 hours of performance',
        '☐ Check /stats and /fees commands',
        '☐ Verify database is recording correctly',
        '☐ Review any errors or warnings in logs',
        '☐ Gradually increase position sizes if performing well',
        '☐ Set up automated daily reports',
      ],
      emergency: [
        '☐ Use /pause to temporarily stop new positions',
        '☐ Use /emergency to exit all positions immediately',
        '☐ Check health status with /health',
        '☐ Review risk report with /risk',
        '☐ Check logs for error details',
        '☐ Contact support if needed',
      ],
    };
  }
}

export default new PreFlightCheckService();
