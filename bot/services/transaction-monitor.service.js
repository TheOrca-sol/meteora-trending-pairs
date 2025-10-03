import { Connection } from '@solana/web3.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import database from '../models/database.js';

/**
 * Transaction Monitor Service
 * Monitors transaction confirmations and handles failures with retries
 */
class TransactionMonitorService {
  constructor() {
    this.connection = null;
    this.pendingTransactions = new Map();
    this.maxConfirmationAttempts = 30; // 30 attempts * 2s = 60s max wait
    this.confirmationCheckInterval = 2000; // Check every 2 seconds
  }

  /**
   * Initialize with Solana connection
   */
  initialize(connection) {
    this.connection = connection;
  }

  /**
   * Monitor transaction confirmation with retries
   */
  async monitorTransaction(signature, context = {}) {
    const startTime = Date.now();
    const txId = `${signature.substring(0, 8)}...`;

    logger.info(`Monitoring transaction ${txId}...`);

    try {
      // Add to pending transactions
      this.pendingTransactions.set(signature, {
        signature,
        context,
        startTime,
        attempts: 0,
      });

      // Wait for confirmation with retries
      let confirmed = false;
      let attempts = 0;
      let lastError = null;

      while (attempts < this.maxConfirmationAttempts && !confirmed) {
        attempts++;

        try {
          // Check transaction status
          const status = await this.connection.getSignatureStatus(signature, {
            searchTransactionHistory: true,
          });

          if (status?.value) {
            const confirmationStatus = status.value.confirmationStatus;

            if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
              confirmed = true;
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);

              logger.info(`✓ Transaction ${txId} ${confirmationStatus} after ${duration}s (${attempts} attempts)`);

              // Log to database
              await this.logTransaction(signature, 'confirmed', context, {
                confirmationStatus,
                attempts,
                duration: parseFloat(duration),
              });

              // Check for errors even if confirmed
              if (status.value.err) {
                logger.error(`Transaction ${txId} confirmed but has error:`, status.value.err);
                await this.logTransaction(signature, 'error', context, {
                  error: JSON.stringify(status.value.err),
                });

                return {
                  success: false,
                  error: `Transaction error: ${JSON.stringify(status.value.err)}`,
                  signature,
                };
              }

              this.pendingTransactions.delete(signature);
              return {
                success: true,
                signature,
                confirmationStatus,
                attempts,
                duration: parseFloat(duration),
              };
            }
          }

          // Wait before next attempt
          if (!confirmed) {
            await this.sleep(this.confirmationCheckInterval);
          }
        } catch (error) {
          lastError = error;
          logger.warn(`Attempt ${attempts}/${this.maxConfirmationAttempts} failed for ${txId}:`, error.message);

          // Wait before retry
          await this.sleep(this.confirmationCheckInterval);
        }
      }

      // Timeout reached
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.error(`✗ Transaction ${txId} confirmation timeout after ${duration}s (${attempts} attempts)`);

      await this.logTransaction(signature, 'timeout', context, {
        attempts,
        duration: parseFloat(duration),
        lastError: lastError?.message,
      });

      this.pendingTransactions.delete(signature);

      return {
        success: false,
        error: `Transaction confirmation timeout after ${duration}s`,
        signature,
        attempts,
      };
    } catch (error) {
      logger.error(`Error monitoring transaction ${txId}:`, error);

      await this.logTransaction(signature, 'monitor_error', context, {
        error: error.message,
      });

      this.pendingTransactions.delete(signature);

      return {
        success: false,
        error: `Monitoring error: ${error.message}`,
        signature,
      };
    }
  }

  /**
   * Log transaction to database
   */
  async logTransaction(signature, status, context, metadata = {}) {
    try {
      await database.logEvent(
        'transaction',
        context.positionId || null,
        context.poolAddress || null,
        `Transaction ${status}: ${signature}`,
        {
          signature,
          status,
          type: context.type || 'unknown',
          ...metadata,
        }
      );
    } catch (error) {
      logger.error('Failed to log transaction:', error);
    }
  }

  /**
   * Get pending transactions count
   */
  getPendingCount() {
    return this.pendingTransactions.size;
  }

  /**
   * Get all pending transactions
   */
  getPendingTransactions() {
    return Array.from(this.pendingTransactions.values()).map(tx => ({
      signature: tx.signature,
      context: tx.context,
      ageSeconds: ((Date.now() - tx.startTime) / 1000).toFixed(1),
      attempts: tx.attempts,
    }));
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry transaction with exponential backoff
   */
  async retryTransaction(txFunction, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug(`Transaction attempt ${attempt + 1}/${maxRetries}...`);

        const result = await txFunction();
        return result;
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = baseDelay * Math.pow(2, attempt);
          logger.debug(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`Transaction failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Get transaction details from blockchain
   */
  async getTransactionDetails(signature) {
    try {
      const tx = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx) {
        return {
          found: false,
          signature,
        };
      }

      return {
        found: true,
        signature,
        slot: tx.slot,
        blockTime: tx.blockTime,
        fee: tx.meta?.fee,
        success: !tx.meta?.err,
        error: tx.meta?.err,
        logs: tx.meta?.logMessages,
      };
    } catch (error) {
      logger.error(`Failed to get transaction details for ${signature}:`, error);
      return {
        found: false,
        signature,
        error: error.message,
      };
    }
  }
}

export default new TransactionMonitorService();
