const { Connection, PublicKey } = require('@solana/web3.js');
const DLMM = require('@meteora-ag/dlmm').default;
const BN = require('bn.js');
const axios = require('axios');

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

// Backend API URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5000';

/**
 * Get USD prices for multiple tokens from Jupiter API
 * @param {string[]} mints - Array of token mint addresses
 * @returns {Promise<Object>} Map of mint address to USD price
 */
async function getTokenPricesInUSD(mints) {
  try {
    const idsParam = mints.join(',');
    const response = await axios.get(`https://lite-api.jup.ag/price/v3?ids=${idsParam}`, {
      timeout: 5000
    });

    if (!response.data) {
      throw new Error('Failed to fetch prices from Jupiter');
    }

    const prices = {};
    for (const mint of mints) {
      prices[mint] = response.data[mint]?.usdPrice || 0;
    }

    return prices;
  } catch (error) {
    console.error('Error fetching token prices from Jupiter:', error.message);
    // Return zeros for all mints on error
    const prices = {};
    for (const mint of mints) {
      prices[mint] = 0;
    }
    return prices;
  }
}

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

    // Get token mint addresses
    const mintX = dlmmPool.tokenX.publicKey.toString();
    const mintY = dlmmPool.tokenY.publicKey.toString();
    console.log(`Token X: ${mintX}, Token Y: ${mintY}`);

    // Fetch USD prices for both tokens from Jupiter
    const prices = await getTokenPricesInUSD([mintX, mintY]);
    const priceXinUSD = prices[mintX] || 0;
    const priceYinUSD = prices[mintY] || 0;
    console.log(`Token prices: X = $${priceXinUSD}, Y = $${priceYinUSD}`);

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

      // Calculate USD value properly for any token pair
      // liquidityUsd = (xAmount * priceX in USD) + (yAmount * priceY in USD)
      const liquidityUsd = (xAmount * priceXinUSD) + (yAmount * priceYinUSD);
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

    const totalBuyLiquidity = buyWalls.reduce((sum, b) => sum + b.liquidityUsd, 0);
    const totalSellLiquidity = sellWalls.reduce((sum, b) => sum + b.liquidityUsd, 0);

    // Calculate buy/sell ratio (handle division by zero)
    const buySellRatio = totalSellLiquidity > 0 ? totalBuyLiquidity / totalSellLiquidity : 0;

    const stats = {
      totalBins: bins.length,
      totalLiquidityUsd,
      activeBinId: activeBin,
      currentPrice: parseFloat(binData.bins.find(b => b.binId === activeBin)?.price || '0'),
      binStep,
      largestBuyWall: buyWalls.length > 0 ? Math.max(...buyWalls.map(b => b.liquidityUsd)) : 0,
      largestSellWall: sellWalls.length > 0 ? Math.max(...sellWalls.map(b => b.liquidityUsd)) : 0,
      buyWallsCount: buyWalls.length,
      sellWallsCount: sellWalls.length,
      totalBuyLiquidity: totalBuyLiquidity,
      totalSellLiquidity: totalSellLiquidity,
      buySellRatio: buySellRatio
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
 * Get current market price from Jupiter API
 * @param {string} mintX - The base token mint address
 * @param {string} mintY - The quote token mint address (quote currency)
 * @returns {Promise<number>} Current market price (mintX/mintY)
 */
async function getCurrentPriceFromJupiter(mintX, mintY) {
  try {
    // Fetch prices for both tokens from Jupiter (using lite API v3)
    const response = await axios.get(`https://lite-api.jup.ag/price/v3?ids=${mintX},${mintY}`, {
      timeout: 5000
    });

    if (!response.data) {
      throw new Error('Failed to fetch prices from Jupiter');
    }

    const priceX = response.data[mintX]?.usdPrice;
    const priceY = response.data[mintY]?.usdPrice;

    if (!priceX || !priceY) {
      throw new Error('Price data not available for one or both tokens');
    }

    // Calculate price ratio (mintX in terms of mintY)
    const marketPrice = priceX / priceY;
    console.log(`✅ Jupiter price: Token X = $${priceX} USD, Token Y = $${priceY} USD => Market Price = ${marketPrice}`);

    return marketPrice;
  } catch (error) {
    console.error('❌ Error fetching price from Jupiter:', error.message);
    return null;
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

    // Log active bin prices from each pool
    validPools.forEach((p, i) => {
      console.log(`Pool ${i + 1} (${p.pool.pairName}): Active bin price = ${p.distribution.currentPrice.toFixed(8)}`);
    });

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

    console.log(`Aggregated bins: ${aggregatedBins.length} total`);
    console.log(`Price range: ${aggregatedBins[0]?.price.toFixed(8)} to ${aggregatedBins[aggregatedBins.length - 1]?.price.toFixed(8)}`);

    // Log some sample bin prices for debugging
    const sampleBins = [0, Math.floor(aggregatedBins.length / 4), Math.floor(aggregatedBins.length / 2), Math.floor(3 * aggregatedBins.length / 4), aggregatedBins.length - 1];
    console.log('Sample bin prices:', sampleBins.map(i => aggregatedBins[i]?.price.toFixed(8)).join(', '));

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

    // Get current market price from Jupiter API
    console.log('Fetching current market price from Jupiter API...');
    let jupiterPrice = await getCurrentPriceFromJupiter(mintX, mintY);

    // Calculate average pool active price
    const avgPoolPrice = validPools.reduce((sum, p) => sum + p.distribution.currentPrice, 0) / validPools.length;
    console.log(`Average pool active price: ${avgPoolPrice.toFixed(8)}`);

    // Determine which price to use
    let marketPrice;
    if (!jupiterPrice) {
      console.log('⚠️ Jupiter API failed, using average pool price');
      marketPrice = avgPoolPrice;
    } else if (jupiterPrice < aggregatedBins[0].price || jupiterPrice > aggregatedBins[aggregatedBins.length - 1].price) {
      // Jupiter price is outside the bin range - use pool price instead
      console.log(`⚠️ Jupiter price (${jupiterPrice.toFixed(8)}) is outside bin range, using average pool price instead`);
      marketPrice = avgPoolPrice;
    } else {
      console.log(`✅ Using Jupiter market price: ${jupiterPrice.toFixed(8)}`);
      marketPrice = jupiterPrice;
    }

    console.log(`Final market price: ${marketPrice.toFixed(8)}`);

    // Calculate buy/sell walls using Jupiter market price
    const buyWalls = aggregatedBins.filter(b => b.price < marketPrice);
    const sellWalls = aggregatedBins.filter(b => b.price > marketPrice);

    // Calculate total liquidity in buy vs sell
    const totalBuyLiquidity = buyWalls.reduce((sum, b) => sum + b.liquidityUsd, 0);
    const totalSellLiquidity = sellWalls.reduce((sum, b) => sum + b.liquidityUsd, 0);

    // Calculate buy/sell ratio (handle division by zero)
    const buySellRatio = totalSellLiquidity > 0 ? totalBuyLiquidity / totalSellLiquidity : 0;

    console.log(`Buy walls: ${buyWalls.length} bins with $${totalBuyLiquidity.toFixed(2)} total liquidity (below ${marketPrice})`);
    console.log(`Sell walls: ${sellWalls.length} bins with $${totalSellLiquidity.toFixed(2)} total liquidity (above ${marketPrice})`);
    console.log(`Buy/Sell ratio: ${buySellRatio.toFixed(2)}x`);

    const stats = {
      totalBins: aggregatedBins.length,
      totalLiquidityUsd,
      poolCount: validPools.length,
      currentPrice: marketPrice,  // Use Jupiter market price
      largestBuyWall: buyWalls.length > 0 ? Math.max(...buyWalls.map(b => b.liquidityUsd)) : 0,
      largestSellWall: sellWalls.length > 0 ? Math.max(...sellWalls.map(b => b.liquidityUsd)) : 0,
      buyWallsCount: buyWalls.length,
      sellWallsCount: sellWalls.length,
      totalBuyLiquidity: totalBuyLiquidity,
      totalSellLiquidity: totalSellLiquidity,
      buySellRatio: buySellRatio
    };

    return {
      bins: aggregatedBins,
      currentPrice: marketPrice,  // Use Jupiter market price for consistent comparison
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
