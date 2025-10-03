import logger from '../utils/logger.js';
import database from '../models/database.js';
import priceFeed from './price-feed.service.js';

/**
 * Fee Tracker Service
 * Tracks actual fees earned and calculates net profitability
 */
class FeeTrackerService {
  constructor() {
    this.feeCache = new Map(); // positionId -> fees
    this.gasCosts = new Map(); // transactionId -> gas cost
    this.SOL_DECIMALS = 1e9; // SOL has 9 decimals
  }

  /**
   * Record fees claimed from a position
   */
  async recordFeesClaimed(positionId, feeAmounts, transactionSignature, gasCostSol) {
    try {
      const solPrice = await priceFeed.getSolPrice();

      // Calculate total fees in USD
      let totalFeesUsd = 0;
      const feeBreakdown = [];

      for (const fee of feeAmounts) {
        let feeUsd = 0;

        // Convert fee to USD based on token
        if (fee.mint === 'So11111111111111111111111111111111111111112') {
          // SOL
          feeUsd = (fee.amount / this.SOL_DECIMALS) * solPrice;
        } else {
          // Other tokens - try to get price
          // For now, estimate based on pool data
          feeUsd = fee.estimatedUsd || 0;
        }

        totalFeesUsd += feeUsd;
        feeBreakdown.push({
          mint: fee.mint,
          symbol: fee.symbol || 'Unknown',
          amount: fee.amount,
          usdValue: feeUsd,
        });
      }

      // Calculate gas cost in USD
      const gasCostUsd = gasCostSol * solPrice;

      // Net profit = fees - gas
      const netProfitUsd = totalFeesUsd - gasCostUsd;

      // Save to database
      await database.query(`
        INSERT INTO fee_claims (
          position_id,
          transaction_signature,
          total_fees_usd,
          gas_cost_sol,
          gas_cost_usd,
          net_profit_usd,
          fee_breakdown,
          claimed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        positionId,
        transactionSignature,
        totalFeesUsd,
        gasCostSol,
        gasCostUsd,
        netProfitUsd,
        JSON.stringify(feeBreakdown),
      ]);

      // Update position total fees
      await this.updatePositionTotalFees(positionId);

      logger.info(`Fees recorded for position ${positionId}: $${totalFeesUsd.toFixed(4)} (gas: $${gasCostUsd.toFixed(4)}, net: $${netProfitUsd.toFixed(4)})`);

      return {
        totalFeesUsd,
        gasCostUsd,
        netProfitUsd,
        feeBreakdown,
      };
    } catch (error) {
      logger.error('Failed to record fees claimed:', error);
      throw error;
    }
  }

  /**
   * Update position total fees earned
   */
  async updatePositionTotalFees(positionId) {
    try {
      const result = await database.query(`
        SELECT
          COALESCE(SUM(total_fees_usd), 0) as total_fees,
          COALESCE(SUM(gas_cost_usd), 0) as total_gas,
          COALESCE(SUM(net_profit_usd), 0) as total_net
        FROM fee_claims
        WHERE position_id = $1
      `, [positionId]);

      const totals = result.rows[0];

      await database.query(`
        UPDATE positions
        SET
          total_fees_earned = $1,
          total_gas_costs = $2,
          net_fees_earned = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [
        totals.total_fees,
        totals.total_gas,
        totals.total_net,
        positionId,
      ]);

      // Update cache
      this.feeCache.set(positionId, {
        totalFees: parseFloat(totals.total_fees),
        totalGas: parseFloat(totals.total_gas),
        netFees: parseFloat(totals.total_net),
      });

      return totals;
    } catch (error) {
      logger.error(`Failed to update total fees for position ${positionId}:`, error);
    }
  }

