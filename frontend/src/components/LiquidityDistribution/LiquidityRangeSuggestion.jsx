import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Grid,
  Paper,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PeopleIcon from '@mui/icons-material/People';
import TopLPsDialog from './TopLPsDialog';

const LiquidityRangeSuggestion = ({ suggestedRanges, currentPrice, selectedStrategy, setSelectedStrategy, poolAddress, pools }) => {
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [topLPsOpen, setTopLPsOpen] = useState(false);

  if (!suggestedRanges || !suggestedRanges.strategies) {
    return null;
  }

  const { currentImbalance, strategies } = suggestedRanges;
  const strategy = strategies[selectedStrategy];

  const formatPrice = (price) => {
    if (!price || isNaN(price)) return '$0.0000';
    if (price >= 1) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toFixed(8)}`;
    }
  };

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

  const getSideColor = (side) => {
    return side === 'BUY' ? 'success' : 'error';
  };

  const copyRange = () => {
    const text = `${formatPrice(strategy.lowerBound)} - ${formatPrice(strategy.upperBound)}`;
    navigator.clipboard.writeText(text);
    setSnackbarOpen(true);
  };

  const getStrategyDescription = (idx) => {
    const descriptions = [
      "Wide range keeps you in position longer through pumps and dumps.",
      "Adds 50% of needed liquidity in a moderate 5% range.",
      "Adjusts width based on imbalance severity, capped at 10%.",
      "Maximum fees per dollar but requires active rebalancing."
    ];
    return descriptions[idx] || '';
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header Section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: { xs: 'flex-start', lg: 'center' },
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            Suggested Ranges
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Position optimization
          </Typography>
        </Box>

        {/* Strategy Selection Tabs */}
        <ButtonGroup variant="outlined" size="small">
          {strategies.map((strat, idx) => (
            <Button
              key={idx}
              onClick={() => setSelectedStrategy(idx)}
              variant={selectedStrategy === idx ? 'contained' : 'outlined'}
              sx={{
                textTransform: 'none',
                fontWeight: selectedStrategy === idx ? 600 : 400,
                minWidth: { xs: 'auto', sm: 100 }
              }}
            >
              {strat.name}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={2}>
        {/* Price Range */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              height: '100%'
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Price Range
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                {formatPrice(strategy.lowerBound)}
              </Typography>
              <Typography variant="body2" color="text.disabled">
                →
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
                {formatPrice(strategy.upperBound)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.disabled">
              Width: {strategy.rangePercentage}%
            </Typography>
          </Paper>
        </Grid>

        {/* Liquidity */}
        <Grid item xs={6} sm={3} md={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              height: '100%'
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Liquidity
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, my: 1 }}>
              {formatUsd(strategy.suggestedLiquidityUsd)}
            </Typography>
          </Paper>
        </Grid>

        {/* Balance Ratio */}
        <Grid item xs={6} sm={3} md={2}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'action.hover',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              height: '100%'
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Balance
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main', my: 1 }}>
              {strategy.expectedRatio.toFixed(2)}x
            </Typography>
          </Paper>
        </Grid>

        {/* Imbalance */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: (theme) => `${theme.palette[getSideColor(currentImbalance.sideWithMore)].main}14`,
              border: 1,
              borderColor: `${getSideColor(currentImbalance.sideWithMore)}.main`,
              borderRadius: 2,
              height: '100%'
            }}
          >
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Current Imbalance
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontWeight: 600,
                color: `${getSideColor(currentImbalance.sideWithMore)}.main`,
                my: 1
              }}
            >
              {currentImbalance.ratio.toFixed(2)}x {currentImbalance.sideWithMore}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Market bias detection
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Action Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: 'action.selected',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
            {strategy.description.split(' - ')[0]}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getStrategyDescription(selectedStrategy)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            onClick={copyRange}
            sx={{ textTransform: 'none' }}
          >
            Copy Range
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PeopleIcon />}
            onClick={() => setTopLPsOpen(true)}
            disabled={!poolAddress}
            sx={{ textTransform: 'none' }}
          >
            Top LPs
          </Button>
          <Button
            variant="contained"
            size="small"
            endIcon={<OpenInNewIcon />}
            href={poolAddress ? `https://app.meteora.ag/dlmm/${poolAddress}` : 'https://app.meteora.ag/pools'}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textTransform: 'none' }}
          >
            Add Liquidity
          </Button>
        </Box>
      </Paper>

      {/* Snackbar for copy confirmation */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbarOpen(false)}>
          Range copied to clipboard!
        </Alert>
      </Snackbar>

      {/* Top LPs Dialog */}
      <TopLPsDialog
        open={topLPsOpen}
        onClose={() => setTopLPsOpen(false)}
        poolAddress={poolAddress}
        poolName={pools && pools.length > 0 ? pools[0].pairName : null}
      />
    </Box>
  );
};

export default LiquidityRangeSuggestion;
