import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Alert, AlertTitle } from '@mui/material';
import LiquidityChart from './LiquidityChart';
import LiquidityStats from './LiquidityStats';
import LiquidityRangeSuggestion from './LiquidityRangeSuggestion';

const LiquidityDistribution = ({ pairAddress, mintX, mintY }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(0);

  useEffect(() => {
    const fetchLiquidityData = async () => {
      // Get DLMM service URL from environment variable
      const dlmmServiceUrl = process.env.REACT_APP_DLMM_SERVICE_URL || 'http://localhost:3001';

      // Prefer aggregated view if both mints available, otherwise single pair
      const endpoint = (mintX && mintY)
        ? `${dlmmServiceUrl}/api/aggregated-liquidity?mint_x=${mintX}&mint_y=${mintY}`
        : `${dlmmServiceUrl}/api/liquidity-distribution/${pairAddress}`;

      if (!mintX && !mintY && !pairAddress) {
        setError('No pair address or token mints provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch from microservice
        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error(`Failed to fetch liquidity data: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch liquidity data');
        }

        setData(result.data);
      } catch (err) {
        console.error('Error fetching liquidity distribution:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLiquidityData();
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
        </Box>
      </Box>

      {/* Pool Details Chips - Only for aggregated view */}
      {isAggregated && data.pools && data.pools.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {data.pools.slice(0, 8).map((pool, idx) => (
            <Box
              key={idx}
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1
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
            </Box>
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
        />
      )}
    </Box>
  );
};

export default LiquidityDistribution;
