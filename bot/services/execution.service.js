import logger from '../utils/logger.js';
import solanaService from './solana.service.js';
import dlmmService from './dlmm.service.js';
import database from '../models/database.js';
import { retry, parseError } from '../utils/helpers.js';

class ExecutionService {
  constructor() {
    this.pendingTransactions = new Set();
  }

  /**
   * Execute position entry
   */
  async enterPosition(liquidityParams) {
    try {
      const { poolAddress, poolName, strategy, binParams, tokenAmounts, slippage, scores } = liquidityParams;

      logger.info(`Entering position in ${poolName} (${poolAddress}) with ${strategy} strategy`);

      // Perform pre-flight checks
      const securityCheck = await this.preFlightCheck(poolAddress);
      if (!securityCheck.passed) {
        throw new Error(`Security check failed: ${securityCheck.reason}`);
      }

      // Add liquidity through DLMM SDK
      const result = await retry(
        () => dlmmService.addLiquidity(poolAddress, {
          strategy,
          totalAmount: {
            tokenX: tokenAmounts.tokenX,
            tokenY: tokenAmounts.tokenY,
          },
          minBinId: binParams.lowerBinId,
          maxBinId: binParams.upperBinId,
          slippage,
        }),
        2,
        3000
      );

      if (!result.success) {
        throw new Error('Failed to add liquidity');
      }

      logger.info(`Position entered successfully. Tx: ${result.signature}`);

      // Save position to database
      const positionId = await database.createPosition({
        poolAddress,
        positionPubkey: result.positionPubkey || 'pending', // TODO: Get from transaction
        strategy,
        entryPrice: liquidityParams.entryPrice,
        entryTvl: liquidityParams.entryTvl,
        entryApr: liquidityParams.entryApr,
        liquidityAmount: liquidityParams.positionValue,
        lowerBinId: binParams.lowerBinId,
        upperBinId: binParams.upperBinId,
      });

      // Log event
      await database.logEvent(
        'position_entered',
        positionId,
        poolAddress,
        `Entered ${strategy} position in ${poolName}`,
        {
          signature: result.signature,
          positionValue: liquidityParams.positionValue,
          scores,
          strategy: liquidityParams.strategyReason,
        }
      );

      return {
        success: true,
        positionId,
        signature: result.signature,
        poolAddress,
        poolName,
      };
    } catch (error) {
      logger.error(`Failed to enter position in ${liquidityParams.poolAddress}:`, error);

      // Log failed event
      await database.logEvent(
        'position_entry_failed',
        null,
        liquidityParams.poolAddress,
        `Failed to enter position: ${parseError(error)}`,
        { error: parseError(error) }
      );

      return {
        success: false,
        error: parseError(error),
      };
    }
  }

  /**
   * Execute position exit
   */
  async exitPosition(position, reason, shouldClaimRewards = true) {
    try {
      logger.info(`Exiting position ${position.id} in ${position.pool_name}: ${reason}`);

      const { pool_address, position_pubkey } = position;

      // Claim rewards first if requested
      if (shouldClaimRewards) {
        await this.claimPositionRewards(position, pool_address, position_pubkey);
      }

      // Remove liquidity
      const result = await retry(
        () => dlmmService.removeLiquidity(pool_address, position_pubkey, {
          bps: 10000, // Remove 100%
          shouldClaimAndClose: true,
        }),
        2,
        3000
      );

      if (!result.success) {
        throw new Error('Failed to remove liquidity');
      }

      logger.info(`Position exited successfully. Tx: ${result.signature}`);

      // Update position status in database
      await database.updatePositionStatus(position.id, 'closed', reason);

      // Log event
      await database.logEvent(
        'position_exited',
        position.id,
        pool_address,
        `Exited position: ${reason}`,
        {
          signature: result.signature,
          reason,
        }
      );

      return {
        success: true,
        signature: result.signature,
        reason,
      };
    } catch (error) {
      logger.error(`Failed to exit position ${position.id}:`, error);

      // Log failed event
      await database.logEvent(
        'position_exit_failed',
        position.id,
        position.pool_address,
        `Failed to exit position: ${parseError(error)}`,
        { error: parseError(error) }
      );

      return {
        success: false,
        error: parseError(error),
      };
    }
  }

