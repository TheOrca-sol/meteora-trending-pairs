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
 * @param {number} params.amountUSD - Amount in USD to add
 * @param {number} params.lowerBinId - Lower bin ID for range
 * @param {number} params.upperBinId - Upper bin ID for range
 * @param {Object} params.wallet - Wallet adapter instance with signTransaction
 * @param {PublicKey} params.walletPublicKey - User's wallet public key
 * @returns {Promise<{signature: string, positionAddress: string}>}
 */
export async function addLiquidity({
  poolAddress,
  amountUSD,
  lowerBinId,
  upperBinId,
  wallet,
  walletPublicKey
}) {
  try {
    console.log('[Meteora Service] Adding liquidity:', {
      poolAddress,
      amountUSD,
      lowerBinId,
      upperBinId
    });

    // Call backend microservice to create unsigned transaction
    const response = await fetch(`${METEORA_SERVICE_URL}/position/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poolAddress,
        amountUSD,
        lowerBinId,
        upperBinId,
        userPublicKey: walletPublicKey.toString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create transaction');
    }

    const { transaction: txBase64, positionAddress } = await response.json();

    console.log('[Meteora Service] Transaction created, position:', positionAddress);

    // Deserialize transaction
    const txBuffer = Buffer.from(txBase64, 'base64');
    const transaction = Transaction.from(txBuffer);

    // Create connection
    const connection = new Connection(RPC_URL, 'confirmed');

    // Set recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = walletPublicKey;

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
      blockhash,
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
 * Remove liquidity from a position
 * Note: This is handled by automation backend, not directly by frontend
 */
export async function removeLiquidity() {
  throw new Error('Remove liquidity is handled by automation backend');
}

/**
 * Claim fees from a position
 * Note: This is handled by automation backend, not directly by frontend
 */
export async function claimFees() {
  throw new Error('Claim fees is handled by automation backend');
}

/**
 * Calculate bin IDs from price range
 * Calls backend microservice to get bin calculations
 */
export async function calculateBinIds({ poolAddress, lowerPrice, upperPrice }) {
  try {
    // For now, we can use a simple formula
    // In production, you might want to add an endpoint in the microservice for this
    // Meteora formula: BinId = floor(log(price) / log(1 + binStep/10000))

    // This is a simplified calculation - for production, call the backend
    console.warn('[Meteora Service] Using simplified bin ID calculation');

    // Default bin step (this should come from the pool)
    const binStep = 25; // Common bin step
    const binStepNum = binStep / 10000;

    const lowerBinId = Math.floor(Math.log(lowerPrice) / Math.log(1 + binStepNum));
    const upperBinId = Math.floor(Math.log(upperPrice) / Math.log(1 + binStepNum));

    return {
      lowerBinId,
      upperBinId,
      activeBinId: Math.floor((lowerBinId + upperBinId) / 2) // Estimate
    };

  } catch (error) {
    console.error('[Meteora Service] Error calculating bin IDs:', error);
    throw error;
  }
}