  /**
   * Get position fees summary
   */
  async getPositionFees(positionId) {
    try {
      // Check cache first
      if (this.feeCache.has(positionId)) {
        return this.feeCache.get(positionId);
      }

      const result = await database.query(`
        SELECT
          total_fees_earned,
          total_gas_costs,
          net_fees_earned,
          liquidity_amount,
          entry_timestamp,
          created_at
        FROM positions
        WHERE id = $1
      `, [positionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const position = result.rows[0];
      const fees = {
        totalFees: parseFloat(position.total_fees_earned || 0),
        totalGas: parseFloat(position.total_gas_costs || 0),
        netFees: parseFloat(position.net_fees_earned || 0),
        capitalDeployed: parseFloat(position.liquidity_amount || 0),
        daysActive: this.getDaysActive(position.entry_timestamp || position.created_at),
      };

      // Calculate ROI
      if (fees.capitalDeployed > 0) {
        fees.roi = (fees.netFees / fees.capitalDeployed) * 100;
        fees.dailyRoi = fees.daysActive > 0 ? fees.roi / fees.daysActive : 0;
        fees.annualizedRoi = fees.dailyRoi * 365;
      }

      // Cache it
      this.feeCache.set(positionId, fees);

      return fees;
    } catch (error) {
      logger.error(`Failed to get fees for position ${positionId}:`, error);
      return null;
    }
  }

  /**
   * Calculate days active
   */
  getDaysActive(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    return (now - start) / (1000 * 60 * 60 * 24);
  }

  /**
   * Estimate claimable fees for a position
   */
  async estimateClaimableFees(position, poolData) {
    try {
      // This is an estimation - actual implementation depends on Meteora DLMM SDK
      // For now, use APR and time elapsed

      const capitalDeployed = parseFloat(position.liquidity_amount || 0);
      const apr = poolData.apr || position.entry_apr || 0;

      if (capitalDeployed === 0 || apr === 0) {
        return {
          estimatedFeesUsd: 0,
          confidence: 'low',
        };
      }

      // Calculate time since last claim or position entry
      const lastClaimResult = await database.query(`
        SELECT MAX(claimed_at) as last_claim
        FROM fee_claims
        WHERE position_id = $1
      `, [position.id]);

      const lastClaimTime = lastClaimResult.rows[0]?.last_claim || position.entry_timestamp || position.created_at;
      const hoursSinceLastClaim = (Date.now() - new Date(lastClaimTime).getTime()) / (1000 * 60 * 60);

      // Estimate fees: (capital * APR * hours) / (365 * 24)
      const estimatedFeesUsd = (capitalDeployed * (apr / 100) * hoursSinceLastClaim) / (365 * 24);

      return {
        estimatedFeesUsd,
        hoursSinceLastClaim,
        confidence: 'medium', // Medium confidence since it's based on APR estimation
      };
    } catch (error) {
      logger.error('Failed to estimate claimable fees:', error);
      return {
        estimatedFeesUsd: 0,
        confidence: 'low',
      };
    }
  }

  /**
   * Check if claiming fees is profitable (fees > gas cost)
   */
  async shouldClaimFees(position, poolData, estimatedGasCostSol = 0.0001) {
    try {
      const feeEstimate = await this.estimateClaimableFees(position, poolData);
      const solPrice = await priceFeed.getSolPrice();
      const estimatedGasCostUsd = estimatedGasCostSol * solPrice;

      // Only claim if estimated fees are at least 2x gas cost (safety margin)
      const minProfitableAmount = estimatedGasCostUsd * 2;

      const shouldClaim = feeEstimate.estimatedFeesUsd >= minProfitableAmount;

      return {
        shouldClaim,
        estimatedFeesUsd: feeEstimate.estimatedFeesUsd,
        estimatedGasCostUsd,
        netProfit: feeEstimate.estimatedFeesUsd - estimatedGasCostUsd,
        profitMargin: estimatedGasCostUsd > 0 ? (feeEstimate.estimatedFeesUsd / estimatedGasCostUsd) : 0,
        reason: shouldClaim
          ? `Estimated fees ($${feeEstimate.estimatedFeesUsd.toFixed(4)}) > 2x gas ($${minProfitableAmount.toFixed(4)})`
          : `Estimated fees ($${feeEstimate.estimatedFeesUsd.toFixed(4)}) < 2x gas ($${minProfitableAmount.toFixed(4)})`,
      };
    } catch (error) {
      logger.error('Failed to check claim profitability:', error);
      return {
        shouldClaim: false,
        reason: 'Error checking profitability',
      };
    }
  }

  /**
   * Get all positions fees summary
   */
  async getAllPositionsFees() {
    try {
      const result = await database.query(`
        SELECT
          id,
          pool_address,
          strategy,
          total_fees_earned,
          total_gas_costs,
          net_fees_earned,
          liquidity_amount,
          status,
          entry_timestamp,
          created_at
        FROM positions
        WHERE total_fees_earned > 0
        ORDER BY net_fees_earned DESC
      `);

      const positions = result.rows.map(pos => ({
        positionId: pos.id,
        poolAddress: pos.pool_address,
        strategy: pos.strategy,
        status: pos.status,
        totalFees: parseFloat(pos.total_fees_earned || 0),
        totalGas: parseFloat(pos.total_gas_costs || 0),
        netFees: parseFloat(pos.net_fees_earned || 0),
        capitalDeployed: parseFloat(pos.liquidity_amount || 0),
        daysActive: this.getDaysActive(pos.entry_timestamp || pos.created_at),
        roi: parseFloat(pos.liquidity_amount) > 0
          ? (parseFloat(pos.net_fees_earned || 0) / parseFloat(pos.liquidity_amount)) * 100
          : 0,
      }));

      return positions;
    } catch (error) {
      logger.error('Failed to get all positions fees:', error);
      return [];
    }
  }

  /**
   * Get portfolio-wide fee statistics
   */
  async getPortfolioFeeStats() {
    try {
      const result = await database.query(`
        SELECT
          COUNT(*) as total_positions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_positions,
          COALESCE(SUM(total_fees_earned), 0) as total_fees,
          COALESCE(SUM(total_gas_costs), 0) as total_gas,
          COALESCE(SUM(net_fees_earned), 0) as total_net,
          COALESCE(SUM(liquidity_amount), 0) as total_capital
        FROM positions
      `);

      const stats = result.rows[0];

      return {
        totalPositions: parseInt(stats.total_positions),
        activePositions: parseInt(stats.active_positions),
        totalFeesEarned: parseFloat(stats.total_fees),
        totalGasCosts: parseFloat(stats.total_gas),
        netFeesEarned: parseFloat(stats.total_net),
        totalCapitalDeployed: parseFloat(stats.total_capital),
        portfolioROI: parseFloat(stats.total_capital) > 0
          ? (parseFloat(stats.total_net) / parseFloat(stats.total_capital)) * 100
          : 0,
      };
    } catch (error) {
      logger.error('Failed to get portfolio fee stats:', error);
      return null;
    }
  }

  /**
   * Clear cache for a position
   */
  clearCache(positionId) {
    this.feeCache.delete(positionId);
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.feeCache.clear();
    this.gasCosts.clear();
  }
}

export default new FeeTrackerService();
