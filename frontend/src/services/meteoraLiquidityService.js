/**
 * Meteora DLMM Liquidity Service
 * Calls backend microservice to create unsigned transactions
 */

import { Connection, Transaction } from '@solana/web3.js';

const RPC_URL = process.env.REACT_APP_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const METEORA_SERVICE_URL = process.env.REACT_APP_METEORA_SERVICE_URL || 'http://localhost:3002';

/**
 * Add liquidity to a Meteora DLMM pool
 * @param {Object} params
 * @param {string} params.poolAddress - DLMM pool address
 * @param {number} params.amountX - Amount of Token X to add
 * @param {number} params.amountY - Amount of Token Y to add
 * @param {number} params.lowerBinId - Lower bin ID for range
 * @param {number} params.upperBinId - Upper bin ID for range
 * @param {string} params.distributionStrategy - Distribution strategy (spot, curve, bid-ask)
 * @param {Object} params.wallet - Wallet adapter instance with signTransaction
 * @param {PublicKey} params.walletPublicKey - User's wallet public key
 * @returns {Promise<{signature: string, positionAddress: string}>}
 */
export async function addLiquidity({
  poolAddress,
  amountX,
  amountY,
  lowerBinId,
  upperBinId,
  distributionStrategy,
  wallet,
  walletPublicKey
}) {
  try {
    const payload = {
      poolAddress,
      amountX: parseFloat(amountX) || 0,
      amountY: parseFloat(amountY) || 0,
      lowerBinId,
      upperBinId,
      distributionStrategy,
      userPublicKey: walletPublicKey.toString()
    };

    console.log('[Meteora Service] Adding liquidity:', payload);

    // Call backend microservice to create unsigned transaction
    const response = await fetch(`${METEORA_SERVICE_URL}/position/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create transaction');
    }

    const { transaction: txBase64, positionAddress, lastValidBlockHeight } = await response.json();

    console.log('[Meteora Service] Transaction created, position:', positionAddress);

    // Deserialize transaction
    const txBuffer = Buffer.from(txBase64, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');

    // Transaction already has blockhash and fee payer set by the server
    // Do NOT set a new blockhash here as it will invalidate the position keypair signature

    console.log('[Meteora Service] Requesting wallet signature...');

    // Sign transaction with user's wallet
    const signedTx = await wallet.signTransaction(transaction);

    // Send transaction
    console.log('[Meteora Service] Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    console.log('[Meteora Service] Transaction sent:', signature);

    // Confirm transaction
    console.log('[Meteora Service] Confirming transaction...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('[Meteora Service] Transaction confirmed!');

    return {
      signature,
      positionAddress
    };

  } catch (error) {
    console.error('[Meteora Service] Error adding liquidity:', error);
    throw error;
  }
}

/**
 * Remove liquidity from a position (partial or full withdrawal)
 */
export async function removeLiquidity({
  poolAddress,
  positionAddress,
  bps = 10000, // Default 100%
  wallet,
  walletPublicKey
}) {
  try {
    console.log('[Meteora Service] Removing liquidity:', { poolAddress, positionAddress, bps });

    // Call Meteora microservice to create transaction
    const response = await fetch(`${METEORA_SERVICE_URL}/position/remove-liquidity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        positionAddress,
        userPublicKey: walletPublicKey.toString(),
        bps
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create remove liquidity transaction');
    }

    const { transaction: txBase64, lastValidBlockHeight } = await response.json();

    console.log('[Meteora Service] Transaction created');

    // Deserialize transaction
    const txBuffer = Buffer.from(txBase64, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log('[Meteora Service] Requesting wallet signature...');

    // Sign transaction with user's wallet
    const signedTx = await wallet.signTransaction(transaction);

    // Send transaction
    console.log('[Meteora Service] Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    console.log('[Meteora Service] Transaction sent:', signature);

    // Confirm transaction
    console.log('[Meteora Service] Confirming transaction...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('[Meteora Service] Transaction confirmed!');

    return { signature };

  } catch (error) {
    console.error('[Meteora Service] Error removing liquidity:', error);
    throw error;
  }
}

/**
 * Close position (remove all liquidity and close the position account)
 */
export async function closePosition({
  poolAddress,
  positionAddress,
  wallet,
  walletPublicKey
}) {
  try {
    console.log('[Meteora Service] Closing position:', { poolAddress, positionAddress });

    // Call Meteora microservice to create transaction
    const response = await fetch(`${METEORA_SERVICE_URL}/position/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        positionAddress,
        userPublicKey: walletPublicKey.toString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create close position transaction');
    }

    const { transaction: txBase64, lastValidBlockHeight } = await response.json();

    console.log('[Meteora Service] Transaction created');

    // Deserialize transaction
    const txBuffer = Buffer.from(txBase64, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log('[Meteora Service] Requesting wallet signature...');

    // Sign transaction with user's wallet
    const signedTx = await wallet.signTransaction(transaction);

    // Send transaction
    console.log('[Meteora Service] Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    console.log('[Meteora Service] Transaction sent:', signature);

    // Confirm transaction
    console.log('[Meteora Service] Confirming transaction...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('[Meteora Service] Transaction confirmed!');

    return { signature };

  } catch (error) {
    console.error('[Meteora Service] Error closing position:', error);
    throw error;
  }
}

/**
 * Claim fees from a position
 */
export async function claimFees({
  poolAddress,
  positionAddress,
  wallet,
  walletPublicKey
}) {
  try {
    console.log('[Meteora Service] Claiming fees:', { poolAddress, positionAddress });

    // Call Meteora microservice to create transaction
    const response = await fetch(`${METEORA_SERVICE_URL}/position/claim-fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        positionAddress,
        userPublicKey: walletPublicKey.toString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create claim fees transaction');
    }

    const { transaction: txBase64, lastValidBlockHeight } = await response.json();

    console.log('[Meteora Service] Transaction created');

    // Deserialize transaction
    const txBuffer = Buffer.from(txBase64, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');

    console.log('[Meteora Service] Requesting wallet signature...');

    // Sign transaction with user's wallet
    const signedTx = await wallet.signTransaction(transaction);

    // Send transaction
    console.log('[Meteora Service] Sending transaction...');
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });

    console.log('[Meteora Service] Transaction sent:', signature);

    // Confirm transaction
    console.log('[Meteora Service] Confirming transaction...');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: transaction.recentBlockhash,
      lastValidBlockHeight
    }, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('[Meteora Service] Transaction confirmed!');

    return { signature };

  } catch (error) {
    console.error('[Meteora Service] Error claiming fees:', error);
    throw error;
  }
}

/**
 * Calculate bin IDs from price range
 * Calls Meteora microservice to get accurate bin IDs using SDK
 */
export async function calculateBinIds({ poolAddress, lowerPrice, upperPrice }) {
  try {
    console.log('[Meteora Service] Calculating bin IDs:', { poolAddress, lowerPrice, upperPrice });

    const response = await fetch(`${METEORA_SERVICE_URL}/pool/calculate-bin-ids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        lowerPrice,
        upperPrice
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to calculate bin IDs');
    }

    const { lowerBinId, upperBinId, activeBinId } = await response.json();
    console.log('[Meteora Service] Bin IDs calculated:', { lowerBinId, upperBinId, activeBinId });

    return {
      lowerBinId,
      upperBinId,
      activeBinId
    };

  } catch (error) {
    console.error('[Meteora Service] Error calculating bin IDs:', error);
    throw error;
  }
}

/**
 * Estimate fees for adding liquidity
 * Returns refundable and non-refundable costs
 */
export async function estimateLiquidityFees({ poolAddress, lowerBinId, upperBinId }) {
  try {
    console.log('[Meteora Service] Estimating fees:', { poolAddress, lowerBinId, upperBinId });

    const response = await fetch(`${METEORA_SERVICE_URL}/pool/estimate-fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        lowerBinId,
        upperBinId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to estimate fees');
    }

    const feeEstimate = await response.json();
    console.log('[Meteora Service] Fee estimate:', feeEstimate);

    return feeEstimate;

  } catch (error) {
    console.error('[Meteora Service] Error estimating fees:', error);
    throw error;
  }
}
