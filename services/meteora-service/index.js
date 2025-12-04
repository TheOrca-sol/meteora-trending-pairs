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

// ============================================
// DEGEN WALLET AUTOMATION ENDPOINTS
// ============================================

// Close position using degen wallet (for automation)
app.post('/degen/position/close', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`[Degen] Closing position: ${positionAddress}`);

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

        console.log(`✅ [Degen] Position closed: ${signature}`);
        res.json({ signature });

    } catch (error) {
        console.error('[Degen] Error closing position:', error);
        res.status(500).json({ error: error.message });
    }
});

// Claim fees using degen wallet (for automation)
app.post('/degen/position/claim-fees', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`[Degen] Claiming fees: ${positionAddress}`);

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

        console.log(`✅ [Degen] Fees claimed: ${signature}`);
        res.json({ signature });

    } catch (error) {
        console.error('[Degen] Error claiming fees:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add liquidity using degen wallet (for compounding automation)
app.post('/degen/position/add-liquidity', async (req, res) => {
    try {
        const { positionAddress, poolAddress, amountX, amountY } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress || amountX === undefined || amountY === undefined) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`[Degen] Adding liquidity: ${positionAddress} (${amountX} X, ${amountY} Y)`);

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

        console.log(`✅ [Degen] Liquidity added: ${signature}`);
        res.json({ signature });

    } catch (error) {
        console.error('[Degen] Error adding liquidity:', error);
        res.status(500).json({ error: error.message });
    }
});

