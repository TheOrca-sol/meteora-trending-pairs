import React, { useState, useEffect } from 'react';
import LiquidityChart from './LiquidityChart';
import LiquidityStats from './LiquidityStats';

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <div className="text-gray-400">Loading liquidity distribution...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
        <div className="text-red-400 font-semibold mb-2">Failed to load liquidity data</div>
        <div className="text-red-300 text-sm">{error}</div>
        <div className="text-gray-500 text-xs mt-2">
          Make sure the DLMM microservice is running on port 3001
        </div>
      </div>
    );
  }

  if (!data || !data.bins || data.bins.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
        <div className="text-gray-400">No liquidity data available for this pair</div>
      </div>
    );
  }

  const isAggregated = mintX !== undefined && mintY !== undefined;
  const poolCount = data.stats?.poolCount || data.pools?.length || 1;

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-white mb-1">
          {isAggregated ? 'Aggregated Liquidity Distribution' : 'Liquidity Distribution Analysis'}
        </h3>
        <p className="text-gray-400 text-sm">
          {isAggregated
            ? `Combined data from ${poolCount} pools • ${data.bins.length} price levels`
            : `Visualizing buy/sell walls across ${data.bins.length} price bins`
          }
        </p>
      </div>

      <LiquidityStats stats={data.stats} />

      <div className="mt-6">
        <LiquidityChart
          bins={data.bins}
          activeBinId={data.activeBin}
          currentPrice={data.currentPrice}
        />
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Data fetched from Meteora DLMM on-chain • {isAggregated ? `${poolCount} pools aggregated` : 'Single pool view'}
      </div>
    </div>
  );
};

export default LiquidityDistribution;
