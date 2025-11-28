import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, Slider } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, Cell } from 'recharts';

const BinRangeSelector = ({
  bins = [],
  currentPrice,
  suggestedLowerBound,
  suggestedUpperBound,
  onRangeChange,
  distributionStrategy = 'spot'
}) => {
  const [selectedRange, setSelectedRange] = useState({
    min: suggestedLowerBound || 0,
    max: suggestedUpperBound || 0
  });

  useEffect(() => {
    if (suggestedLowerBound && suggestedUpperBound) {
      setSelectedRange({
        min: suggestedLowerBound,
        max: suggestedUpperBound
      });
    }
  }, [suggestedLowerBound, suggestedUpperBound]);

  useEffect(() => {
    if (onRangeChange) {
      onRangeChange(selectedRange.min, selectedRange.max);
    }
  }, [selectedRange, onRangeChange]);

  // Prepare bin data for chart
  const chartData = bins.slice(0, 50).map((bin, idx) => ({
    price: bin.price,
    liquidity: bin.liquidityUsd || 0,
    index: idx,
    inRange: bin.price >= selectedRange.min && bin.price <= selectedRange.max
  }));

  // Calculate distribution preview based on strategy
  const getDistributionHeight = (index, total) => {
    const rangeStart = chartData.findIndex(b => b.price >= selectedRange.min);
    const rangeEnd = chartData.findIndex(b => b.price > selectedRange.max);
    const rangeSize = rangeEnd - rangeStart;

    if (index < rangeStart || index >= rangeEnd) return 0;

    const positionInRange = index - rangeStart;
    const maxHeight = 100;

    switch (distributionStrategy) {
      case 'spot':
        // All liquidity at center
        const center = Math.floor(rangeSize / 2);
        return Math.abs(positionInRange - center) === 0 ? maxHeight : maxHeight * 0.3;

      case 'curve':
        // Uniform distribution
        return maxHeight * 0.8;

      case 'bid-ask':
        // Concentrated at edges
        const distanceFromEdge = Math.min(
          positionInRange,
          rangeSize - positionInRange - 1
        );
        return maxHeight * (1 - (distanceFromEdge / (rangeSize / 2)) * 0.7);

      default:
        return maxHeight * 0.5;
    }
  };

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
        <ResponsiveContainer width="100%" height={200}>
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

            {/* Current liquidity bars */}
            <Bar dataKey="liquidity" fill="#424242" opacity={0.3} />

            {/* Distribution preview bars */}
            <Bar dataKey="index" fill="#1976d2">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.inRange ? '#1976d2' : 'transparent'}
                  opacity={entry.inRange ? 0.7 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Distribution preview indicators */}
        <Box sx={{ mt: 2, display: 'flex', gap: 4, justifyContent: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#424242', opacity: 0.3, borderRadius: 0.5 }} />
            <Typography variant="caption" color="text.secondary">Current Pool</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 12, height: 12, bgcolor: '#1976d2', opacity: 0.7, borderRadius: 0.5 }} />
            <Typography variant="caption" color="text.secondary">Your Position</Typography>
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
      <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.light', borderRadius: 1, border: 1, borderColor: 'info.main' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.dark' }}>
          {distributionStrategy.toUpperCase()} Distribution Preview
        </Typography>
        <Typography variant="caption" display="block" sx={{ color: 'info.dark', mt: 0.5 }}>
          {distributionStrategy === 'spot' && 'Liquidity concentrated at center price'}
          {distributionStrategy === 'curve' && 'Liquidity evenly distributed across range'}
          {distributionStrategy === 'bid-ask' && 'Liquidity concentrated at range edges'}
        </Typography>
      </Box>
    </Box>
  );
};

export default BinRangeSelector;
