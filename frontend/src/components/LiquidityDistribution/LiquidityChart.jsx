import React from 'react';
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
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LiquidityChart = ({ bins, activeBinId, currentPrice }) => {
  if (!bins || bins.length === 0) {
    return <div className="text-center text-gray-400 py-8">No liquidity data available</div>;
  }

  // Prepare chart data
  // Use binId if available (single pool), otherwise use price (aggregated)
  const usePrice = bins[0]?.binId === undefined;
  const labels = bins.map(bin => bin.binId !== undefined ? bin.binId : bin.price.toFixed(4));
  const liquidityData = bins.map(bin => bin.liquidityUsd);

  // Debug logging
  console.log('LiquidityChart - Current Price:', currentPrice);
  console.log('LiquidityChart - Use Price Mode:', usePrice);
  console.log('LiquidityChart - Bins count:', bins.length);
  console.log('LiquidityChart - Price range:', bins[0]?.price, 'to', bins[bins.length - 1]?.price);

  const backgroundColor = bins.map(bin => {
    const binValue = usePrice ? bin.price : bin.binId;
    const activeValue = usePrice ? currentPrice : activeBinId;

    if (binValue < activeValue) {
      return 'rgba(16, 185, 129, 0.8)'; // Emerald green for buy walls
    } else if (binValue > activeValue) {
      return 'rgba(239, 68, 68, 0.8)'; // Red for sell walls
    } else {
      return 'rgba(59, 130, 246, 1)'; // Bright blue for active bin
    }
  });

  const borderColor = bins.map(bin => {
    const binValue = usePrice ? bin.price : bin.binId;
    const activeValue = usePrice ? currentPrice : activeBinId;

    if (binValue < activeValue) {
      return 'rgb(5, 150, 105)';
    } else if (binValue > activeValue) {
      return 'rgb(220, 38, 38)';
    } else {
      return 'rgb(37, 99, 235)';
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
        color: '#e5e7eb',
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
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
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
            if (bin.binId !== undefined) {
              return `Bin ${label}${bin.isActive ? ' ⚡ Active' : ''}`;
            } else {
              return `Price Level: $${label}`;
            }
          },
          label: (context) => {
            const bin = bins[context.dataIndex];
            const labels = [
              `Price: $${bin.price.toFixed(6)}`,
              `Total Liquidity: $${bin.liquidityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `Token X: ${bin.liquidityX.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
              `Token Y: ${bin.liquidityY.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
            ];

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
    },
    scales: {
      x: {
        title: {
          display: true,
          text: usePrice ? 'Price Level ($)' : 'Bin ID',
          color: '#9ca3af',
          font: {
            size: 12,
            weight: '600',
          },
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 25,
          font: {
            size: 11,
          },
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.15)',
          drawBorder: false,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Liquidity (USD)',
          color: '#9ca3af',
          font: {
            size: 12,
            weight: '600',
          },
        },
        ticks: {
          color: '#9ca3af',
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
          color: 'rgba(75, 85, 99, 0.15)',
          drawBorder: false,
        },
      },
    },
  };

  return (
    <div className="w-full bg-gray-800/30 rounded-lg p-4 border border-gray-700/50" style={{ height: '500px' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default LiquidityChart;
