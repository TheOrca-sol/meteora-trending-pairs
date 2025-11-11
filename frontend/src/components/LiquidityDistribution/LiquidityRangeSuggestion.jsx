import React, { useState } from 'react';

const LiquidityRangeSuggestion = ({ suggestedRanges, currentPrice }) => {
  const [selectedStrategy, setSelectedStrategy] = useState(0);

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
    return side === 'BUY' ? 'emerald' : 'rose';
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
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl mt-8">
      {/* Ambient background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              💡 Suggested Liquidity Ranges
            </h3>
          </div>
          <p className="text-slate-400 text-sm">
            Based on current market imbalance • Choose your strategy
          </p>
        </div>

        {/* Current Imbalance Info */}
        <div className={`${getSideBg(currentImbalance.side)} backdrop-blur-sm rounded-xl p-5 border ${getSideBorder(currentImbalance.side)} mb-6`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Market Imbalance</div>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getSideText(currentImbalance.side)}`}>
                  {currentImbalance.ratio.toFixed(2)}x more {currentImbalance.side} liquidity
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Liquidity Deficit</div>
              <div className="text-xl font-bold text-white">{formatUsd(currentImbalance.deficit)}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <p className="text-sm text-slate-300">
              <span className="font-semibold">Recommendation:</span> Add{' '}
              <span className={getSideText(currentImbalance.side === 'BUY' ? 'BUY' : 'SELL')}>
                {currentImbalance.side} support
              </span>{' '}
              {currentImbalance.side === 'BUY' ? 'below' : 'above'} current price to balance the market
            </p>
          </div>
        </div>

        {/* Strategy Selector */}
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {strategies.map((strat, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedStrategy(idx)}
                className={`relative group p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                  selectedStrategy === idx
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600/80 hover:bg-slate-800/50'
                }`}
              >
                <div className="text-sm font-bold text-white mb-1">{strat.name}</div>
                <div className="text-xs text-slate-400">{strat.description.split(' - ')[0]}</div>
                {selectedStrategy === idx && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Strategy Details */}
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 border border-slate-700/30">
          <div className="space-y-6">
            {/* Strategy Info */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-white">{strategy.name}</h4>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getSideBg(strategy.side)} ${getSideText(strategy.side)} border ${getSideBorder(strategy.side)}`}>
                  {strategy.side} SIDE
                </span>
              </div>
              <p className="text-sm text-slate-300">{strategy.description}</p>
            </div>

            {/* Range Display */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Price Range</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 mb-1">Lower Bound</div>
                    <div className="text-lg font-bold text-emerald-400">{formatPrice(strategy.lowerBound)}</div>
                  </div>
                  <div className="text-slate-600">→</div>
                  <div className="flex-1 text-right">
                    <div className="text-xs text-slate-500 mb-1">Upper Bound</div>
                    <div className="text-lg font-bold text-rose-400">{formatPrice(strategy.upperBound)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700/30">
                  <div className="text-xs text-slate-400">Range Width: <span className="font-bold text-white">{strategy.rangePercentage}%</span></div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Expected Outcome</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Suggested Liquidity</div>
                    <div className="text-lg font-bold text-white">{formatUsd(strategy.suggestedLiquidityUsd)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Target Balance Ratio</div>
                    <div className="text-lg font-bold text-blue-400">{strategy.expectedRatio.toFixed(2)}x</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={copyRange}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-blue-500/50"
              >
                📋 Copy Range to Clipboard
              </button>
              <a
                href="https://app.meteora.ag/pools"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-700/50 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 border border-slate-600/50"
              >
                🚀 Add on Meteora
              </a>
            </div>

            {/* Strategy-specific tips */}
            <div className="bg-slate-900/50 rounded-lg p-4 border border-yellow-500/20">
              <div className="flex items-start gap-3">
                <div className="text-yellow-500 text-xl">💡</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-yellow-400 mb-1">Strategy Tip</div>
                  <div className="text-xs text-slate-300">
                    {selectedStrategy === 0 && "Best for volatile memecoins - wide range means you stay in position longer through pumps and dumps."}
                    {selectedStrategy === 1 && "Balanced approach - adds 50% of needed liquidity in a moderate 5% range around current price."}
                    {selectedStrategy === 2 && "Adaptive range scaling - adjusts width based on imbalance severity, capped at 10%."}
                    {selectedStrategy === 3 && "Tight concentrated range - maximum fees per dollar but requires active rebalancing."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiquidityRangeSuggestion;
