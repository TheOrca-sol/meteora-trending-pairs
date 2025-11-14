import React from 'react';

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
    <div className="space-y-3">
      {/* Compact Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        {/* Total Liquidity */}
        <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Total Liquidity</div>
          <div className="text-base font-semibold text-white">{formatUsd(stats.totalLiquidityUsd)}</div>
          <div className="text-xs text-gray-600 mt-0.5">{stats.totalBins || 0} bins</div>
        </div>

        {/* Current Price */}
        <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Current Price</div>
          <div className="text-base font-semibold text-white">{formatPrice(stats.currentPrice)}</div>
          <div className="text-xs text-gray-600 mt-0.5">Live market</div>
        </div>

        {/* Buy Liquidity */}
        <div className="bg-emerald-500/5 rounded-lg p-2.5 border border-emerald-500/20">
          <div className="text-xs text-emerald-400/70 mb-1">Buy Liquidity</div>
          <div className="text-base font-semibold text-emerald-400">{formatUsd(stats.totalBuyLiquidity)}</div>
          <div className="text-xs text-emerald-400/50 mt-0.5">{stats.buyWallsCount || 0} bins</div>
        </div>

        {/* Sell Liquidity */}
        <div className="bg-rose-500/5 rounded-lg p-2.5 border border-rose-500/20">
          <div className="text-xs text-rose-400/70 mb-1">Sell Liquidity</div>
          <div className="text-base font-semibold text-rose-400">{formatUsd(stats.totalSellLiquidity)}</div>
          <div className="text-xs text-rose-400/50 mt-0.5">{stats.sellWallsCount || 0} bins</div>
        </div>

        {/* Buy/Sell Ratio */}
        <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Buy/Sell Ratio</div>
          <div className={`text-base font-semibold ${stats.buySellRatio > 1 ? 'text-emerald-400' : stats.buySellRatio < 1 ? 'text-rose-400' : 'text-gray-400'}`}>
            {stats.buySellRatio ? `${stats.buySellRatio.toFixed(2)}x` : 'N/A'}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {stats.buySellRatio > 1 ? 'Buy side' : stats.buySellRatio < 1 ? 'Sell side' : 'Balanced'}
          </div>
        </div>

        {/* Largest Wall */}
        <div className="bg-gray-800/30 rounded-lg p-2.5 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Largest Wall</div>
          <div className="text-base font-semibold text-white">
            {formatUsd(Math.max(stats.largestBuyWall || 0, stats.largestSellWall || 0))}
          </div>
          <div className="text-xs text-gray-600 mt-0.5">
            {stats.largestBuyWall > stats.largestSellWall ? 'Buy side' : 'Sell side'}
          </div>
        </div>
      </div>

      {/* Compact Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span className="text-gray-400">Buy Support</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span className="text-gray-400">Active Bin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
          <span className="text-gray-400">Sell Resistance</span>
        </div>
      </div>
    </div>
  );
};

export default LiquidityStats;
