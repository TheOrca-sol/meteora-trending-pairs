const { Connection, PublicKey } = require('@solana/web3.js');
const DLMM = require('@meteora-ag/dlmm').default;
const BN = require('bn.js');
const axios = require('axios');

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

// Backend API URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5000';

/**
 * Get liquidity distribution for a DLMM pair
 * @param {string} pairAddress - The DLMM pair address
 * @returns {Promise<Object>} Liquidity distribution data
 */
async function getLiquidityDistribution(pairAddress) {
  try {
    // Convert address to PublicKey
    const pairPubkey = new PublicKey(pairAddress);

    console.log('Loading DLMM pool...');
    // Load DLMM pool using SDK
    const dlmmPool = await DLMM.create(connection, pairPubkey);

    // Get active bin
    const activeBin = dlmmPool.lbPair.activeId;
    const binStep = dlmmPool.lbPair.binStep;

    console.log(`Active bin: ${activeBin}, Bin step: ${binStep}`);

    // Fetch bins around active bin (e.g., 50 bins on each side)
    // This gives us a good view of buy/sell walls
    const binsToFetch = 100; // Fetch 100 bins on each side
    const binData = await dlmmPool.getBinsAroundActiveBin(binsToFetch, binsToFetch);

    console.log(`Fetched ${binData.bins.length} bins`);

    // Process bins to extract liquidity
    const bins = [];
    let totalLiquidityUsd = 0;

    // Get token decimals from mint info
    const decimalsX = dlmmPool.tokenX.mint.decimals;
    const decimalsY = dlmmPool.tokenY.mint.decimals;

    for (const bin of binData.bins) {
      const binId = bin.binId;

      // Convert BN to string then to number to avoid overflow
      // Use toString() and manual division for large numbers
      const xAmount = parseFloat(bin.xAmount.toString()) / Math.pow(10, decimalsX);
      const yAmount = parseFloat(bin.yAmount.toString()) / Math.pow(10, decimalsY);

      // Skip empty bins
      if (xAmount === 0 && yAmount === 0) {
        continue;
      }

      // Parse price (already calculated by SDK)
      const price = parseFloat(bin.price);

      // Estimate USD value
      // Assuming tokenY is the quote token (USDC), yAmount is already in USD
      // tokenX needs to be converted using price
      const liquidityUsd = yAmount + (xAmount * price);
      totalLiquidityUsd += liquidityUsd;

      bins.push({
        binId,
        price,
        liquidityX: xAmount,
        liquidityY: yAmount,
        liquidityUsd,
        isActive: binId === activeBin
      });
    }

    // Sort bins by binId (which correlates with price)
    bins.sort((a, b) => a.binId - b.binId);

    // Calculate statistics
    const buyWalls = bins.filter(b => b.binId < activeBin);
    const sellWalls = bins.filter(b => b.binId > activeBin);

    const stats = {
      totalBins: bins.length,
      totalLiquidityUsd,
      activeBinId: activeBin,
      currentPrice: parseFloat(binData.bins.find(b => b.binId === activeBin)?.price || '0'),
      binStep,
      largestBuyWall: buyWalls.length > 0 ? Math.max(...buyWalls.map(b => b.liquidityUsd)) : 0,
      largestSellWall: sellWalls.length > 0 ? Math.max(...sellWalls.map(b => b.liquidityUsd)) : 0,
      buyWallsCount: buyWalls.length,
      sellWallsCount: sellWalls.length
    };

    return {
      bins,
      activeBin,
      currentPrice: stats.currentPrice,
      stats
    };

  } catch (error) {
    console.error('[DLMM Controller Error]', error);
    throw new Error(`Failed to fetch liquidity distribution: ${error.message}`);
  }
}

/**
 * Get aggregated liquidity distribution for all pools with a specific token pair
 * @param {string} mintX - The base token mint address
 * @param {string} mintY - The quote token mint address
 * @returns {Promise<Object>} Aggregated liquidity distribution data
 */
