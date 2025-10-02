import DLMM from '@meteora-ag/dlmm';
import { PublicKey } from '@solana/web3.js';
import solanaService from './solana.service.js';
import logger from '../utils/logger.js';
import { retry } from '../utils/helpers.js';

class DLMMService {
  constructor() {
    this.dlmmInstances = new Map();
  }

  /**
   * Get or create DLMM instance for a pool
   */
  async getDLMM(poolAddress) {
    try {
      const poolPubkey = new PublicKey(poolAddress);

      // Return cached instance if exists
      if (this.dlmmInstances.has(poolAddress)) {
        return this.dlmmInstances.get(poolAddress);
      }

      // Create new DLMM instance
      const connection = solanaService.getConnection();
      const dlmmPool = await retry(
        () => DLMM.create(connection, poolPubkey),
        3,
        2000
      );

      // Cache the instance
      this.dlmmInstances.set(poolAddress, dlmmPool);

      logger.debug(`Created DLMM instance for pool: ${poolAddress}`);
      return dlmmPool;
    } catch (error) {
      logger.error(`Failed to create DLMM instance for ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get pool information
   */
  async getPoolInfo(poolAddress) {
    try {
      const dlmmPool = await this.getDLMM(poolAddress);

      return {
        address: poolAddress,
        tokenX: dlmmPool.tokenX.publicKey.toBase58(),
        tokenY: dlmmPool.tokenY.publicKey.toBase58(),
        binStep: dlmmPool.lbPair.binStep,
        baseFactor: dlmmPool.lbPair.baseFactor,
        activeId: dlmmPool.lbPair.activeId,
        protocolFee: dlmmPool.lbPair.protocolFeePercentage,
      };
    } catch (error) {
      logger.error(`Failed to get pool info for ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get pool reserves and liquidity
   */
  async getPoolReserves(poolAddress) {
    try {
      const dlmmPool = await this.getDLMM(poolAddress);

      const reserveX = dlmmPool.lbPair.reserveX;
      const reserveY = dlmmPool.lbPair.reserveY;

      return {
        reserveX: reserveX.toString(),
        reserveY: reserveY.toString(),
      };
    } catch (error) {
      logger.error(`Failed to get pool reserves for ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get user positions for a pool
   */
  async getUserPositions(poolAddress) {
    try {
      const connection = solanaService.getConnection();
      const wallet = solanaService.getWallet();
      const poolPubkey = new PublicKey(poolAddress);

      const positions = await DLMM.getPositionsByUserAndLbPair(
        connection,
        wallet.publicKey,
        poolPubkey
      );

      return positions.userPositions.map(pos => ({
        publicKey: pos.publicKey.toBase58(),
        positionData: pos.positionData,
        lowerBinId: pos.positionData.lowerBinId,
        upperBinId: pos.positionData.upperBinId,
        liquidity: pos.positionData.liquidityShares.toString(),
      }));
    } catch (error) {
      logger.error(`Failed to get user positions for ${poolAddress}:`, error);
      return [];
    }
  }

  /**
   * Create position and add liquidity
   */
  async addLiquidity(poolAddress, params) {
    try {
      const {
        strategy, // 'spot', 'curve', 'bidask'
        totalAmount,
        minBinId,
        maxBinId,
        slippage = 1, // 1%
      } = params;

      const dlmmPool = await this.getDLMM(poolAddress);
      const wallet = solanaService.getWallet();

      logger.info(`Adding liquidity to ${poolAddress} with ${strategy} strategy`);

      // Determine strategy type
      let strategyType;
      if (strategy === 'spot') {
        strategyType = { spot: {} };
      } else if (strategy === 'curve') {
        strategyType = { curve: {} };
      } else if (strategy === 'bidask') {
        strategyType = { bidAsk: {} };
      } else {
        throw new Error(`Unknown strategy: ${strategy}`);
      }

      // Create position and add liquidity
      const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: wallet.publicKey,
        user: wallet.publicKey,
        totalXAmount: totalAmount.tokenX,
        totalYAmount: totalAmount.tokenY,
        strategy: strategyType,
        minBinId,
        maxBinId,
        slippageBps: slippage * 100, // Convert to basis points
      });

      // Sign and send transaction
      const txSignature = await solanaService.getConnection().sendTransaction(
        createPositionTx,
        [wallet],
        { skipPreflight: false }
      );

      // Wait for confirmation
      await solanaService.confirmTransaction(txSignature);

      logger.info(`Liquidity added successfully. Tx: ${txSignature}`);

      return {
        signature: txSignature,
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to add liquidity to ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Remove liquidity from position
   */
  async removeLiquidity(poolAddress, positionPubkey, params = {}) {
    try {
      const {
        bps = 10000, // 100% by default
        shouldClaimAndClose = true,
      } = params;

      const dlmmPool = await this.getDLMM(poolAddress);
      const wallet = solanaService.getWallet();
      const position = new PublicKey(positionPubkey);

      logger.info(`Removing liquidity from position ${positionPubkey}`);

      const removeLiquidityTx = await dlmmPool.removeLiquidity({
        position,
        user: wallet.publicKey,
        bps,
        shouldClaimAndClose,
      });

      // Sign and send transaction
      const txSignature = await solanaService.getConnection().sendTransaction(
        removeLiquidityTx,
        [wallet],
        { skipPreflight: false }
      );

      // Wait for confirmation
      await solanaService.confirmTransaction(txSignature);

      logger.info(`Liquidity removed successfully. Tx: ${txSignature}`);

      return {
        signature: txSignature,
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to remove liquidity from ${positionPubkey}:`, error);
      throw error;
    }
  }

  /**
   * Claim swap fees from position
   */
  async claimFees(poolAddress, positionPubkey) {
    try {
      const dlmmPool = await this.getDLMM(poolAddress);
      const wallet = solanaService.getWallet();
      const position = new PublicKey(positionPubkey);

      logger.info(`Claiming fees from position ${positionPubkey}`);

      const claimTx = await dlmmPool.claimSwapFee({
        position,
        user: wallet.publicKey,
      });

      // Sign and send transaction
      const txSignature = await solanaService.getConnection().sendTransaction(
        claimTx,
        [wallet],
        { skipPreflight: false }
      );

      // Wait for confirmation
      await solanaService.confirmTransaction(txSignature);

      logger.info(`Fees claimed successfully. Tx: ${txSignature}`);

      return {
        signature: txSignature,
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to claim fees from ${positionPubkey}:`, error);
      throw error;
    }
  }

  /**
   * Claim all LM rewards from position
   */
  async claimRewards(poolAddress, positionPubkey) {
    try {
      const dlmmPool = await this.getDLMM(poolAddress);
      const wallet = solanaService.getWallet();
      const position = new PublicKey(positionPubkey);

      logger.info(`Claiming LM rewards from position ${positionPubkey}`);

      const claimTx = await dlmmPool.claimAllLMRewards({
        positions: [position],
        user: wallet.publicKey,
      });

      if (!claimTx) {
        logger.info('No rewards to claim');
        return { success: false, reason: 'No rewards available' };
      }

      // Sign and send transaction
      const txSignature = await solanaService.getConnection().sendTransaction(
        claimTx,
        [wallet],
        { skipPreflight: false }
      );

      // Wait for confirmation
      await solanaService.confirmTransaction(txSignature);

      logger.info(`Rewards claimed successfully. Tx: ${txSignature}`);

      return {
        signature: txSignature,
        success: true,
      };
    } catch (error) {
      logger.error(`Failed to claim rewards from ${positionPubkey}:`, error);
      throw error;
    }
  }

  /**
   * Get active bin price
   */
  async getActiveBinPrice(poolAddress) {
    try {
      const dlmmPool = await this.getDLMM(poolAddress);
      const activeBin = await dlmmPool.getActiveBin();

      return {
        binId: activeBin.binId,
        price: activeBin.price,
        pricePerToken: activeBin.pricePerToken,
      };
    } catch (error) {
      logger.error(`Failed to get active bin price for ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Clear cache for a pool
   */
  clearCache(poolAddress) {
    this.dlmmInstances.delete(poolAddress);
  }

  /**
   * Clear all cached instances
   */
  clearAllCache() {
    this.dlmmInstances.clear();
  }
}

export default new DLMMService();
