import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Alert, AlertTitle, Link, Chip } from '@mui/material';
import { io } from 'socket.io-client';
import LiquidityChart from './LiquidityChart';
import LiquidityStats from './LiquidityStats';
import LiquidityRangeSuggestion from './LiquidityRangeSuggestion';

const LiquidityDistribution = ({ pairAddress, mintX, mintY }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Validate params
    if (!mintX && !mintY && !pairAddress) {
      setError('No pair address or token mints provided');
      setLoading(false);
      return;
    }

    // Get DLMM service URL from environment variable
    const dlmmServiceUrl = process.env.REACT_APP_DLMM_SERVICE_URL || 'http://localhost:3001';

    // Create WebSocket connection
    console.log('[LiquidityDistribution] Connecting to WebSocket...', dlmmServiceUrl);
    const socket = io(dlmmServiceUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[LiquidityDistribution] WebSocket connected:', socket.id);
      setIsLive(true);
      setError(null);

      // Subscribe to liquidity updates
      socket.emit('subscribe:liquidity', {
        pairAddress,
        mintX,
        mintY
      });
    });

    socket.on('disconnect', () => {
      console.log('[LiquidityDistribution] WebSocket disconnected');
      setIsLive(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[LiquidityDistribution] Connection error:', err.message);
      setIsLive(false);
      setError(`WebSocket connection error: ${err.message}`);
    });

    // Data update handler
    socket.on('liquidity-update', ({ data: newData, timestamp }) => {
      console.log('[LiquidityDistribution] Received update at', new Date(timestamp).toLocaleTimeString());
      setData(newData);
      setLastUpdate(timestamp);
      setLoading(false);
      setError(null);
    });

    // Error handler
    socket.on('liquidity-error', ({ error: errorMsg }) => {
      console.error('[LiquidityDistribution] Data error:', errorMsg);
      setError(errorMsg);
      setLoading(false);
    });

    // Cleanup on unmount
    return () => {
      console.log('[LiquidityDistribution] Cleaning up WebSocket...');
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:liquidity');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [pairAddress, mintX, mintY]);

  // Loading State
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          gap: 2
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary">
          Loading liquidity data...
        </Typography>
      </Box>
    );
  }

  // Error State
  if (error) {
    return (
      <Alert severity="error" variant="outlined">
        <AlertTitle>Failed to load liquidity data</AlertTitle>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {error}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Make sure DLMM service is running: <code>cd services/dlmm-service && npm start</code>
        </Typography>
      </Alert>
    );
  }

  // Empty State
  if (!data || !data.bins || data.bins.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          px: 3,
          bgcolor: 'action.hover',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="body2" color="text.secondary" gutterBottom>
          No liquidity data available
        </Typography>
        <Typography variant="caption" color="text.disabled">
          This pair doesn't have any liquidity bins yet
        </Typography>
      </Box>
    );
  }

  const isAggregated = mintX !== undefined && mintY !== undefined;
  const poolCount = data.stats?.poolCount || data.pools?.length || 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {isAggregated ? 'Aggregated Liquidity' : 'Liquidity Distribution'}
          </Typography>

          {/* Live Indicator */}
          <Chip
            label={isLive ? 'LIVE' : 'OFFLINE'}
            size="small"
            sx={{
              bgcolor: isLive ? 'success.main' : 'error.main',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20,
              '& .MuiChip-label': { px: 1 }
            }}
          />

          {isAggregated && poolCount > 1 && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                borderRadius: 1,
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              {poolCount} Pools
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: 'success.main'
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {isAggregated
                ? `${data.bins.length} levels across ${poolCount} pool${poolCount > 1 ? 's' : ''}`
                : `${data.bins.length} bins`
              }
            </Typography>
          </Box>

          {/* Last Update Timestamp */}
          {lastUpdate && (
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              Updated {new Date(lastUpdate).toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Pool Details Chips - Only for aggregated view */}
      {isAggregated && data.pools && data.pools.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.pools.slice(0, 8).map((pool, idx) => (
            <Link
              key={idx}
              href={`https://app.meteora.ag/dlmm/${pool.address}`}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'action.selected',
                  borderColor: 'primary.main',
                  transform: 'translateY(-1px)'
                }
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {pool.pairName}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                •
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Step {pool.binStep}
              </Typography>
            </Link>
          ))}
          {data.pools.length > 8 && (
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: 'action.selected',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" color="text.secondary">
                +{data.pools.length - 8} more
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Stats Section */}
      <LiquidityStats stats={data.stats} />

      {/* Chart Section */}
      <LiquidityChart
        bins={data.bins}
        activeBinId={data.activeBin}
        currentPrice={data.currentPrice}
        suggestedRange={data.stats?.suggestedRanges?.strategies[selectedStrategy]}
      />

      {/* Suggested Ranges Section */}
      {data.stats?.suggestedRanges && (
        <LiquidityRangeSuggestion
          suggestedRanges={data.stats.suggestedRanges}
          currentPrice={data.currentPrice}
          selectedStrategy={selectedStrategy}
          setSelectedStrategy={setSelectedStrategy}
          poolAddress={isAggregated ? (data.pools?.[0]?.address || null) : pairAddress}
          pools={isAggregated ? data.pools : null}
          pairName={data.pools?.[0]?.pairName || null}
          mintX={mintX}
          mintY={mintY}
          bins={data.bins}
        />
      )}
    </Box>
  );
};

export default LiquidityDistribution;