async function getAggregatedLiquidityByTokenPair(mintX, mintY) {
  try {
    console.log(`Fetching all pools with mint_x: ${mintX} and mint_y: ${mintY}`);

    // Query backend API to get all pools
    const response = await axios.get(`${BACKEND_API_URL}/api/pairs`, {
      params: {
        limit: 10000, // Get all pools (adjust if needed)
        page: 1
      }
    });

    if (!response.data || !response.data.data) {
      throw new Error('Failed to fetch pools from backend');
    }

    // Filter pools by BOTH mint_x AND mint_y (same token pair, different configurations)
    const poolsWithTokenPair = response.data.data.filter(pair =>
      pair.mint_x === mintX && pair.mint_y === mintY
    );

    console.log(`Found ${poolsWithTokenPair.length} pools for token pair ${mintX}/${mintY}`);

    if (poolsWithTokenPair.length === 0) {
      return {
        bins: [],
        aggregatedLiquidity: 0,
        poolCount: 0,
        pools: []
      };
    }

    // Fetch bin data from all pools in parallel
    const poolPromises = poolsWithTokenPair.map(async (pool) => {
      try {
        console.log(`Fetching bins for pool: ${pool.address} (${pool.pairName})`);
        const distribution = await getLiquidityDistribution(pool.address);
        return {
          pool: pool,
          distribution: distribution
        };
      } catch (error) {
        console.error(`Failed to fetch pool ${pool.address}:`, error.message);
        return null;
      }
    });

    const poolResults = await Promise.all(poolPromises);
    const validPools = poolResults.filter(r => r !== null);

    console.log(`Successfully fetched data from ${validPools.length} pools`);

    // Aggregate liquidity by price
    // Use a Map with price as key (rounded to avoid floating point issues)
    const priceMap = new Map();

    for (const { pool, distribution } of validPools) {
      for (const bin of distribution.bins) {
        // Round price to 8 decimal places to group similar prices
        const roundedPrice = Math.round(bin.price * 100000000) / 100000000;

        if (!priceMap.has(roundedPrice)) {
          priceMap.set(roundedPrice, {
            price: roundedPrice,
            liquidityUsd: 0,
            liquidityX: 0,
            liquidityY: 0,
            pools: []
          });
        }

        const entry = priceMap.get(roundedPrice);
        entry.liquidityUsd += bin.liquidityUsd;
        entry.liquidityX += bin.liquidityX;
        entry.liquidityY += bin.liquidityY;

        // Track which pools contribute to this price level
        if (!entry.pools.find(p => p.address === pool.address)) {
          entry.pools.push({
            address: pool.address,
            pairName: pool.pairName,
            binStep: pool.binStep
          });
        }
      }
    }

    // Convert map to sorted array
    const aggregatedBins = Array.from(priceMap.values())
      .sort((a, b) => a.price - b.price);

    // Calculate total liquidity
    const totalLiquidityUsd = aggregatedBins.reduce((sum, bin) => sum + bin.liquidityUsd, 0);

    // Handle empty bins case
    if (aggregatedBins.length === 0 || validPools.length === 0) {
      return {
        bins: [],
        currentPrice: 0,
        stats: {
          totalBins: 0,
          totalLiquidityUsd: 0,
          poolCount: validPools.length,
          currentPrice: 0,
          largestBuyWall: 0,
          largestSellWall: 0,
          buyWallsCount: 0,
          sellWallsCount: 0
        },
        pools: []
      };
    }

    // Find the price level closest to the average current price
    const avgCurrentPrice = validPools.reduce((sum, p) => sum + p.distribution.currentPrice, 0) / validPools.length;
    let closestBin = aggregatedBins[0];
    let minDiff = Math.abs(closestBin.price - avgCurrentPrice);

    for (const bin of aggregatedBins) {
      const diff = Math.abs(bin.price - avgCurrentPrice);
      if (diff < minDiff) {
        minDiff = diff;
        closestBin = bin;
      }
    }

    // Calculate buy/sell walls
    const buyWalls = aggregatedBins.filter(b => b.price < closestBin.price);
    const sellWalls = aggregatedBins.filter(b => b.price > closestBin.price);

    const stats = {
      totalBins: aggregatedBins.length,
      totalLiquidityUsd,
      poolCount: validPools.length,
      currentPrice: avgCurrentPrice,
      largestBuyWall: buyWalls.length > 0 ? Math.max(...buyWalls.map(b => b.liquidityUsd)) : 0,
      largestSellWall: sellWalls.length > 0 ? Math.max(...sellWalls.map(b => b.liquidityUsd)) : 0,
      buyWallsCount: buyWalls.length,
      sellWallsCount: sellWalls.length
    };

    return {
      bins: aggregatedBins,
      currentPrice: avgCurrentPrice,
      stats,
      pools: validPools.map(p => ({
        address: p.pool.address,
        pairName: p.pool.pairName,
        binStep: p.pool.binStep,
        liquidity: p.distribution.stats.totalLiquidityUsd
      }))
    };

  } catch (error) {
    console.error('[DLMM Controller Error]', error);
    throw new Error(`Failed to fetch aggregated liquidity: ${error.message}`);
  }
}

module.exports = {
  getLiquidityDistribution,
  getAggregatedLiquidityByTokenPair
};
