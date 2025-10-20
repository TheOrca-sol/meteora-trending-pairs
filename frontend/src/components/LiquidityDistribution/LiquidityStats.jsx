import React from 'react';

const StatCard = ({ label, value, subValue }) => (
  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
    <div className="text-gray-400 text-sm mb-1">{label}</div>
    <div className="text-white text-xl font-semibold">{value}</div>
    {subValue && <div className="text-gray-500 text-xs mt-1">{subValue}</div>}
  </div>
);

const LiquidityStats = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const formatUsd = (value) => {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(2)}M`;
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(2)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  };

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Liquidity"
          value={formatUsd(stats.totalLiquidityUsd)}
          subValue={`Across ${stats.totalBins} bins`}
        />

        <StatCard
          label="Current Price"
          value={`$${stats.currentPrice.toFixed(4)}`}
          subValue={`Bin ID: ${stats.activeBinId}`}
        />

        <StatCard
          label="Largest Buy Wall"
          value={formatUsd(stats.largestBuyWall)}
          subValue={`${stats.buyWallsCount} buy bins`}
        />

        <StatCard
          label="Largest Sell Wall"
          value={formatUsd(stats.largestSellWall)}
          subValue={`${stats.sellWallsCount} sell bins`}
        />
      </div>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-400">Buy Support (Below Price)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-gray-400">Active Bin (Current Price)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-400">Sell Resistance (Above Price)</span>
        </div>
      </div>
    </div>
  );
};

export default LiquidityStats;
