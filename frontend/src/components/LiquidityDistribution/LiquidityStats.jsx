import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';

const LiquidityStats = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const formatUsd = (value) => {
    if (!value || isNaN(value)) return '$0.00';
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return '$0.0000';
    if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toFixed(6)}`;
    }
  };

  const statCards = [
    {
      label: 'Total Liquidity',
      value: formatUsd(stats.totalLiquidityUsd),
      subtitle: `${stats.totalBins || 0} bins`,
      color: 'default'
    },
    {
      label: 'Current Price',
      value: formatPrice(stats.currentPrice),
      subtitle: 'Live market',
      color: 'default'
    },
    {
      label: 'Buy Liquidity',
      value: formatUsd(stats.totalBuyLiquidity),
      subtitle: `${stats.buyWallsCount || 0} bins`,
      color: 'success'
    },
    {
      label: 'Sell Liquidity',
      value: formatUsd(stats.totalSellLiquidity),
      subtitle: `${stats.sellWallsCount || 0} bins`,
      color: 'error'
    },
    {
      label: 'Buy/Sell Ratio',
      value: stats.buySellRatio ? `${stats.buySellRatio.toFixed(2)}x` : 'N/A',
      subtitle: stats.buySellRatio > 1 ? 'Buy side' : stats.buySellRatio < 1 ? 'Sell side' : 'Balanced',
      color: stats.buySellRatio > 1 ? 'success' : stats.buySellRatio < 1 ? 'error' : 'default'
    },
    {
      label: 'Largest Wall',
      value: formatUsd(Math.max(stats.largestBuyWall || 0, stats.largestSellWall || 0)),
      subtitle: stats.largestBuyWall > stats.largestSellWall ? 'Buy side' : 'Sell side',
      color: 'default'
    }
  ];

  const getColorStyles = (color) => {
    switch (color) {
      case 'success':
        return {
          bgcolor: 'success.main',
          bgopacity: 0.08,
          borderColor: 'success.main',
          textColor: 'success.main'
        };
      case 'error':
        return {
          bgcolor: 'error.main',
          bgopacity: 0.08,
          borderColor: 'error.main',
          textColor: 'error.main'
        };
      default:
        return {
          bgcolor: 'action.hover',
          borderColor: 'divider',
          textColor: 'text.primary'
        };
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stats Grid */}
      <Grid container spacing={1.5}>
        {statCards.map((stat, index) => {
          const colorStyles = getColorStyles(stat.color);
          return (
            <Grid item xs={6} sm={4} md={2} key={index}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  height: '100%',
                  bgcolor: stat.color === 'default' ? 'action.hover' : `${colorStyles.bgcolor}`,
                  ...(stat.color !== 'default' && {
                    bgcolor: (theme) => `${theme.palette[stat.color].main}14`
                  }),
                  border: 1,
                  borderColor: stat.color === 'default' ? 'divider' : `${stat.color}.main`,
                  borderRadius: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {stat.label}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: stat.color === 'default' ? 'text.primary' : `${stat.color}.main`
                  }}
                >
                  {stat.value}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    color: stat.color === 'default' ? 'text.disabled' : `${stat.color}.dark`,
                    opacity: 0.7
                  }}
                >
                  {stat.subtitle}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          py: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'success.main'
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Buy Support
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'primary.main'
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Active Bin
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'error.main'
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Sell Resistance
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LiquidityStats;
