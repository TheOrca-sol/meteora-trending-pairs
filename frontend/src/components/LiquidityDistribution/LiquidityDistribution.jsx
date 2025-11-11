import React, { useState, useEffect } from 'react';
import LiquidityChart from './LiquidityChart';
import LiquidityStats from './LiquidityStats';
import LiquidityRangeSuggestion from './LiquidityRangeSuggestion';

const LiquidityDistribution = ({ pairAddress, mintX, mintY }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-700 border-t-blue-500"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-ping opacity-20"></div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="text-gray-300 font-medium text-sm">Loading liquidity distribution...</div>
            <div className="text-gray-500 text-xs">Fetching on-chain data from DLMM pools</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-red-900/20 to-red-900/10 border border-red-500/50 rounded-xl p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="space-y-2">
            <div className="text-red-400 font-semibold">Failed to load liquidity data</div>
            <div className="text-red-300/80 text-sm max-w-md mx-auto">{error}</div>
            <div className="text-gray-400 text-xs mt-2 p-2.5 bg-gray-800/50 rounded-lg max-w-md mx-auto">
              💡 Make sure the DLMM microservice is running on port 3001
              <div className="mt-1 font-mono text-gray-500 text-xs">
                cd services/dlmm-service && npm start
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.bins || data.bins.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gray-700/30 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <div className="space-y-1">
            <div className="text-gray-300 font-medium">No liquidity data available</div>
            <div className="text-gray-500 text-sm">This pair doesn't have any liquidity bins yet</div>
          </div>
        </div>
      </div>
    );
  }

  const isAggregated = mintX !== undefined && mintY !== undefined;
  const poolCount = data.stats?.poolCount || data.pools?.length || 1;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl">
      {/* Ambient background effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

      <div className="relative z-10 p-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  {isAggregated ? 'Aggregated Liquidity' : 'Liquidity Distribution'}
                </h3>
                {isAggregated && poolCount > 1 && (
                  <span className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 rounded-full border border-blue-400/30">
                    {poolCount} Pools
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm">
                {isAggregated
                  ? `Real-time liquidity across ${data.bins.length} price levels`
                  : `Live market depth visualization • ${data.bins.length} bins`
                }
              </p>
            </div>
          </div>

          {/* Pool Details for Aggregated View */}
          {isAggregated && data.pools && data.pools.length > 0 && (
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 border border-slate-700/30">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-4">
                Contributing Pools
              </h4>
              <div className="flex flex-wrap gap-2">
                {data.pools.slice(0, 6).map((pool, idx) => (
                  <div key={idx} className="group relative">
                    <div className="px-4 py-2.5 bg-gradient-to-br from-slate-700/50 to-slate-800/50 hover:from-slate-700/70 hover:to-slate-800/70 rounded-lg border border-slate-600/30 hover:border-slate-500/50 transition-all duration-200">
                      <div className="text-sm font-semibold text-slate-200">{pool.pairName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">Step: {pool.binStep}</div>
                    </div>
                  </div>
                ))}
                {data.pools.length > 6 && (
                  <div className="px-4 py-2.5 bg-slate-700/30 rounded-lg border border-slate-600/20 flex items-center">
                    <span className="text-sm text-slate-400">+{data.pools.length - 6} more</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <LiquidityStats stats={data.stats} />

        {/* Chart Section */}
        <div className="mt-8">
          <LiquidityChart
            bins={data.bins}
            activeBinId={data.activeBin}
            currentPrice={data.currentPrice}
          />
        </div>

        {/* Suggested Ranges Section */}
        {data.stats?.suggestedRanges && (
          <LiquidityRangeSuggestion
            suggestedRanges={data.stats.suggestedRanges}
            currentPrice={data.currentPrice}
          />
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-700/30">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span>Live on-chain data</span>
            <span className="text-slate-700">•</span>
            <span>{isAggregated ? `${poolCount} ${poolCount === 1 ? 'pool' : 'pools'} aggregated` : 'Single pool'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiquidityDistribution;
