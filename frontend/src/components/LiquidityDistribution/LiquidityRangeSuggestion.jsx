import React from 'react';

const LiquidityRangeSuggestion = ({ suggestedRanges, currentPrice, selectedStrategy, setSelectedStrategy }) => {

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

  const getSideBg = (side) => {
    return side === 'BUY' ? 'bg-emerald-500/10' : 'bg-rose-500/10';
  };

  const getSideBorder = (side) => {
    return side === 'BUY' ? 'border-emerald-500/30' : 'border-rose-500/30';
  };

  const getSideText = (side) => {
    return side === 'BUY' ? 'text-emerald-400' : 'text-rose-400';
  };

  const copyRange = () => {
    const text = `${formatPrice(strategy.lowerBound)} - ${formatPrice(strategy.upperBound)}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="mt-4 space-y-3" style={{ border: '3px solid lime' }}>
      {/* Modern Header with Strategy Tabs Inline */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-base font-semibold text-white" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}>
            🔥 NEW UI LOADED 🔥 Suggested Ranges
          </h3>
          <span className="text-xs text-gray-500">Position optimization</span>
        </div>

        {/* Modern Tab Pills - Horizontal on all screens */}
        <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
          {strategies.map((strat, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedStrategy(idx)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                selectedStrategy === idx
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {strat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Compact Info Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Price Range */}
        <div className="col-span-2 lg:col-span-2 bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1.5">Price Range</div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-emerald-400">{formatPrice(strategy.lowerBound)}</span>
            <span className="text-gray-600">→</span>
            <span className="text-sm font-semibold text-rose-400">{formatPrice(strategy.upperBound)}</span>
          </div>
          <div className="text-xs text-gray-600">Width: {strategy.rangePercentage}%</div>
        </div>

        {/* Liquidity */}
        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1.5">Liquidity</div>
          <div className="text-sm font-semibold text-white">{formatUsd(strategy.suggestedLiquidityUsd)}</div>
        </div>

        {/* Balance Ratio */}
        <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1.5">Balance</div>
          <div className="text-sm font-semibold text-blue-400">{strategy.expectedRatio.toFixed(2)}x</div>
        </div>

        {/* Imbalance */}
        <div className={`rounded-lg p-3 border ${getSideBorder(currentImbalance.sideWithMore)} ${getSideBg(currentImbalance.sideWithMore)}`}>
          <div className="text-xs text-gray-500 mb-1.5">Imbalance</div>
          <div className={`text-sm font-semibold ${getSideText(currentImbalance.sideWithMore)}`}>
            {currentImbalance.ratio.toFixed(2)}x {currentImbalance.sideWithMore}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-800/20 rounded-lg p-3 border border-gray-700/30">
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-0.5">{strategy.description.split(' - ')[0]}</div>
          <div className="text-xs text-gray-400">
            {selectedStrategy === 0 && "Wide range keeps you in position longer through pumps and dumps."}
            {selectedStrategy === 1 && "Adds 50% of needed liquidity in a moderate 5% range."}
            {selectedStrategy === 2 && "Adjusts width based on imbalance severity, capped at 10%."}
            {selectedStrategy === 3 && "Maximum fees per dollar but requires active rebalancing."}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyRange}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Copy Range
          </button>
          <a
            href="https://app.meteora.ag/pools"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Add Liquidity →
          </a>
        </div>
      </div>
    </div>
  );
};

export default LiquidityRangeSuggestion;