// Compound fees using degen wallet (claim + add back, for automation)
app.post('/degen/position/compound', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!degenWallet) {
            return res.status(400).json({ error: 'Degen wallet not configured' });
        }

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing positionAddress or poolAddress' });
        }

        console.log(`[Degen] Compounding position: ${positionAddress}`);

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

        console.log(`✅ [Degen] Compound complete`);
        res.json({
            claimSignature,
            addSignature,
            feesCompounded: {
                feesX: feesX / Math.pow(10, dlmmPool.tokenX.decimal),
                feesY: feesY / Math.pow(10, dlmmPool.tokenY.decimal)
            }
        });

    } catch (error) {
        console.error('[Degen] Error compounding:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// USER-SIGNED TRANSACTION ENDPOINTS
// ============================================

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

// Estimate fees for adding liquidity
app.post('/pool/estimate-fees', async (req, res) => {
    try {
        const { poolAddress, lowerBinId, upperBinId } = req.body;

        if (!poolAddress || lowerBinId === undefined || upperBinId === undefined) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`[Estimate Fees] Pool: ${poolAddress}, Range: ${lowerBinId} - ${upperBinId}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Calculate number of bins
        const numBins = upperBinId - lowerBinId + 1;

        // Position account rent calculation
        // Base position size + (bins * bin data size)
        // Meteora Position V2 base: ~172 bytes + (numBins * 32 bytes per bin liquidity data)
        const POSITION_BASE_SIZE = 172;
        const PER_BIN_SIZE = 32;
        const positionAccountSize = POSITION_BASE_SIZE + (numBins * PER_BIN_SIZE);
        const positionRent = await connection.getMinimumBalanceForRentExemption(positionAccountSize);

        // Check which bin arrays need to be initialized
        const BIN_ARRAY_SIZE = 69; // Meteora uses 69 bins per array
        const minArrayIndex = Math.floor(lowerBinId / BIN_ARRAY_SIZE);
        const maxArrayIndex = Math.floor(upperBinId / BIN_ARRAY_SIZE);
        const numBinArrays = maxArrayIndex - minArrayIndex + 1;

        // Check which bin arrays already exist
        let binArraysToCreate = 0;
        for (let i = minArrayIndex; i <= maxArrayIndex; i++) {
            try {
                const [binArrayPubkey] = PublicKey.findProgramAddressSync(
                    [
                        Buffer.from('bin_array'),
                        poolPubkey.toBuffer(),
                        Buffer.from(new BN(i).toArray('le', 8))
                    ],
                    new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo') // Meteora DLMM program
                );

                const accountInfo = await connection.getAccountInfo(binArrayPubkey);
                if (!accountInfo) {
                    binArraysToCreate++;
                }
            } catch (err) {
                console.error(`Error checking bin array ${i}:`, err);
                binArraysToCreate++; // Assume needs creation if error
            }
        }

        // Bin array rent (fixed size, ~12KB per array)
        const BIN_ARRAY_ACCOUNT_SIZE = 12296; // Actual Meteora bin array size
        const binArrayRentPerArray = await connection.getMinimumBalanceForRentExemption(BIN_ARRAY_ACCOUNT_SIZE);
        const totalBinArrayRent = binArraysToCreate * binArrayRentPerArray;

        // Transaction fee estimate
        const transactionFee = 0.00001; // Base transaction fee in SOL

        console.log(`[Estimate Fees] Position size: ${positionAccountSize} bytes, ${numBins} bins`);
        console.log(`[Estimate Fees] Bin arrays: ${numBinArrays} total, ${binArraysToCreate} to create`);
        console.log(`[Estimate Fees] Position rent: ${positionRent / 1e9} SOL (refundable)`);
        console.log(`[Estimate Fees] Bin array rent: ${totalBinArrayRent / 1e9} SOL (non-refundable)`);

        res.json({
            numBins,
            positionRent: positionRent / 1e9, // Convert to SOL
            positionRentLamports: positionRent,
            binArraysTotal: numBinArrays,
            binArraysToCreate,
            binArrayRentPerArray: binArrayRentPerArray / 1e9,
            totalBinArrayRent: totalBinArrayRent / 1e9,
            totalBinArrayRentLamports: totalBinArrayRent,
            transactionFee,
            totalRefundable: positionRent / 1e9,
            totalNonRefundable: totalBinArrayRent / 1e9,
            totalCost: (positionRent + totalBinArrayRent) / 1e9 + transactionFee
        });

    } catch (error) {
        console.error('Error estimating fees:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// USER-SIGNED POSITION MANAGEMENT
// ============================================

// Remove liquidity (user-signed)
app.post('/position/remove-liquidity', async (req, res) => {
    try {
        const { positionAddress, poolAddress, userPublicKey, bps } = req.body;

        if (!positionAddress || !poolAddress || !userPublicKey) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const bpsValue = bps || 10000; // Default to 100% if not specified

        console.log(`[Remove Liquidity] Creating transaction for position: ${positionAddress}`);
        console.log(`  User: ${userPublicKey}, BPS: ${bpsValue}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position info
        const positionPubkey = new PublicKey(positionAddress);
        const userPubkey = new PublicKey(userPublicKey);

        // Get the position data to know the bin range
        const position = await dlmmPool.getPosition(positionPubkey);
        const lowerBinId = position.positionData.lowerBinId;
        const upperBinId = position.positionData.upperBinId;

        console.log(`[Remove Liquidity] Position bin range: ${lowerBinId} - ${upperBinId}, BPS: ${bpsValue}`);

        // Create remove liquidity transaction
        const removeLiquidityTx = await dlmmPool.removeLiquidity({
            position: positionPubkey,
            user: userPubkey,
            fromBinId: lowerBinId,
            toBinId: upperBinId,
            bps: new BN(bpsValue),
            shouldClaimAndClose: false // Don't close position automatically
        });

        // The SDK returns either { tx: Transaction } or an array of transactions
        let transaction;
        if (Array.isArray(removeLiquidityTx)) {
            transaction = removeLiquidityTx[0];
        } else if (removeLiquidityTx.tx) {
            transaction = removeLiquidityTx.tx;
        } else {
            transaction = removeLiquidityTx;
        }

        // Set blockhash and fee payer
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = userPubkey;

        // Serialize transaction
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        console.log(`✅ Remove liquidity transaction created`);

        res.json({
            transaction: serializedTx.toString('base64'),
            lastValidBlockHeight
        });

    } catch (error) {
        console.error('Error creating remove liquidity transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add liquidity to existing position (user-signed)
app.post('/position/add-liquidity', async (req, res) => {
    try {
        const { positionAddress, poolAddress, userPublicKey, amountX, amountY } = req.body;

        if (!positionAddress || !poolAddress || !userPublicKey) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (amountX === undefined || amountY === undefined) {
            return res.status(400).json({ error: 'Missing amountX or amountY' });
        }

        console.log(`[Add Liquidity] Creating transaction for position: ${positionAddress}`);
        console.log(`  User: ${userPublicKey}, Amounts: ${amountX} X, ${amountY} Y`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position info
        const positionPubkey = new PublicKey(positionAddress);
        const userPubkey = new PublicKey(userPublicKey);

        // Get the position data to know the bin range
        const position = await dlmmPool.getPosition(positionPubkey);

        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }

        const lowerBinId = position.positionData.lowerBinId;
        const upperBinId = position.positionData.upperBinId;

        console.log(`[Add Liquidity] Position bin range: ${lowerBinId} - ${upperBinId}`);

        // Convert amounts to BN (in lamports)
        const decimalsX = dlmmPool.tokenX.decimal;
        const decimalsY = dlmmPool.tokenY.decimal;

        const totalXAmount = new BN(Math.floor(amountX * Math.pow(10, decimalsX)));
        const totalYAmount = new BN(Math.floor(amountY * Math.pow(10, decimalsY)));

        console.log(`[Add Liquidity] Amounts in lamports: X=${totalXAmount.toString()}, Y=${totalYAmount.toString()}`);

        // Create add liquidity transaction
        const addLiquidityTx = await dlmmPool.addLiquidity({
            positionPubKey: positionPubkey,
            user: userPubkey,
            totalXAmount,
            totalYAmount,
            strategy: {
                maxBinId: upperBinId,
                minBinId: lowerBinId,
                strategyType: 1 // Spot - balanced distribution
            }
        });

        // The SDK returns either { tx: Transaction } or an array of transactions
        let transaction;
        if (Array.isArray(addLiquidityTx)) {
            transaction = addLiquidityTx[0];
        } else if (addLiquidityTx.tx) {
            transaction = addLiquidityTx.tx;
        } else {
            transaction = addLiquidityTx;
        }

        // Set blockhash and fee payer
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = userPubkey;

        // Serialize transaction
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        console.log(`✅ Add liquidity transaction created`);

        res.json({
            transaction: serializedTx.toString('base64'),
            lastValidBlockHeight
        });

    } catch (error) {
        console.error('Error creating add liquidity transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Claim fees (user-signed)
app.post('/position/claim-fees', async (req, res) => {
    try {
        const { positionAddress, poolAddress, userPublicKey } = req.body;

        if (!positionAddress || !poolAddress || !userPublicKey) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`[Claim Fees] Creating transaction for position: ${positionAddress}`);
        console.log(`  User: ${userPublicKey}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position
        const positionPubkey = new PublicKey(positionAddress);
        const userPubkey = new PublicKey(userPublicKey);

        // Create claim fee transaction
        const claimFeeTx = await dlmmPool.claimAllRewards({
            owner: userPubkey,
            position: positionPubkey
        });

        // The SDK returns either { tx: Transaction } or an array of transactions
        let transaction;
        if (Array.isArray(claimFeeTx)) {
            transaction = claimFeeTx[0];
        } else if (claimFeeTx.tx) {
            transaction = claimFeeTx.tx;
        } else {
            transaction = claimFeeTx;
        }

        // Set blockhash and fee payer
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = userPubkey;

        // Serialize transaction
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        console.log(`✅ Claim fees transaction created`);

        res.json({
            transaction: serializedTx.toString('base64'),
            lastValidBlockHeight
        });

    } catch (error) {
        console.error('Error creating claim fees transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Close position (user-signed)
app.post('/position/close', async (req, res) => {
    try {
        const { positionAddress, poolAddress, userPublicKey } = req.body;

        if (!positionAddress || !poolAddress || !userPublicKey) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`[Close Position] Creating transaction for position: ${positionAddress}`);
        console.log(`  User: ${userPublicKey}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position
        const positionPubkey = new PublicKey(positionAddress);
        const userPubkey = new PublicKey(userPublicKey);

        // First, get the position data to know the bin range
        const position = await dlmmPool.getPosition(positionPubkey);
        const lowerBinId = position.positionData.lowerBinId;
        const upperBinId = position.positionData.upperBinId;

        console.log(`[Close Position] Position bin range: ${lowerBinId} - ${upperBinId}`);

        // Create remove all liquidity + close transaction (100% = 10000 bps)
        const removeLiquidityTx = await dlmmPool.removeLiquidity({
            position: positionPubkey,
            user: userPubkey,
            fromBinId: lowerBinId,
            toBinId: upperBinId,
            bps: new BN(10000), // 100%
            shouldClaimAndClose: true // Close position after removing
        });

        console.log('[Close Position] SDK returned:', typeof removeLiquidityTx, Array.isArray(removeLiquidityTx));
        console.log('[Close Position] SDK response length:', Array.isArray(removeLiquidityTx) ? removeLiquidityTx.length : 'N/A');

        // The SDK returns either { tx: Transaction } or an array of transactions
        // If the position is already empty, it returns an empty array
        let transaction;
        if (Array.isArray(removeLiquidityTx)) {
            if (removeLiquidityTx.length === 0) {
                // Position is already empty, need to fetch position data and close it
                console.log('[Close Position] Position is empty, fetching position data');

                // Get the full position object
                const position = await dlmmPool.getPosition(positionPubkey);

                console.log('[Close Position] Calling closePosition with position object');
                const closePositionTx = await dlmmPool.closePosition({
                    owner: userPubkey,
                    position: position
                });

                // closePosition returns a Transaction directly
                transaction = closePositionTx;
            } else {
                transaction = removeLiquidityTx[0];
            }
        } else if (removeLiquidityTx && removeLiquidityTx.tx) {
            transaction = removeLiquidityTx.tx;
        } else {
            transaction = removeLiquidityTx;
        }

        if (!transaction) {
            throw new Error('Failed to extract transaction from SDK response');
        }

        console.log('[Close Position] Transaction type:', transaction.constructor?.name || 'Unknown');

        // Set blockhash and fee payer
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = userPubkey;

        // Serialize transaction
        const serializedTx = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false
        });

        console.log(`✅ Close position transaction created`);

        res.json({
            transaction: serializedTx.toString('base64'),
            lastValidBlockHeight
        });

    } catch (error) {
        console.error('Error creating close position transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get position data (current balances, fees, etc.)
app.post('/position/data', async (req, res) => {
    try {
        const { positionAddress, poolAddress } = req.body;

        if (!positionAddress || !poolAddress) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        console.log(`[Position Data] Fetching data for position: ${positionAddress}`);

        // Load DLMM pool
        const poolPubkey = new PublicKey(poolAddress);
        const dlmmPool = await DLMM.create(connection, poolPubkey);

        // Get position data
        const positionPubkey = new PublicKey(positionAddress);
        const position = await dlmmPool.getPosition(positionPubkey);

        if (!position) {
            return res.status(404).json({ error: 'Position not found' });
        }

        // Get decimals
        const decimalsX = dlmmPool.tokenX.mint.decimals;
        const decimalsY = dlmmPool.tokenY.mint.decimals;

        // Calculate total amounts using BN
        const totalXAmountBN = position.positionData.totalXAmount;
        const totalYAmountBN = position.positionData.totalYAmount;

        // Convert BN to numbers
        const amountX = Number(totalXAmountBN.toString()) / Math.pow(10, decimalsX);
        const amountY = Number(totalYAmountBN.toString()) / Math.pow(10, decimalsY);

        // Get fees earned (these are BN as well)
        const feeXBN = position.positionData.feeX || new BN(0);
        const feeYBN = position.positionData.feeY || new BN(0);

        const feeXAmount = Number(feeXBN.toString()) / Math.pow(10, decimalsX);
        const feeYAmount = Number(feeYBN.toString()) / Math.pow(10, decimalsY);

        // Get rewards (if any)
        const rewardOneBN = position.positionData.rewardOne || new BN(0);
        const rewardTwoBN = position.positionData.rewardTwo || new BN(0);

        const rewardOne = Number(rewardOneBN.toString());
        const rewardTwo = Number(rewardTwoBN.toString());

        console.log(`✅ Position data fetched: X=${amountX}, Y=${amountY}, FeeX=${feeXAmount}, FeeY=${feeYAmount}`);

        res.json({
            positionAddress: positionAddress,
            currentAmountX: amountX,
            currentAmountY: amountY,
            feesEarnedX: feeXAmount,
            feesEarnedY: feeYAmount,
            rewardOne: rewardOne,
            rewardTwo: rewardTwo,
            lowerBinId: position.positionData.lowerBinId,
            upperBinId: position.positionData.upperBinId
        });

    } catch (error) {
        console.error('Error fetching position data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Meteora microservice running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
});
