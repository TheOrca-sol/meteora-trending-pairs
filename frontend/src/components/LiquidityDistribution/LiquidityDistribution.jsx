import React, { useState, useEffect } from 'react';
import LiquidityChart from './LiquidityChart';
import LiquidityStats from './LiquidityStats';
import LiquidityRangeSuggestion from './LiquidityRangeSuggestion';

const LiquidityDistribution = ({ pairAddress, mintX, mintY }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(0);

  useEffect(() => {
    const fetchLiquidityData = async () => {
      // Prefer aggregated view if both mints available, otherwise single pair
      const endpoint = (mintX && mintY)
        ? `http://localhost:3001/api/aggregated-liquidity?mint_x=${mintX}&mint_y=${mintY}`
        : `http://localhost:3001/api/liquidity-distribution/${pairAddress}`;

      if (!mintX && !mintY && !pairAddress) {
        setError('No pair address or token mints provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch from microservice
        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error(`Failed to fetch liquidity data: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch liquidity data');
        }

        setData(result.data);
      } catch (err) {
        console.error('Error fetching liquidity distribution:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLiquidityData();
  }, [pairAddress, mintX, mintY]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-700 border-t-blue-500"></div>
          <div className="text-sm text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
            Loading liquidity data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-red-400 mb-1">Failed to load liquidity data</div>
            <div className="text-xs text-red-300/70">{error}</div>
            <div className="mt-2 text-xs text-gray-500 bg-gray-800/50 rounded p-2">
              Make sure DLMM service is running: <code className="text-gray-400">cd services/dlmm-service && npm start</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.bins || data.bins.length === 0) {
    return (
      <div className="bg-gray-800/20 border border-gray-700/50 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 bg-gray-700/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-400">No liquidity data available</div>
          <div className="text-xs text-gray-500">This pair doesn't have any liquidity bins yet</div>
        </div>
      </div>
    );
  }

  const isAggregated = mintX !== undefined && mintY !== undefined;
  const poolCount = data.stats?.poolCount || data.pools?.length || 1;

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}>
            {isAggregated ? 'Aggregated Liquidity' : 'Liquidity Distribution'}
          </h2>
          {isAggregated && poolCount > 1 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded border border-blue-500/30">
              {poolCount} Pools
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            {isAggregated
              ? `${data.bins.length} levels across ${poolCount} pool${poolCount > 1 ? 's' : ''}`
              : `${data.bins.length} bins`
            }
          </span>
        </div>
      </div>

      {/* Pool Details Chips - Only for aggregated view */}
      {isAggregated && data.pools && data.pools.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.pools.slice(0, 8).map((pool, idx) => (
            <div key={idx} className="px-2.5 py-1 bg-gray-800/40 rounded text-xs border border-gray-700/50">
              <span className="text-gray-300 font-medium">{pool.pairName}</span>
              <span className="text-gray-600 ml-1.5">•</span>
              <span className="text-gray-500 ml-1.5">Step {pool.binStep}</span>
            </div>
          ))}
          {data.pools.length > 8 && (
            <div className="px-2.5 py-1 bg-gray-800/20 rounded text-xs border border-gray-700/30">
              <span className="text-gray-500">+{data.pools.length - 8} more</span>
            </div>
          )}
        </div>
      )}

      {/* Stats Section */}
      <LiquidityStats stats={data.stats} />

      {/* Chart Section */}
      <div className="mt-4">
        <LiquidityChart
          bins={data.bins}
          activeBinId={data.activeBin}
          currentPrice={data.currentPrice}
          suggestedRange={data.stats?.suggestedRanges?.strategies[selectedStrategy]}
        />
      </div>

      {/* Suggested Ranges Section */}
      {data.stats?.suggestedRanges && (
        <LiquidityRangeSuggestion
          suggestedRanges={data.stats.suggestedRanges}
          currentPrice={data.currentPrice}
          selectedStrategy={selectedStrategy}
          setSelectedStrategy={setSelectedStrategy}
        />
      )}
    </div>
  );
};

export default LiquidityDistribution;
