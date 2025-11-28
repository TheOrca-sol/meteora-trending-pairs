import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Slider } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Cell } from 'recharts';

const BinRangeSelector = ({
  bins = [],
  currentPrice,
  suggestedLowerBound,
  suggestedUpperBound,
  onRangeChange,
  distributionStrategy = 'spot',
  amountTokenX = 0,
  amountTokenY = 0,
  tokenXName = 'Token X',
  tokenYName = 'Token Y'
}) => {
  const [selectedRange, setSelectedRange] = useState({
    min: suggestedLowerBound || 0,
    max: suggestedUpperBound || 0
  });

  // Determine if we should show position bins and which side
  const hasTokenX = amountTokenX > 0;
  const hasTokenY = amountTokenY > 0;
  const showPositionBins = hasTokenX || hasTokenY;

  // Determine which side to show liquidity
  // Token Y (usually SOL) = left side (below current price)
  // Token X = right side (above current price)
  const isTokenYPosition = hasTokenY && !hasTokenX;
  const isTokenXPosition = hasTokenX && !hasTokenY;
  const isBothTokens = hasTokenX && hasTokenY;

  console.log('[BinRangeSelector] Debug:', {
    amountTokenX,
    amountTokenY,
    hasTokenX,
    hasTokenY,
    showPositionBins,
    isTokenYPosition,
    isTokenXPosition,
    isBothTokens,
    currentPrice,
    suggestedLowerBound,
    suggestedUpperBound
  });

  useEffect(() => {
    if (suggestedLowerBound && suggestedUpperBound) {
      let adjustedMin = suggestedLowerBound;
      let adjustedMax = suggestedUpperBound;

      // Don't adjust range - let user see the full suggested range
      // The position bars will only show in the appropriate bins based on price vs currentPrice

      setSelectedRange({
        min: adjustedMin,
        max: adjustedMax
      });

      console.log('[BinRangeSelector] Range set:', { min: adjustedMin, max: adjustedMax });
    }
  }, [suggestedLowerBound, suggestedUpperBound, currentPrice]);

  useEffect(() => {
    if (onRangeChange) {
      onRangeChange(selectedRange.min, selectedRange.max);
    }
  }, [selectedRange, onRangeChange]);

  // Calculate distribution preview based on strategy
  const getDistributionForBin = (price, index) => {
    // Only show position bars if user entered amounts
    if (!showPositionBins) {
      return 0;
    }

    const inRange = price >= selectedRange.min && price <= selectedRange.max;
    if (!inRange) {
      return 0;
    }

    // For single token positions, show bars in range regardless of current price
    // The suggested range from the strategy already accounts for which side
    // Just show all bars in the selected range for the token they're providing

    console.log('[BinRangeSelector] Showing bar at price:', price, 'currentPrice:', currentPrice, 'for token:', isTokenYPosition ? 'Y' : isTokenXPosition ? 'X' : 'Both');

    const rangeStart = bins.findIndex(b => b.price >= selectedRange.min);
    const rangeEnd = bins.findIndex(b => b.price > selectedRange.max);
    const rangeSize = Math.max(rangeEnd - rangeStart, 1);
    const positionInRange = index - rangeStart;

    // Base liquidity value (higher for visibility)
    const baseValue = 150;

    switch (distributionStrategy) {
      case 'spot':
        // Uniform distribution across entire range (flat/spot)
        return baseValue * 0.9;

      case 'curve':
        // Bell curve - concentrated at center with gradual falloff
        const center = Math.floor(rangeSize / 2);
        const distFromCenter = Math.abs(positionInRange - center);
        const maxDist = Math.max(rangeSize / 2, 1);
        const curveFactor = 1 - (distFromCenter / maxDist);
        return baseValue * (0.3 + curveFactor * 0.7);

      case 'bid-ask':
        // Concentrated at both edges (bid and ask sides)
        const distanceFromStart = positionInRange;
        const distanceFromEnd = rangeSize - positionInRange - 1;
        const distanceFromEdge = Math.min(distanceFromStart, distanceFromEnd);
        const edgeFactor = 1 - (distanceFromEdge / Math.max(rangeSize / 2, 1));
        return baseValue * (0.3 + edgeFactor * 0.7);

      default:
        return baseValue * 0.5;
    }
  };

  // Calculate how many bins to show based on the selected range
  // We want to show bins beyond the selected range for context
  const selectedRangeBins = bins.filter(b => b.price >= selectedRange.min && b.price <= selectedRange.max);
  const rangeWidth = selectedRange.max - selectedRange.min;

  // Show 3x the range width on each side for context
  const displayMin = Math.max(0, selectedRange.min - rangeWidth * 1.5);
  const displayMax = selectedRange.max + rangeWidth * 1.5;

  // Filter bins to display range
  const displayBins = bins.filter(b => b.price >= displayMin && b.price <= displayMax);

  // Limit to reasonable number for performance (100 bins max)
  const binsToShow = displayBins.length > 100 ? displayBins.slice(0, 100) : displayBins;

  // Prepare bin data for chart with distribution preview
  const chartData = binsToShow.map((bin, idx) => ({
    price: bin.price,
    liquidity: bin.liquidityUsd || 0,
    index: bins.indexOf(bin),
    inRange: bin.price >= selectedRange.min && bin.price <= selectedRange.max,
    positionLiquidity: getDistributionForBin(bin.price, bins.indexOf(bin))
  }));

  // Debug: log how many bars have position liquidity
  const barsWithPosition = chartData.filter(d => d.positionLiquidity > 0);
  console.log('[BinRangeSelector] Chart data:', {
    totalBins: chartData.length,
    barsWithPosition: barsWithPosition.length,
    positions: barsWithPosition.map(b => ({ price: b.price, liquidity: b.positionLiquidity }))
  });

  const formatPrice = (price) => {
    if (!price) return '$0';
    if (price < 0.00001) {
      const priceStr = price.toFixed(20);
      const match = priceStr.match(/0\.0*[1-9]/);
      if (match) {
        const zerosCount = match[0].length - 2;
        return `$${price.toFixed(zerosCount + 4)}`;
      }
      return `$${price.toExponential(4)}`;
    }
    if (price < 1) return `$${price.toFixed(8)}`;
    return `$${price.toFixed(4)}`;
  };

  // Find price range for slider
  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));

  const handleSliderChange = (event, newValue) => {
    setSelectedRange({
      min: newValue[0],
      max: newValue[1]
    });
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
        Visual Range Selector
      </Typography>

      {/* Chart */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'action.hover',
          border: 1,
          borderColor: 'divider'
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="price"
              tickFormatter={formatPrice}
              tick={{ fontSize: 10 }}
            />
            <YAxis hide />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <Paper sx={{ p: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" display="block">
                        Price: {formatPrice(data.price)}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Current Liquidity: ${data.liquidity.toFixed(2)}
                      </Typography>
                      {data.inRange && (
                        <Typography variant="caption" display="block" color="primary">
                          In your range
                        </Typography>
                      )}
                    </Paper>
                  );
                }
                return null;
              }}
            />

            {/* Selected range highlight */}
            <ReferenceArea
              x1={selectedRange.min}
              x2={selectedRange.max}
              fill="#90caf9"
              fillOpacity={0.2}
            />

            {/* Current liquidity bars - smaller and gray */}
            <Bar dataKey="liquidity" fill="#424242" opacity={0.25} barSize={8} />

            {/* Distribution preview bars - bigger and blue with strategy-based heights */}
            <Bar dataKey="positionLiquidity" fill="#1976d2" opacity={0.85} barSize={20} />
          </BarChart>
        </ResponsiveContainer>

        {/* Distribution preview indicators */}
        <Box sx={{ mt: 2, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 16, bgcolor: '#424242', opacity: 0.25, borderRadius: 0.5 }} />
            <Typography variant="caption" color="text.secondary">Existing Pool Liquidity</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 16, bgcolor: '#1976d2', opacity: 0.85, borderRadius: 0.5 }} />
            <Typography variant="caption" color="text.secondary">
              Your Position ({distributionStrategy.toUpperCase()})
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Range Slider */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
          Drag to adjust price range
        </Typography>
        <Slider
          value={[selectedRange.min, selectedRange.max]}
          onChange={handleSliderChange}
          valueLabelDisplay="auto"
          valueLabelFormat={formatPrice}
          min={minPrice}
          max={maxPrice}
          step={(maxPrice - minPrice) / 100}
          sx={{ mt: 2 }}
        />
      </Box>

      {/* Range Info */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: 'action.selected',
          borderRadius: 1
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">Min Price</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
            {formatPrice(selectedRange.min)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">Current Price</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatPrice(currentPrice)}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">Max Price</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
            {formatPrice(selectedRange.max)}
          </Typography>
        </Box>
      </Box>

      {/* Distribution Strategy Info */}
      {!showPositionBins ? (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'warning.light', borderRadius: 1, border: 1, borderColor: 'warning.main' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'warning.dark' }}>
            Enter Token Amounts
          </Typography>
          <Typography variant="caption" display="block" sx={{ color: 'warning.dark', mt: 0.5 }}>
            Enter {tokenXName} and/or {tokenYName} amounts above to preview your position distribution
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.light', borderRadius: 1, border: 1, borderColor: 'info.main' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.dark' }}>
            {distributionStrategy.toUpperCase()} Distribution Preview
            {isTokenYPosition && ` - ${tokenYName} Only (Below Current Price)`}
            {isTokenXPosition && ` - ${tokenXName} Only (Above Current Price)`}
            {isBothTokens && ` - Both Tokens (Full Range)`}
          </Typography>
          <Typography variant="caption" display="block" sx={{ color: 'info.dark', mt: 0.5 }}>
            {distributionStrategy === 'spot' && 'Liquidity evenly distributed across range'}
            {distributionStrategy === 'curve' && 'Liquidity concentrated at center with gradual falloff'}
            {distributionStrategy === 'bid-ask' && 'Liquidity concentrated at range edges'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default BinRangeSelector;
