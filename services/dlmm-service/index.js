require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getLiquidityDistribution, getAggregatedLiquidityByTokenPair } = require('./dlmmController');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*'
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main endpoint - Get liquidity distribution for a DLMM pair
app.get('/api/liquidity-distribution/:pairAddress', async (req, res) => {
  try {
    const { pairAddress } = req.params;

    console.log(`[${new Date().toISOString()}] Fetching liquidity distribution for: ${pairAddress}`);

    const distribution = await getLiquidityDistribution(pairAddress);

    console.log(`[${new Date().toISOString()}] Successfully fetched ${distribution.bins.length} bins`);

    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Aggregated liquidity endpoint - Get combined liquidity for all pools with a specific token pair
app.get('/api/aggregated-liquidity', async (req, res) => {
  try {
    const { mint_x, mint_y } = req.query;

    if (!mint_x || !mint_y) {
      return res.status(400).json({
        success: false,
        error: 'Both mint_x and mint_y query parameters are required'
      });
    }

    console.log(`[${new Date().toISOString()}] Fetching aggregated liquidity for pair: ${mint_x}/${mint_y}`);

    const aggregatedData = await getAggregatedLiquidityByTokenPair(mint_x, mint_y);

    console.log(`[${new Date().toISOString()}] Successfully aggregated ${aggregatedData.bins.length} price levels from ${aggregatedData.pools.length} pools`);

    res.json({
      success: true,
      data: aggregatedData
    });
  } catch (error) {
    console.error('[ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 DLMM Liquidity Service running on port ${PORT}`);
  console.log(`📊 RPC: ${process.env.SOLANA_RPC_URL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}\n`);
});
