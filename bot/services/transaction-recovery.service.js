import logger from '../utils/logger.js';
import { Connection } from '@solana/web3.js';
import config from '../config/config.js';

/**
 * Transaction Recovery Service
 * Handles transaction failures and implements recovery strategies
 */
class TransactionRecoveryService {
  constructor() {
    this.failedTransactions = new Map(); // signature -> retry info
    this.maxRetries = 3;
    this.retryDelays = [5000, 15000, 30000]; // 5s, 15s, 30s
  }

  /**
   * Execute transaction with automatic retry logic
   */
  async executeWithRetry(
    txFunction,
    context = {},
    options = {}
  ) {
    const maxRetries = options.maxRetries || this.maxRetries;
    const retryDelays = options.retryDelays || this.retryDelays;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Transaction attempt ${attempt + 1}/${maxRetries + 1}`, context);

        const result = await txFunction();

        // Success
        if (attempt > 0) {
          logger.info(`Transaction succeeded on attempt ${attempt + 1}`, context);
        }

        return {
          success: true,
          result,
          attempts: attempt + 1,
        };

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        logger.error(`Transaction attempt ${attempt + 1} failed:`, {
          error: error.message,
          context,
          isLastAttempt,
        });

        if (isLastAttempt) {
          // All retries exhausted
          return {
            success: false,
            error,
            attempts: attempt + 1,
            reason: 'Max retries exceeded',
          };
        }

        // Analyze error and decide if we should retry
        const errorAnalysis = this.analyzeError(error);

        if (!errorAnalysis.shouldRetry) {
          logger.error('Error is not retryable, aborting', errorAnalysis);
          return {
            success: false,
            error,
            attempts: attempt + 1,
            reason: errorAnalysis.reason,
          };
        }

        // Wait before next retry
        const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
        logger.info(`Waiting ${delay}ms before retry ${attempt + 2}...`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Analyze error to determine if retry is appropriate
   */
  analyzeError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorString = String(error).toLowerCase();

    // Non-retryable errors (permanent failures)
    const nonRetryablePatterns = [
      'insufficient funds',
      'insufficient lamports',
      'account does not exist',
      'invalid account',
      'signature verification failed',
      'transaction too large',
      'invalid instruction',
      'program error',
    ];

    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern) || errorString.includes(pattern)) {
        return {
          shouldRetry: false,
          reason: `Non-retryable error: ${pattern}`,
          errorType: 'PERMANENT',
        };
      }
    }

    // Retryable errors (transient failures)
    const retryablePatterns = [
      'blockhash not found',
      'timeout',
      'network',
      'connection',
      'rpc',
      'rate limit',
      'too many requests',
      'temporarily unavailable',
      'try again',
    ];

    for (const pattern of retryablePatterns) {
      if (errorMessage.includes(pattern) || errorString.includes(pattern)) {
        return {
          shouldRetry: true,
          reason: `Retryable error: ${pattern}`,
          errorType: 'TRANSIENT',
        };
      }
    }

    // Default: retry unknown errors (conservative approach)
    return {
      shouldRetry: true,
      reason: 'Unknown error, attempting retry',
      errorType: 'UNKNOWN',
    };
  }

  /**
   * Monitor transaction confirmation
   */
  async monitorTransaction(signature, options = {}) {
    const maxAttempts = options.maxAttempts || 30; // 30 * 2s = 60s timeout
    const pollInterval = options.pollInterval || 2000; // 2 seconds
    const commitment = options.commitment || 'confirmed';

    const connection = new Connection(config.solana.rpcUrl, commitment);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await connection.getSignatureStatus(signature);

        if (status?.value?.confirmationStatus === 'confirmed' ||
            status?.value?.confirmationStatus === 'finalized') {

          if (status.value.err) {
            logger.error(`Transaction ${signature} failed:`, status.value.err);
            return {
              confirmed: true,
              success: false,
              error: status.value.err,
              signature,
            };
          }

          logger.info(`Transaction ${signature} confirmed`);
          return {
            confirmed: true,
            success: true,
            signature,
            confirmationStatus: status.value.confirmationStatus,
          };
        }

        // Still pending, wait and retry
        await this.sleep(pollInterval);

      } catch (error) {
        logger.warn(`Error checking transaction status (attempt ${attempt + 1}):`, error.message);

        if (attempt === maxAttempts - 1) {
          return {
            confirmed: false,
            success: false,
            error: new Error('Transaction confirmation timeout'),
            signature,
          };
        }

        await this.sleep(pollInterval);
      }
    }

    return {
      confirmed: false,
      success: false,
      error: new Error('Transaction confirmation timeout'),
      signature,
    };
  }

  /**
   * Handle failed transaction
   */
  async handleFailure(signature, error, context = {}) {
    logger.error('Transaction failed:', {
      signature,
      error: error.message,
      context,
    });

    // Store failed transaction info
    this.failedTransactions.set(signature, {
      timestamp: Date.now(),
      error: error.message,
      context,
    });

    // Keep only last 100 failed transactions
    if (this.failedTransactions.size > 100) {
      const firstKey = this.failedTransactions.keys().next().value;
      this.failedTransactions.delete(firstKey);
    }

    // Notify monitoring service
    try {
      const monitoring = (await import('./monitoring.service.js')).default;
      monitoring.recordTransaction(false, context.type || 'unknown', signature);
      monitoring.recordError(error, `Transaction failure: ${context.type || 'unknown'}`);
    } catch (err) {
      logger.error('Failed to record transaction failure:', err);
    }

    // Check if we should alert
    const recentFailures = this.getRecentFailures(15); // Last 15 minutes
    if (recentFailures >= 5) {
      await this.alertHighFailureRate(recentFailures);
    }
  }

  /**
   * Handle successful transaction
   */
  async handleSuccess(signature, context = {}) {
    logger.info('Transaction successful:', {
      signature,
      context,
    });

    // Notify monitoring service
    try {
      const monitoring = (await import('./monitoring.service.js')).default;
      monitoring.recordTransaction(true, context.type || 'unknown', signature);
    } catch (err) {
      logger.error('Failed to record transaction success:', err);
    }
  }

  /**
   * Get recent failure count
   */
  getRecentFailures(minutes) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    let count = 0;

    for (const [sig, info] of this.failedTransactions) {
      if (info.timestamp > cutoff) {
        count++;
      }
    }

    return count;
  }

  /**
   * Alert on high failure rate
   */
  async alertHighFailureRate(failureCount) {
    try {
      const monitoring = (await import('./monitoring.service.js')).default;
      monitoring.createAlert(
        'HIGH_TX_FAILURE_RATE',
        `${failureCount} transaction failures in the last 15 minutes`,
        'HIGH'
      );
    } catch (error) {
      logger.error('Failed to send high failure rate alert:', error);
    }
  }

  /**
   * Recover from stuck transaction
   */
  async recoverStuckTransaction(signature) {
    logger.warn(`Attempting to recover stuck transaction: ${signature}`);

    try {
      const connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const status = await connection.getSignatureStatus(signature);

      if (!status?.value) {
        return {
          recovered: false,
          reason: 'Transaction not found',
        };
      }

      if (status.value.err) {
        return {
          recovered: false,
          reason: 'Transaction failed on-chain',
          error: status.value.err,
        };
      }

      if (status.value.confirmationStatus === 'confirmed' ||
          status.value.confirmationStatus === 'finalized') {
        return {
          recovered: true,
          reason: 'Transaction was actually confirmed',
        };
      }

      return {
        recovered: false,
        reason: 'Transaction still pending',
      };

    } catch (error) {
      logger.error('Error recovering stuck transaction:', error);
      return {
        recovered: false,
        reason: error.message,
      };
    }
  }

  /**
   * Get failed transactions summary
   */
  getFailureSummary() {
    const now = Date.now();
    const last15Min = now - (15 * 60 * 1000);
    const last1Hour = now - (60 * 60 * 1000);
    const last24Hours = now - (24 * 60 * 60 * 1000);

    let recent = 0;
    let hourly = 0;
    let daily = 0;

    for (const [sig, info] of this.failedTransactions) {
      if (info.timestamp > last15Min) recent++;
      if (info.timestamp > last1Hour) hourly++;
      if (info.timestamp > last24Hours) daily++;
    }

    return {
      total: this.failedTransactions.size,
      last15Minutes: recent,
      lastHour: hourly,
      last24Hours: daily,
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new TransactionRecoveryService();
