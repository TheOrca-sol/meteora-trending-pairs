import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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

  const backgroundColor = bins.map(bin => {
    const binValue = usePrice ? bin.price : bin.binId;
    const activeValue = usePrice ? currentPrice : activeBinId;

    if (binValue < activeValue) {
      return 'rgba(34, 197, 94, 0.7)'; // Green for buy walls
    } else if (binValue > activeValue) {
      return 'rgba(239, 68, 68, 0.7)'; // Red for sell walls
    } else {
      return 'rgba(59, 130, 246, 0.9)'; // Blue for active bin
    }
  });

  const borderColor = bins.map(bin => {
    const binValue = usePrice ? bin.price : bin.binId;
    const activeValue = usePrice ? currentPrice : activeBinId;

    if (binValue < activeValue) {
      return 'rgb(34, 197, 94)';
    } else if (binValue > activeValue) {
      return 'rgb(239, 68, 68)';
    } else {
      return 'rgb(59, 130, 246)';
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
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Liquidity Distribution Across Bins',
        color: '#fff',
        font: {
          size: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#444',
        borderWidth: 1,
        callbacks: {
          title: (context) => {
            const label = context[0].label;
            const bin = bins[context[0].dataIndex];
            if (bin.binId !== undefined) {
              return `Bin ${label} ${bin.isActive ? '(Active)' : ''}`;
            } else {
              return `Price Level $${label}`;
            }
          },
          label: (context) => {
            const bin = bins[context.dataIndex];
            const labels = [
              `Price: $${bin.price.toFixed(4)}`,
              `Total Liquidity: $${bin.liquidityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `Token X: ${bin.liquidityX.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
              `Token Y: ${bin.liquidityY.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
            ];

            // If this is aggregated data, show contributing pools
            if (bin.pools && bin.pools.length > 0) {
              labels.push('');
              labels.push(`Pools: ${bin.pools.length}`);
              bin.pools.slice(0, 3).forEach(p => {
                labels.push(`  • ${p.pairName} (${p.binStep})`);
              });
              if (bin.pools.length > 3) {
                labels.push(`  ... and ${bin.pools.length - 3} more`);
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
          text: usePrice ? 'Price Level' : 'Bin ID',
          color: '#9ca3af',
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 20,
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Liquidity (USD)',
          color: '#9ca3af',
        },
        ticks: {
          color: '#9ca3af',
          callback: function(value) {
            return '$' + value.toLocaleString();
          },
        },
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
      },
    },
  };

  return (
    <div style={{ height: '400px', width: '100%' }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default LiquidityChart;
