/**
 * Meteora DLMM Microservice
 * Wraps official Meteora SDK for use by Python automation backend
 */

const express = require('express');
const cors = require('cors');
const DLMM = require('@meteora-ag/dlmm');
const { Connection, Keypair, PublicKey, Transaction } = require('@solana/web3.js');
const BN = require('bn.js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PORT = process.env.PORT || 3002;

// Initialize connection
const connection = new Connection(RPC_URL, 'confirmed');
console.log(`Connected to Solana RPC: ${RPC_URL}`);

// Load degen wallet
let degenWallet = null;
if (process.env.DEGEN_WALLET_PRIVATE_KEY) {
    try {
        const secretKey = JSON.parse(process.env.DEGEN_WALLET_PRIVATE_KEY);
        degenWallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        console.log(`Degen wallet loaded: ${degenWallet.publicKey.toString()}`);
    } catch (error) {
        console.error('Failed to load degen wallet:', error.message);
    }
} else {
    console.warn('DEGEN_WALLET_PRIVATE_KEY not set - execution endpoints will not work');
}

// Helper: Fetch token prices from Jupiter
async function fetchTokenPrices(mintX, mintY) {
    try {
        const response = await fetch(`https://api.jup.ag/price/v2?ids=${mintX},${mintY}`);
        const data = await response.json();
        return {
            priceX: data.data?.[mintX]?.price || 0,
            priceY: data.data?.[mintY]?.price || 0
        };
    } catch (error) {
        console.error('Error fetching prices:', error.message);
        return { priceX: 0, priceY: 0 };
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rpcUrl: RPC_URL,
        degenWallet: degenWallet ? degenWallet.publicKey.toString() : null
    });
});

// Get position data
app.post('/position/data', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`Fetching position data: ${positionAddress}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position
        const positionPubkey = new PublicKey(positionAddress);
        const position = await dlmmPool.getPosition(positionPubkey);

        if (!position || !position.positionData) {
            return res.status(404).json({ error: 'Position not found' });
        }

        // Get pool state for active bin
        const activeBinId = dlmmPool.lbPair.activeId;

        // Calculate token amounts (from lamports to tokens)
        const decimalsX = dlmmPool.tokenX.decimal;
        const decimalsY = dlmmPool.tokenY.decimal;

        const amountX = position.positionData.totalXAmount.toNumber() / Math.pow(10, decimalsX);
        const amountY = position.positionData.totalYAmount.toNumber() / Math.pow(10, decimalsY);

        const feesX = position.positionData.feeX.toNumber() / Math.pow(10, decimalsX);
        const feesY = position.positionData.feeY.toNumber() / Math.pow(10, decimalsY);

        // Get token prices
        const mintX = dlmmPool.tokenX.publicKey.toString();
        const mintY = dlmmPool.tokenY.publicKey.toString();
        const { priceX, priceY } = await fetchTokenPrices(mintX, mintY);

        // Calculate USD values
        const valueUSD = (amountX * priceX) + (amountY * priceY);
        const feesUSD = (feesX * priceX) + (feesY * priceY);

        // Check if in range
        const lowerBinId = position.positionData.lowerBinId;
        const upperBinId = position.positionData.upperBinId;
        const inRange = activeBinId >= lowerBinId && activeBinId <= upperBinId;

        const result = {
            amountX,
            amountY,
            valueUSD,
            feesX,
            feesY,
            feesUSD,
            profitUSD: feesUSD, // Simplified - doesn't account for IL
            inRange,
            activeBinId,
            lowerBinId,
            upperBinId
        };

        console.log(`Position data: $${valueUSD.toFixed(2)} value, $${feesUSD.toFixed(2)} fees, inRange=${inRange}`);
        res.json(result);

    } catch (error) {
        console.error('Error fetching position data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Close position (remove all liquidity)
app.post('/position/close', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`Closing position: ${positionAddress}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position
        const positionPubkey = new PublicKey(positionAddress);

        // Create remove liquidity transaction (100% = 10000 bps)
        const removeLiquidityTx = await dlmmPool.removeLiquidity({
            position: positionPubkey,
            user: degenWallet.publicKey,
            bps: new BN(10000),
            shouldClaimAndClose: true // Close position after removing
        });

        // Sign transaction
        removeLiquidityTx.sign([degenWallet]);

        // Send transaction
        const signature = await connection.sendTransaction(removeLiquidityTx, [degenWallet], {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        console.log(`Transaction sent: ${signature}`);

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }

        console.log(`✅ Position closed: ${signature}`);
        res.json({ signature });

    } catch (error) {
        console.error('Error closing position:', error);
        res.status(500).json({ error: error.message });
    }
});

