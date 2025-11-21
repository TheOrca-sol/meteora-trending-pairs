require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { getLiquidityDistribution, getAggregatedLiquidityByTokenPair } = require('./dlmmController');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST']
  }
});

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

// WebSocket subscription manager
const subscriptions = new Map(); // socketId -> { intervalId, params }

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  // Handle liquidity subscription
  socket.on('subscribe:liquidity', async ({ pairAddress, mintX, mintY }) => {
    console.log(`[WebSocket] ${socket.id} subscribing to:`, { pairAddress, mintX, mintY });

    // Clear existing subscription if any
    if (subscriptions.has(socket.id)) {
      const { intervalId } = subscriptions.get(socket.id);
      clearInterval(intervalId);
    }

    // Fetch and send initial data immediately
    try {
      const data = mintX && mintY
        ? await getAggregatedLiquidityByTokenPair(mintX, mintY)
        : await getLiquidityDistribution(pairAddress);

      socket.emit('liquidity-update', {
        data,
        timestamp: Date.now()
      });
      console.log(`[WebSocket] Sent initial data to ${socket.id}`);
    } catch (error) {
      console.error(`[WebSocket] Error fetching initial data:`, error.message);
      socket.emit('liquidity-error', { error: error.message });
    }

    // Set up polling interval (30 seconds)
    const intervalId = setInterval(async () => {
      try {
        const data = mintX && mintY
          ? await getAggregatedLiquidityByTokenPair(mintX, mintY)
          : await getLiquidityDistribution(pairAddress);

        socket.emit('liquidity-update', {
          data,
          timestamp: Date.now()
        });
        console.log(`[WebSocket] Sent update to ${socket.id}`);
      } catch (error) {
        console.error(`[WebSocket] Error in polling interval:`, error.message);
        socket.emit('liquidity-error', { error: error.message });
      }
    }, 30000); // Poll every 30 seconds

    // Store subscription
    subscriptions.set(socket.id, {
      intervalId,
      params: { pairAddress, mintX, mintY }
    });

    console.log(`[WebSocket] Active subscriptions: ${subscriptions.size}`);
  });

  // Handle unsubscribe
  socket.on('unsubscribe:liquidity', () => {
    if (subscriptions.has(socket.id)) {
      const { intervalId } = subscriptions.get(socket.id);
      clearInterval(intervalId);
      subscriptions.delete(socket.id);
      console.log(`[WebSocket] ${socket.id} unsubscribed. Active: ${subscriptions.size}`);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (subscriptions.has(socket.id)) {
      const { intervalId } = subscriptions.get(socket.id);
      clearInterval(intervalId);
      subscriptions.delete(socket.id);
    }
    console.log(`[WebSocket] Client disconnected: ${socket.id}. Active: ${subscriptions.size}`);
  });
});

// Start server (use 'server' instead of 'app')
server.listen(PORT, () => {
  console.log(`\n🚀 DLMM Liquidity Service running on port ${PORT}`);
  console.log(`📊 RPC: ${process.env.SOLANA_RPC_URL}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔌 WebSocket enabled for live updates\n`);
});
