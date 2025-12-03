const { Connection, PublicKey } = require('@solana/web3.js');
const DLMM = require('@meteora-ag/dlmm').default;
const BN = require('bn.js');
const axios = require('axios');

// Initialize Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

// Backend API URL
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:5000';

// Cache for Top LPs results (5 minute cache)
const topLPsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
 * Calculate suggested liquidity ranges based on buy/sell imbalance
 * @param {number} currentPrice - Current market price
 * @param {number} totalBuyLiquidity - Total liquidity on buy side (below price)
 * @param {number} totalSellLiquidity - Total liquidity on sell side (above price)
 * @param {number} buySellRatio - Buy/Sell liquidity ratio
 * @param {Array} bins - Array of bin objects with liquidityUsd and price
 * @param {number} activeBinId - The active bin ID for determining buy/sell sides
 * @returns {Object} Suggested ranges for different strategies
 */
function calculateLiquidityRanges(currentPrice, totalBuyLiquidity, totalSellLiquidity, buySellRatio, bins = [], activeBinId = null, binStep = 25) {
  // Determine which side has MORE liquidity (for display) and which side NEEDS liquidity (for recommendations)
  const needsBuySupport = totalSellLiquidity > totalBuyLiquidity;
  const sideWithMore = needsBuySupport ? 'SELL' : 'BUY'; // Which side currently has MORE liquidity
  const sideToAdd = needsBuySupport ? 'BUY' : 'SELL'; // Which side we should ADD liquidity to

  // Calculate the imbalance ratio (always > 1)
  const imbalanceRatio = needsBuySupport
    ? totalSellLiquidity / (totalBuyLiquidity || 1)
    : totalBuyLiquidity / (totalSellLiquidity || 1);

  // Calculate liquidity deficit
  const deficit = Math.abs(totalBuyLiquidity - totalSellLiquidity);

  // IMPORTANT: Cap ranges to avoid non-refundable bin array creation costs
  // Each bin array holds 70 bins, max bins per position = 69 to stay in 1 array
  // Bin step in basis points: 1 basis point = 0.01%, so binStep/100 = % per bin
  // Max range % = 69 bins × (binStep / 100)
  // Examples:
  //   binStep 200: max 138% range
  //   binStep 100: max 69% range
  //   binStep 25: max 17.25% range
  //   binStep 20: max 13.8% range
  const MAX_BINS_PER_ARRAY = 69;
  const binStepPercent = binStep / 100; // Convert basis points to % (25 -> 0.25%)
  const maxRangePercent = (MAX_BINS_PER_ARRAY * binStepPercent) / 100; // As decimal (0.1725 for binStep=25)

  // Cap the imbalance ratio to not exceed max range
  // If needsBuySupport, range is currentPrice / ratio to currentPrice
  // Range % = (1 - 1/ratio) * 100, so ratio = 1 / (1 - maxRangePercent)
  const maxAllowedRatio = 1 / (1 - maxRangePercent);
  const cappedImbalanceRatio = Math.min(imbalanceRatio, maxAllowedRatio);

  // Strategy 1: Full Imbalance Correction - Now capped to stay within 69 bins
  const fullCorrectionLower = needsBuySupport ? currentPrice / cappedImbalanceRatio : currentPrice;
  const fullCorrectionUpper = needsBuySupport ? currentPrice : currentPrice * cappedImbalanceRatio;
  const fullCorrectionRangeWidth = needsBuySupport
    ? ((currentPrice - fullCorrectionLower) / currentPrice) * 100
    : ((fullCorrectionUpper - currentPrice) / currentPrice) * 100;

  const fullCorrection = {
    name: 'Full Imbalance Correction',
    description: 'Widest range - Protects from volatility, set and forget',
    side: sideToAdd,
    lowerBound: fullCorrectionLower,
    upperBound: fullCorrectionUpper,
    expectedRatio: 1.0,
    suggestedLiquidityUsd: deficit,
    rangePercentage: fullCorrectionRangeWidth.toFixed(1)
  };

  // Strategy 2: Liquidity Deficit Targeting
  const deficitLower = needsBuySupport ? currentPrice * 0.95 : currentPrice;
  const deficitUpper = needsBuySupport ? currentPrice : currentPrice * 1.05;
  const deficitRangeWidth = needsBuySupport
    ? ((currentPrice - deficitLower) / currentPrice) * 100
    : ((deficitUpper - currentPrice) / currentPrice) * 100;

  const deficitTargeting = {
    name: 'Liquidity Deficit Targeting',
    description: 'Moderate range - Targets 50% balance improvement',
    side: sideToAdd,
    lowerBound: deficitLower,
    upperBound: deficitUpper,
    expectedRatio: needsBuySupport
      ? (totalBuyLiquidity + deficit / 2) / totalSellLiquidity
      : totalBuyLiquidity / (totalSellLiquidity + deficit / 2),
    suggestedLiquidityUsd: deficit / 2,
    rangePercentage: deficitRangeWidth.toFixed(1)
  };

  // Strategy 3: Proportional Range Scaling
  const imbalance = Math.abs(1 - buySellRatio);
  const rangeWidth = Math.min(0.10, imbalance * 0.10); // Max 10%
  const proportionalLower = needsBuySupport ? currentPrice * (1 - rangeWidth) : currentPrice;
  const proportionalUpper = needsBuySupport ? currentPrice : currentPrice * (1 + rangeWidth);
  const proportionalRangeWidth = needsBuySupport
    ? ((currentPrice - proportionalLower) / currentPrice) * 100
    : ((proportionalUpper - currentPrice) / currentPrice) * 100;

  const proportionalScaling = {
    name: 'Proportional Range Scaling',
    description: 'Scaled range - Proportional to imbalance, max 10%',
    side: sideToAdd,
    lowerBound: proportionalLower,
    upperBound: proportionalUpper,
    expectedRatio: needsBuySupport
      ? (totalBuyLiquidity + deficit * rangeWidth) / totalSellLiquidity
      : totalBuyLiquidity / (totalSellLiquidity + deficit * rangeWidth),
    suggestedLiquidityUsd: deficit * rangeWidth,
    rangePercentage: proportionalRangeWidth.toFixed(1)
  };

  // Strategy 4: Simple Percentage-Based (Most Aggressive)
  const percentageMultiplier = Math.max(1 - buySellRatio, buySellRatio - 1);
  const percentageRange = 0.05 * percentageMultiplier; // 5% base * imbalance
  const simpleLower = needsBuySupport ? currentPrice * (1 - percentageRange) : currentPrice;
  const simpleUpper = needsBuySupport ? currentPrice : currentPrice * (1 + percentageRange);
  const simpleRangeWidth = needsBuySupport
    ? ((currentPrice - simpleLower) / currentPrice) * 100
    : ((simpleUpper - currentPrice) / currentPrice) * 100;

  const simplePercentage = {
    name: 'Simple Percentage-Based',
    description: 'Tight range - Maximum fee capture, needs active management',
    side: sideToAdd,
    lowerBound: simpleLower,
    upperBound: simpleUpper,
    expectedRatio: needsBuySupport
      ? (totalBuyLiquidity + deficit * percentageRange) / totalSellLiquidity
      : totalBuyLiquidity / (totalSellLiquidity + deficit * percentageRange),
    suggestedLiquidityUsd: deficit * percentageRange,
    rangePercentage: simpleRangeWidth.toFixed(1)
  };

  // Strategy 5: Peak Liquidity Zone (Place liquidity where it's most concentrated overall)
  let peakLiquidity = {
    name: 'Peak Liquidity',
    description: 'Hot zone - Place in the most concentrated liquidity area',
    side: 'BOTH',
    lowerBound: currentPrice * 0.95,
    upperBound: currentPrice * 1.05,
    expectedRatio: buySellRatio,
    suggestedLiquidityUsd: (totalBuyLiquidity + totalSellLiquidity) * 0.05,
    rangePercentage: '10.0'
  };

  // Strategy 6: Follow the Herd (Follow the dominant side's concentration)
  let followTheHerd = {
    name: 'Follow the Herd',
    description: 'Mirror majority - Add to the side with more liquidity',
    side: sideWithMore,
    lowerBound: currentPrice * 0.95,
    upperBound: currentPrice * 1.05,
    expectedRatio: buySellRatio,
    suggestedLiquidityUsd: (totalBuyLiquidity + totalSellLiquidity) * 0.05,
    rangePercentage: '10.0'
  };

  // Find the concentration zones if we have bins data
  if (bins && bins.length > 0) {
    // Filter out bins with negligible liquidity
    const significantBins = bins.filter(b => b.liquidityUsd > 100);

    if (significantBins.length > 0) {
      // Sort bins by binId to maintain order
      const sortedBins = [...significantBins].sort((a, b) => a.binId - b.binId);

      // Use a sliding window to find the most concentrated cluster (for Peak Liquidity)
      const windowSize = Math.min(10, Math.floor(sortedBins.length * 0.3));
      let maxLiquidity = 0;
      let bestCluster = null;

      for (let i = 0; i <= sortedBins.length - windowSize; i++) {
        const window = sortedBins.slice(i, i + windowSize);
        const windowLiquidity = window.reduce((sum, b) => sum + b.liquidityUsd, 0);

        if (windowLiquidity > maxLiquidity) {
          maxLiquidity = windowLiquidity;
          bestCluster = window;
        }
      }

      if (bestCluster && bestCluster.length > 0) {
        // Peak Liquidity strategy - use overall best cluster
        const clusterPrices = bestCluster.map(b => b.price);
        const concentrationLower = Math.min(...clusterPrices);
        const concentrationUpper = Math.max(...clusterPrices);
        const suggestedAmount = Math.max(deficit * 0.05, maxLiquidity * 0.05);

        const avgClusterPrice = clusterPrices.reduce((sum, p) => sum + p, 0) / clusterPrices.length;
        let concentrationSide = 'BOTH';
        if (avgClusterPrice < currentPrice * 0.98) {
          concentrationSide = 'BUY';
        } else if (avgClusterPrice > currentPrice * 1.02) {
          concentrationSide = 'SELL';
        }

        const rangeWidth = ((concentrationUpper - concentrationLower) / currentPrice) * 100;

        peakLiquidity = {
          name: 'Peak Liquidity',
          description: 'Hot zone - Place in the most concentrated liquidity area',
          side: concentrationSide,
          lowerBound: concentrationLower,
          upperBound: concentrationUpper,
          expectedRatio: buySellRatio,
          suggestedLiquidityUsd: suggestedAmount,
          rangePercentage: rangeWidth.toFixed(1)
        };
      }

      // Follow the Herd strategy - find concentration on the DOMINANT side only
      console.log(`[Follow the Herd] Side with MORE liquidity: ${sideWithMore}`);
      console.log(`[Follow the Herd] Active bin ID: ${activeBinId}`);
      console.log(`[Follow the Herd] Total bins with liquidity: ${sortedBins.length}`);

      const dominantSideBins = sortedBins.filter(b => {
        if (!activeBinId) {
          // Fallback to price-based filtering if activeBinId is not provided
          if (sideWithMore === 'BUY') {
            return b.price < currentPrice;
          } else {
            return b.price > currentPrice;
          }
        }
        // Use binId for accurate side determination
        if (sideWithMore === 'BUY') {
          return b.binId < activeBinId; // BUY side is below active bin
        } else {
          return b.binId > activeBinId; // SELL side is above active bin
        }
      });

      console.log(`[Follow the Herd] Bins on ${sideWithMore} side: ${dominantSideBins.length}`);

      if (dominantSideBins.length > 0) {
        // Find best cluster on the dominant side
        const herdWindowSize = Math.min(10, Math.floor(dominantSideBins.length * 0.4));
        let herdMaxLiquidity = 0;
        let herdBestCluster = null;

        for (let i = 0; i <= dominantSideBins.length - herdWindowSize; i++) {
          const window = dominantSideBins.slice(i, i + herdWindowSize);
          const windowLiquidity = window.reduce((sum, b) => sum + b.liquidityUsd, 0);

          if (windowLiquidity > herdMaxLiquidity) {
            herdMaxLiquidity = windowLiquidity;
            herdBestCluster = window;
          }
        }

        if (herdBestCluster && herdBestCluster.length > 0) {
          const herdPrices = herdBestCluster.map(b => b.price);
          const herdBinIds = herdBestCluster.map(b => b.binId);
          const clusterLower = Math.min(...herdPrices);
          const clusterUpper = Math.max(...herdPrices);

          // Extend range from cluster to current price
          let herdLower, herdUpper;
          if (sideWithMore === 'BUY') {
            // BUY side: cluster is below current price, so range from cluster to current price
            herdLower = clusterLower;
            herdUpper = currentPrice;
          } else {
            // SELL side: cluster is above current price, so range from current price to cluster
            herdLower = currentPrice;
            herdUpper = clusterUpper;
          }

          const herdSuggestedAmount = Math.max(deficit * 0.05, herdMaxLiquidity * 0.05);
          const herdRangeWidth = ((herdUpper - herdLower) / currentPrice) * 100;

          console.log(`[Follow the Herd] Best cluster: ${herdBestCluster.length} bins`);
          console.log(`[Follow the Herd] Cluster bin IDs: ${Math.min(...herdBinIds)} to ${Math.max(...herdBinIds)}`);
          console.log(`[Follow the Herd] Cluster range: $${clusterLower.toFixed(6)} to $${clusterUpper.toFixed(6)}`);
          console.log(`[Follow the Herd] Extended to current price: $${herdLower.toFixed(6)} to $${herdUpper.toFixed(6)}`);
          console.log(`[Follow the Herd] Cluster liquidity: $${herdMaxLiquidity.toFixed(2)}`);

          followTheHerd = {
            name: 'Follow the Herd',
            description: 'Mirror majority - Add to the side with more liquidity',
            side: sideWithMore,
            lowerBound: herdLower,
            upperBound: herdUpper,
            expectedRatio: buySellRatio,
            suggestedLiquidityUsd: herdSuggestedAmount,
            rangePercentage: herdRangeWidth.toFixed(1)
          };
        }
      }
    }
  }

  return {
    currentImbalance: {
      sideWithMore: sideWithMore, // Which side has MORE liquidity (for display)
      sideToAdd: sideToAdd, // Which side to ADD liquidity to (for recommendations)
      ratio: imbalanceRatio,
      deficit: deficit
    },
    strategies: [
      followTheHerd,
      peakLiquidity,
      fullCorrection,
      deficitTargeting,
      proportionalScaling,
      simplePercentage
    ]
  };
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

      // Parse price (already calculated by SDK and decimal-adjusted)
      // The SDK's bin.price already accounts for token decimals and returns
      // the price in Token Y per Token X (e.g., SOL per token for SOL pairs)
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

    const currentPriceValue = parseFloat(binData.bins.find(b => b.binId === activeBin)?.price || '0');

    // Calculate suggested liquidity ranges based on imbalance
    const suggestedRanges = calculateLiquidityRanges(
      currentPriceValue,
      totalBuyLiquidity,
      totalSellLiquidity,
      buySellRatio,
      bins, // Pass bins data for concentration strategies
      activeBin, // Pass active bin ID for accurate side filtering
      binStep // Pass binStep to cap ranges based on bin array limits
    );

    const stats = {
      totalBins: bins.length,
      totalLiquidityUsd,
      activeBinId: activeBin,
      currentPrice: currentPriceValue,
      binStep,
      largestBuyWall: buyWalls.length > 0 ? Math.max(...buyWalls.map(b => b.liquidityUsd)) : 0,
      largestSellWall: sellWalls.length > 0 ? Math.max(...sellWalls.map(b => b.liquidityUsd)) : 0,
      buyWallsCount: buyWalls.length,
      sellWallsCount: sellWalls.length,
      totalBuyLiquidity: totalBuyLiquidity,
      totalSellLiquidity: totalSellLiquidity,
      buySellRatio: buySellRatio,
      suggestedRanges: suggestedRanges
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

    // Calculate suggested liquidity ranges based on imbalance
    // Note: For aggregated data, use the first pool's binStep
    const firstPoolBinStep = validPools[0]?.pool?.binStep || 25;
    const suggestedRanges = calculateLiquidityRanges(
      marketPrice,
      totalBuyLiquidity,
      totalSellLiquidity,
      buySellRatio,
      aggregatedBins, // Pass aggregated bins for concentration strategies
      null, // No single activeBinId for aggregated data
      firstPoolBinStep // Use first pool's binStep as reference
    );

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
      buySellRatio: buySellRatio,
      suggestedRanges: suggestedRanges
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

/**
 * Get top liquidity providers for a DLMM pool
 * @param {string} pairAddress - The DLMM pair address
 * @param {number} limit - Number of top LPs to return (default: 20)
 * @returns {Promise<Array>} Array of top liquidity providers
 */
async function getTopLiquidityProviders(pairAddress, limit = 20) {
  try {
    console.log(`Fetching top ${limit} LPs for pool: ${pairAddress}`);

    // Check cache first
    const cacheKey = `${pairAddress}-${limit}`;
    const cached = topLPsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
      console.log(`✅ Returning cached Top LPs (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.data;
    }

    const pairPubkey = new PublicKey(pairAddress);
    const dlmmPool = await DLMM.create(connection, pairPubkey);

    // DLMM program ID
    const DLMM_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

    // Try multiple offsets to find position accounts
    const offsetsToTry = [8, 40, 72, 104];
    let positionAccounts = [];

    for (const offset of offsetsToTry) {
      try {
        console.log(`Trying offset ${offset}...`);
        positionAccounts = await connection.getProgramAccounts(DLMM_PROGRAM_ID, {
          filters: [{ memcmp: { offset, bytes: pairPubkey.toBase58() } }]
        });

        if (positionAccounts.length > 0) {
          console.log(`✅ Found ${positionAccounts.length} positions with offset ${offset}`);
          break;
        }
      } catch (err) {
        console.error(`Error with offset ${offset}: ${err.message}`);
      }
    }

    if (positionAccounts.length === 0) {
      console.log('⚠️ No positions found - pool might have no LPs');
      const emptyResult = { topLPs: [], totalPositions: 0, totalPoolLiquidity: 0 };
      topLPsCache.set(cacheKey, { data: emptyResult, timestamp: Date.now() });
      return emptyResult;
    }

    // Get token decimals and prices
    const mintX = dlmmPool.tokenX.publicKey.toString();
    const mintY = dlmmPool.tokenY.publicKey.toString();
    const decimalsX = dlmmPool.tokenX.mint.decimals;
    const decimalsY = dlmmPool.tokenY.mint.decimals;

    const prices = await getTokenPricesInUSD([mintX, mintY]);
    const priceXinUSD = prices[mintX] || 0;
    const priceYinUSD = prices[mintY] || 0;

    // Process positions in batches to avoid rate limiting
    const ownerLiquidity = new Map();
    const BATCH_SIZE = 5; // Process 5 positions at a time to avoid rate limits
    console.log(`Processing ${positionAccounts.length} positions in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < positionAccounts.length; i += BATCH_SIZE) {
      const batch = positionAccounts.slice(i, i + BATCH_SIZE);
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(positionAccounts.length / BATCH_SIZE)}: Processing ${batch.length} positions...`);

      // Process batch concurrently
      await Promise.all(batch.map(async (positionAccount) => {
        try {
          const position = await dlmmPool.getPosition(positionAccount.pubkey);

          if (!position || !position.positionData) return;

          const owner = position.positionData.owner ? position.positionData.owner.toString() : positionAccount.pubkey.toString();

          // Calculate liquidity for this position and track bin distribution
          let totalX = 0, totalY = 0;
          const binDistribution = [];

          if (position.positionData.positionBinData) {
            for (const binData of position.positionData.positionBinData) {
              const xAmount = parseFloat(binData.positionXAmount.toString()) / Math.pow(10, decimalsX);
              const yAmount = parseFloat(binData.positionYAmount.toString()) / Math.pow(10, decimalsY);
              totalX += xAmount;
              totalY += yAmount;

              // Track bin-level data
              const binLiquidityUsd = (xAmount * priceXinUSD) + (yAmount * priceYinUSD);
              if (binLiquidityUsd > 0) {
                // Adjust bin price for decimal difference
                const rawPrice = parseFloat(binData.price || 0);
                const adjustedPrice = rawPrice * Math.pow(10, decimalsX - decimalsY);

                binDistribution.push({
                  binId: binData.binId,
                  price: adjustedPrice,
                  liquidityUsd: binLiquidityUsd,
                  amountX: xAmount,
                  amountY: yAmount
                });
              }
            }
          }

          const liquidityUsd = (totalX * priceXinUSD) + (totalY * priceYinUSD);

          // Aggregate by owner
          if (!ownerLiquidity.has(owner)) {
            ownerLiquidity.set(owner, {
              owner,
              liquidityUsd: 0,
              liquidityX: 0,
              liquidityY: 0,
              positionCount: 0,
              bins: [] // Array to store all bins across positions
            });
          }
          const ownerData = ownerLiquidity.get(owner);
          ownerData.liquidityUsd += liquidityUsd;
          ownerData.liquidityX += totalX;
          ownerData.liquidityY += totalY;
          ownerData.positionCount += 1;

          // Merge bin data
          for (const bin of binDistribution) {
            const existingBin = ownerData.bins.find(b => b.binId === bin.binId);
            if (existingBin) {
              existingBin.liquidityUsd += bin.liquidityUsd;
              existingBin.amountX += bin.amountX;
              existingBin.amountY += bin.amountY;
            } else {
              ownerData.bins.push({ ...bin });
            }
          }

        } catch (err) {
          // Silent fail for individual positions
        }
      }));

      // Add delay between batches (except for last batch)
      if (i + BATCH_SIZE < positionAccounts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds between batches
      }
    }

    console.log(`Processed positions for ${ownerLiquidity.size} unique LPs`);

    // Convert to array and sort by liquidity
    const positionsArray = Array.from(ownerLiquidity.values())
      .filter(lp => lp.liquidityUsd > 0)
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd);

    // Take top N
    const topLPs = positionsArray.slice(0, limit);

    // Calculate total pool liquidity
    const totalPoolLiquidity = positionsArray.reduce((sum, lp) => sum + lp.liquidityUsd, 0);

    // Add rank and percentage, and sort bins by binId
    const rankedLPs = topLPs.map((lp, index) => ({
      ...lp,
      rank: index + 1,
      percentage: totalPoolLiquidity > 0 ? (lp.liquidityUsd / totalPoolLiquidity) * 100 : 0,
      binCount: lp.positionCount, // Number of positions this owner has
      bins: lp.bins.sort((a, b) => a.binId - b.binId) // Sort bins by ID for charting
    }));

    console.log(`Returning top ${rankedLPs.length} LPs (total: ${ownerLiquidity.size} LPs, pool liquidity: $${totalPoolLiquidity.toFixed(2)})`);

    // Get active bin ID - check both possible locations
    const activeBinId = dlmmPool.activeId || dlmmPool.lbPair?.activeId;
    console.log(`Active bin ID: ${activeBinId}`);

    const result = {
      topLPs: rankedLPs,
      totalPositions: ownerLiquidity.size,
      totalPoolLiquidity,
      activeBinId // Include active bin for coloring
    };

    // Cache the result for 5 minutes
    topLPsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`💾 Cached result for 5 minutes`);

    return result;

  } catch (error) {
    console.error('[DLMM Controller Error - Top LPs] Full error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to fetch top liquidity providers: ${error.message}`);
  }
}

module.exports = {
  getLiquidityDistribution,
  getAggregatedLiquidityByTokenPair,
  getTopLiquidityProviders
};
