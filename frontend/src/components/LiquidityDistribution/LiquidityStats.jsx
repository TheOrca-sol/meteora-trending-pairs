import React from 'react';

const StatCard = ({ label, value, subValue, gradient }) => (
  <div className="relative group">
    {/* Background with gradient border effect */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-pink-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

    <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/80 transition-all duration-300">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {subValue && (
          <div className="text-xs text-slate-500 font-medium">{subValue}</div>
        )}
      </div>
    </div>
  </div>
);

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

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Liquidity"
          value={formatUsd(stats.totalLiquidityUsd)}
          subValue={`${stats.totalBins || 0} price bins`}
        />

        <StatCard
          label="Current Price"
          value={formatPrice(stats.currentPrice)}
          subValue={stats.activeBinId ? `Active Bin: ${stats.activeBinId}` : 'Live market price'}
        />

        <StatCard
          label="Buy Side Liquidity"
          value={formatUsd(stats.totalBuyLiquidity)}
          subValue={`${stats.buyWallsCount || 0} bins below price`}
        />

        <StatCard
          label="Sell Side Liquidity"
          value={formatUsd(stats.totalSellLiquidity)}
          subValue={`${stats.sellWallsCount || 0} bins above price`}
        />

        <StatCard
          label="Largest Wall"
          value={formatUsd(Math.max(stats.largestBuyWall || 0, stats.largestSellWall || 0))}
          subValue={stats.largestBuyWall > stats.largestSellWall ? 'Buy side' : 'Sell side'}
        />
      </div>

      {/* Legend */}
      <div className="relative">
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-700/30">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-20"></div>
              </div>
              <span className="text-sm text-slate-300 font-medium">Buy Support</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-20"></div>
              </div>
              <span className="text-sm text-slate-300 font-medium">Active Bin</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                <div className="absolute inset-0 w-3 h-3 bg-rose-500 rounded-full animate-ping opacity-20"></div>
              </div>
              <span className="text-sm text-slate-300 font-medium">Sell Resistance</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiquidityStats;