// Claim fees
app.post('/position/claim-fees', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`Claiming fees: ${positionAddress}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position
        const positionPubkey = new PublicKey(positionAddress);

        // Create claim fee transaction
        const claimFeeTx = await dlmmPool.claimFee({
            owner: degenWallet.publicKey,
            position: positionPubkey
        });

        // Sign and send
        claimFeeTx.sign([degenWallet]);
        const signature = await connection.sendTransaction(claimFeeTx, [degenWallet], {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        console.log(`Transaction sent: ${signature}`);

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        console.log(`✅ Fees claimed: ${signature}`);
        res.json({ signature });

    } catch (error) {
        console.error('Error claiming fees:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add liquidity (for compounding)
app.post('/position/add-liquidity', async (req, res) => {
    try {
        const { positionAddress, poolAddress, amountX, amountY } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress || amountX === undefined || amountY === undefined) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`Adding liquidity: ${positionAddress} (${amountX} X, ${amountY} Y)`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position to know the range
        const positionPubkey = new PublicKey(positionAddress);
        const position = await dlmmPool.getPosition(positionPubkey);

        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }

        // Convert amounts to BN (in lamports)
        const decimalsX = dlmmPool.tokenX.decimal;
        const decimalsY = dlmmPool.tokenY.decimal;

        const totalXAmount = new BN(Math.floor(amountX * Math.pow(10, decimalsX)));
        const totalYAmount = new BN(Math.floor(amountY * Math.pow(10, decimalsY)));

        // Create add liquidity transaction
        const addLiquidityTx = await dlmmPool.addLiquidity({
            positionPubKey: positionPubkey,
            user: degenWallet.publicKey,
            totalXAmount,
            totalYAmount,
            strategy: {
                maxBinId: position.positionData.upperBinId,
                minBinId: position.positionData.lowerBinId,
                strategyType: 1 // Spot
            }
        });

        // Sign and send
        addLiquidityTx.tx.sign([degenWallet]);
        const signature = await connection.sendTransaction(addLiquidityTx.tx, [degenWallet], {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        console.log(`Transaction sent: ${signature}`);

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        console.log(`✅ Liquidity added: ${signature}`);
        res.json({ signature });

    } catch (error) {
        console.error('Error adding liquidity:', error);
        res.status(500).json({ error: error.message });
    }
});

// Compound fees (claim + add back)
app.post('/position/compound', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`Compounding position: ${positionAddress}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position
        const positionPubkey = new PublicKey(positionAddress);
        const position = await dlmmPool.getPosition(positionPubkey);

        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }

        // Check if there are fees to claim
        const feesX = position.positionData.feeX.toNumber();
        const feesY = position.positionData.feeY.toNumber();

        if (feesX === 0 && feesY === 0) {
            return res.status(400).json({ error: 'No fees to compound' });
        }

        // Step 1: Claim fees
        console.log('  Step 1: Claiming fees...');
        const claimFeeTx = await dlmmPool.claimFee({
            owner: degenWallet.publicKey,
            position: positionPubkey
        });

        claimFeeTx.sign([degenWallet]);
        const claimSignature = await connection.sendTransaction(claimFeeTx, [degenWallet]);
        await connection.confirmTransaction(claimSignature, 'confirmed');
        console.log(`  ✅ Fees claimed: ${claimSignature}`);

        // Step 2: Add claimed fees back as liquidity
        console.log('  Step 2: Adding fees back as liquidity...');
        const addLiquidityTx = await dlmmPool.addLiquidity({
            positionPubKey: positionPubkey,
            user: degenWallet.publicKey,
            totalXAmount: position.positionData.feeX,
            totalYAmount: position.positionData.feeY,
            strategy: {
                maxBinId: position.positionData.upperBinId,
                minBinId: position.positionData.lowerBinId,
                strategyType: 1
            }
        });

        addLiquidityTx.tx.sign([degenWallet]);
        const addSignature = await connection.sendTransaction(addLiquidityTx.tx, [degenWallet]);
        await connection.confirmTransaction(addSignature, 'confirmed');
        console.log(`  ✅ Fees reinvested: ${addSignature}`);

        console.log(`✅ Compound complete`);
        res.json({
            claimSignature,
            addSignature,
            feesCompounded: {
                feesX: feesX / Math.pow(10, dlmmPool.tokenX.decimal),
                feesY: feesY / Math.pow(10, dlmmPool.tokenY.decimal)
            }
        });

    } catch (error) {
        console.error('Error compounding:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create position (for user adding liquidity)
app.post('/position/create', async (req, res) => {
    try {
        const { poolAddress, amountX, amountY, lowerBinId, upperBinId, userPublicKey, distributionStrategy } = req.body;

        console.log('[Position Create] Received request:', { poolAddress, amountX, amountY, lowerBinId, upperBinId, userPublicKey, distributionStrategy });

        if (!poolAddress || lowerBinId === undefined || upperBinId === undefined || !userPublicKey) {
            console.error('[Position Create] Missing required parameters:', { poolAddress, lowerBinId, upperBinId, userPublicKey });
            return res.status(400).json({
                error: 'Missing required parameters',
                details: {
                    hasPoolAddress: !!poolAddress,
                    hasLowerBinId: lowerBinId !== undefined,
                    hasUpperBinId: upperBinId !== undefined,
                    hasUserPublicKey: !!userPublicKey
                }
            });
        }

        // Require at least one token amount
        if ((amountX === undefined || amountX === 0) && (amountY === undefined || amountY === 0)) {
            return res.status(400).json({ error: 'Must provide at least one token amount' });
        }

        console.log(`Creating position for user: ${userPublicKey}`);
        console.log(`  Amounts: ${amountX || 0} X, ${amountY || 0} Y`);
        console.log(`  Range: bins ${lowerBinId} - ${upperBinId}`);
        console.log(`  Strategy: ${distributionStrategy || 'spot'}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Convert to lamports
        const decimalsX = dlmmPool.tokenX.mint.decimals;
        const decimalsY = dlmmPool.tokenY.mint.decimals;
        const amountXLamports = new BN(Math.floor((amountX || 0) * Math.pow(10, decimalsX)));
        const amountYLamports = new BN(Math.floor((amountY || 0) * Math.pow(10, decimalsY)));

        console.log(`  Decimals: X=${decimalsX}, Y=${decimalsY}`);
        console.log(`  Lamports: X=${amountXLamports.toString()}, Y=${amountYLamports.toString()}`);

        // Map distribution strategy to Meteora strategyType
        // 0 = Spot (uniform), 1 = Curve (bell curve), 2 = Bid-Ask (concentrated at edges)
        let strategyType;
        switch (distributionStrategy?.toLowerCase()) {
            case 'curve':
                strategyType = 1; // Bell curve
                break;
            case 'bid-ask':
                strategyType = 2; // Bid-Ask spread
                break;
            case 'spot':
            default:
                strategyType = 0; // Uniform/Spot
                break;
        }

        // Create unsigned transaction for user to sign
        const userPubkey = new PublicKey(userPublicKey);

        // Generate a new position keypair (will be owned by user)
        const positionKeypair = Keypair.generate();

        const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
            positionPubKey: positionKeypair.publicKey,
            user: userPubkey,
            totalXAmount: amountXLamports,
            totalYAmount: amountYLamports,
            strategy: {
                maxBinId: upperBinId,
                minBinId: lowerBinId,
                strategyType
            }
        });

        // The SDK returns either a single Transaction or an array of Transactions
        const transaction = Array.isArray(createPositionTx) ? createPositionTx[0] : createPositionTx;
        const positionPubkey = positionKeypair.publicKey;

        // Set blockhash and fee payer BEFORE signing
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = userPubkey;

        // Partially sign with position keypair (this keypair is ephemeral, created server-side)
        transaction.partialSign(positionKeypair);

        // Serialize transaction (partially signed) to send to frontend
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        console.log(`✅ Transaction created for position: ${positionPubkey.toString()}`);

        res.json({
            transaction: serializedTx.toString('base64'),
            positionAddress: positionPubkey.toString(),
            lastValidBlockHeight
        });

    } catch (error) {
        console.error('Error creating position:', error);
        res.status(500).json({ error: error.message });
    }
});

// Calculate bin IDs from prices
app.post('/pool/calculate-bin-ids', async (req, res) => {
    try {
        const { poolAddress, lowerPrice, upperPrice } = req.body;

        if (!poolAddress || !lowerPrice || !upperPrice) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`[Calculate Bin IDs] Pool: ${poolAddress}, Range: ${lowerPrice} - ${upperPrice}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Use SDK's getBinIdFromPrice method
        const lowerBinId = dlmmPool.getBinIdFromPrice(lowerPrice, true); // round down
        const upperBinId = dlmmPool.getBinIdFromPrice(upperPrice, false); // round up
        const activeBinId = dlmmPool.lbPair.activeId;

        console.log(`[Calculate Bin IDs] Result:`, { lowerBinId, upperBinId, activeBinId });

        res.json({
            lowerBinId,
            upperBinId,
            activeBinId
        });

    } catch (error) {
        console.error('Error calculating bin IDs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Meteora microservice running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
});
