import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

const LiquidityChart = ({ bins, activeBinId, currentPrice, suggestedRange }) => {
  const theme = useTheme();

  if (!bins || bins.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          bgcolor: 'action.hover',
          borderRadius: 2,
          border: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No liquidity data available
        </Typography>
      </Box>
    );
  }

  // Prepare chart data
  const usePrice = bins[0]?.binId === undefined;
  const labels = bins.map(bin => bin.binId !== undefined ? bin.binId : bin.price.toFixed(4));
  const liquidityData = bins.map(bin => bin.liquidityUsd);

  // Helper function to check if a bin is within the suggested range
  const isInSuggestedRange = (bin) => {
    if (!suggestedRange) return false;
    const binPrice = bin.price;
    return binPrice >= suggestedRange.lowerBound && binPrice <= suggestedRange.upperBound;
  };

  // Color palette from theme
  const successColor = theme.palette.success.main;
  const errorColor = theme.palette.error.main;
  const primaryColor = theme.palette.primary.main;

  const backgroundColor = bins.map(bin => {
    const binValue = usePrice ? bin.price : bin.binId;
    const activeValue = usePrice ? currentPrice : activeBinId;

    if (binValue < activeValue) {
      return successColor; // Buy walls
    } else if (binValue > activeValue) {
      return errorColor; // Sell walls
    } else {
      return primaryColor; // Active bin
    }
  });

  const borderColor = bins.map(bin => {
    const binValue = usePrice ? bin.price : bin.binId;
    const activeValue = usePrice ? currentPrice : activeBinId;

    if (binValue < activeValue) {
      return theme.palette.success.dark;
    } else if (binValue > activeValue) {
      return theme.palette.error.dark;
    } else {
      return theme.palette.primary.dark;
    }
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Liquidity (USD)',
        data: liquidityData,
        backgroundColor,
        borderColor,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Liquidity Distribution Across Price Bins',
        color: theme.palette.text.primary,
        font: {
          size: 16,
          weight: '600',
        },
        padding: {
          top: 10,
          bottom: 20
        }
      },
      tooltip: {
        enabled: true,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: theme.palette.text.primary,
        bodyColor: theme.palette.text.secondary,
        borderColor: theme.palette.divider,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: false,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          title: (context) => {
            const label = context[0].label;
            const bin = bins[context[0].dataIndex];
            const inRange = isInSuggestedRange(bin);

            let title = '';
            if (bin.binId !== undefined) {
              title = `Bin ${label}${bin.isActive ? ' ⚡ Active' : ''}`;
            } else {
              title = `Price Level: $${label}`;
            }

            if (inRange) {
              title += ' 🎯 Suggested Range';
            }

            return title;
          },
          label: (context) => {
            const bin = bins[context.dataIndex];
            const inRange = isInSuggestedRange(bin);

            const labels = [
              `Price: $${bin.price.toFixed(6)}`,
              `Total Liquidity: $${bin.liquidityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `Token X: ${bin.liquidityX.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
              `Token Y: ${bin.liquidityY.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
            ];

            if (inRange) {
              labels.push('');
              labels.push('✨ Within suggested liquidity range');
            }

            // If this is aggregated data, show contributing pools
            if (bin.pools && bin.pools.length > 0) {
              labels.push('');
              labels.push(`━━━ Aggregated from ${bin.pools.length} pool(s) ━━━`);
              bin.pools.slice(0, 3).forEach(p => {
                labels.push(`  ▸ ${p.pairName} (Bin Step: ${p.binStep})`);
              });
              if (bin.pools.length > 3) {
                labels.push(`  ⋯ and ${bin.pools.length - 3} more pool(s)`);
              }
            }

            return labels;
          },
        },
      },
      annotation: {
        annotations: suggestedRange ? {
          suggestedRangeBox: {
            type: 'box',
            xMin: bins.findIndex(b => b.price >= suggestedRange.lowerBound),
            xMax: bins.findIndex(b => b.price >= suggestedRange.upperBound) !== -1
              ? bins.findIndex(b => b.price >= suggestedRange.upperBound)
              : bins.length - 1,
            backgroundColor: suggestedRange.side === 'BUY'
              ? 'rgba(46, 160, 67, 0.1)'
              : 'rgba(211, 47, 47, 0.1)',
            borderColor: suggestedRange.side === 'BUY'
              ? theme.palette.success.main
              : theme.palette.error.main,
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: `🎯 Suggested Range (${suggestedRange.name})`,
              position: 'start',
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.warning.main,
              font: {
                size: 11,
                weight: 'bold'
              },
              padding: 6,
              borderRadius: 4
            }
          }
        } : {}
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: usePrice ? 'Price Level ($)' : 'Bin ID',
          color: theme.palette.text.secondary,
          font: {
            size: 12,
            weight: '600',
          },
        },
        ticks: {
          color: theme.palette.text.secondary,
          maxTicksLimit: 25,
          font: {
            size: 11,
          },
        },
        grid: {
          color: theme.palette.divider,
          drawBorder: false,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Liquidity (USD)',
          color: theme.palette.text.secondary,
          font: {
            size: 12,
            weight: '600',
          },
        },
        ticks: {
          color: theme.palette.text.secondary,
          font: {
            size: 11,
          },
          callback: function(value) {
            if (value >= 1_000_000) {
              return '$' + (value / 1_000_000).toFixed(1) + 'M';
            } else if (value >= 1_000) {
              return '$' + (value / 1_000).toFixed(1) + 'K';
            }
            return '$' + value.toLocaleString();
          },
        },
        grid: {
          color: theme.palette.divider,
          drawBorder: false,
        },
      },
    },
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: 500,
        bgcolor: 'action.hover',
        borderRadius: 2,
        p: 2,
        border: 1,
        borderColor: 'divider'
      }}
    >
      <Bar data={data} options={options} />
    </Box>
  );
};

export default LiquidityChart;