  /**
   * Claim rewards from position
   */
  async claimPositionRewards(position, poolAddress, positionPubkey) {
    try {
      logger.info(`Claiming rewards from position ${position.id}`);

      // Claim swap fees
      const feesResult = await dlmmService.claimFees(poolAddress, positionPubkey);

      // Claim LM rewards
      const rewardsResult = await dlmmService.claimRewards(poolAddress, positionPubkey);

      const signatures = [];
      if (feesResult.success) signatures.push(feesResult.signature);
      if (rewardsResult.success) signatures.push(rewardsResult.signature);

      if (signatures.length > 0) {
        logger.info(`Rewards claimed. Txs: ${signatures.join(', ')}`);

        // Log event
        await database.logEvent(
          'rewards_claimed',
          position.id,
          poolAddress,
          `Claimed rewards from position`,
          { signatures }
        );

        return { success: true, signatures };
      }

      return { success: false, reason: 'No rewards to claim' };
    } catch (error) {
      logger.error(`Failed to claim rewards from position ${position.id}:`, error);
      return { success: false, error: parseError(error) };
    }
  }

  /**
   * Emergency exit all positions
   */
  async emergencyExitAll() {
    try {
      logger.warn('EMERGENCY EXIT: Exiting all positions');

      const activePositions = await database.getActivePositions();

      const results = [];
      for (const position of activePositions) {
        const result = await this.exitPosition(position, 'Emergency exit');
        results.push({
          positionId: position.id,
          poolName: position.pool_name,
          ...result,
        });

        // Small delay between exits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      logger.info(`Emergency exit completed. ${results.filter(r => r.success).length}/${results.length} positions exited`);

      return {
        success: true,
        results,
        exitedCount: results.filter(r => r.success).length,
        totalCount: results.length,
      };
    } catch (error) {
      logger.error('Emergency exit failed:', error);
      return {
        success: false,
        error: parseError(error),
      };
    }
  }

  /**
   * Pre-flight security and balance checks
   */
  async preFlightCheck(poolAddress) {
    try {
      // Check wallet balance
      const balance = await solanaService.getBalance();
      if (balance < 0.05) {
        return {
          passed: false,
          reason: `Insufficient SOL balance: ${balance} SOL`,
        };
      }

      // Import risk manager for security check
      const riskManager = (await import('./risk-manager.service.js')).default;
      const securityCheck = await riskManager.performSecurityCheck(poolAddress);

      if (!securityCheck.passed) {
        return securityCheck;
      }

      return {
        passed: true,
        balance,
      };
    } catch (error) {
      logger.error('Pre-flight check failed:', error);
      return {
        passed: false,
        reason: parseError(error),
      };
    }
  }

  /**
   * Check if transaction is pending
   */
  isTransactionPending(identifier) {
    return this.pendingTransactions.has(identifier);
  }

  /**
   * Mark transaction as pending
   */
  markTransactionPending(identifier) {
    this.pendingTransactions.add(identifier);
  }

  /**
   * Mark transaction as complete
   */
  markTransactionComplete(identifier) {
    this.pendingTransactions.delete(identifier);
  }

  /**
   * Get estimated gas cost for transaction
   */
  async estimateGasCost() {
    try {
      // Solana transactions are typically 0.000005 SOL
      // For DLMM operations, estimate higher due to complexity
      return 0.00001; // 0.00001 SOL ~ $0.002
    } catch (error) {
      logger.error('Failed to estimate gas cost:', error);
      return 0.00001;
    }
  }
}

export default new ExecutionService();
