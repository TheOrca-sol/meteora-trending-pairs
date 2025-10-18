import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  Chip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axios from 'axios';

// Position Row Component with DexScreener data fetching
const PositionRow = ({ position, formatNumber, formatFeeRate, formatLargeNumber, hasValue }) => {
  const [txData, setTxData] = useState(null);
  const [txLoading, setTxLoading] = useState(true);

  useEffect(() => {
    const fetchDexScreenerData = async () => {
      try {
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${position.address}`);
        const dexData = response.data.pairs?.[0];
        if (dexData?.txns?.m5) {
          const total = (dexData.txns.m5.buys || 0) + (dexData.txns.m5.sells || 0);
          setTxData(total);
        }
      } catch (err) {
        console.error('Error fetching DexScreener data:', err);
      } finally {
        setTxLoading(false);
      }
    };

    if (position.address) {
      fetchDexScreenerData();
    }
  }, [position.address]);

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={500}>
          {position.pairName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Bin Step: {position.binStep} • Fee: {position.baseFee}%
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight={500} color={position.estimated_value_usd > 0 ? 'success.main' : 'text.primary'}>
          ${formatNumber(position.estimated_value_usd || 0)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {position.token_x_amount > 0 ? `${formatNumber(position.token_x_amount)} X` : ''}{position.token_y_amount > 0 ? ` + ${formatNumber(position.token_y_amount)} Y` : ''}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Chip
          label={formatFeeRate(position.pool_feeRate30min)}
          color={position.pool_feeRate30min > 0.01 ? 'success' : 'default'}
          size="small"
        />
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">
          ${formatNumber(position.pool_fees30min || 0)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">
          ${formatNumber(position.pool_volume30min || 0)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2">
          ${formatNumber(position.pool_liquidity || 0)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        {txLoading ? (
          <CircularProgress size={16} />
        ) : (
          <Typography variant="body2">
            {txData !== null ? txData : '-'}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right">
        <Chip
          label={position.status || 'Active'}
          color="success"
          size="small"
          variant="outlined"
        />
      </TableCell>
    </TableRow>
  );
};

function PositionsTable({ walletAddress, whitelist, quotePreferences, positions, setPositions }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPositions = async () => {
    if (!walletAddress) return;

    setLoading(true);
    setError(null);

    try {
      const capitalRotationService = (await import('../../services/capitalRotationService')).default;
      const result = await capitalRotationService.fetchPositions(walletAddress, whitelist, quotePreferences);

      if (result.success) {
        setPositions(result.positions);
      } else {
        setError(result.error || 'Failed to fetch positions');
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError('Failed to fetch positions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress && whitelist.length > 0) {
      fetchPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, whitelist, quotePreferences]);

  const formatNumber = (num) => {
    if (!num) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatPercent = (num) => {
    if (!num) return '0.00%';
    return `${num > 0 ? '+' : ''}${formatNumber(num)}%`;
  };

  const formatFeeRate = (num) => {
    if (!num) return '0.0000%';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(num) + '%';
  };

  const formatLargeNumber = (numStr) => {
    if (!numStr || numStr === '0') return '0';
    // If it's a string number, parse and format it
    try {
      // eslint-disable-next-line no-undef
      const num = BigInt(numStr);
      return num.toLocaleString('en-US');
    } catch {
      return numStr;
    }
  };

  const hasValue = (numStr) => {
    if (!numStr) return false;
    try {
      // eslint-disable-next-line no-undef
      return BigInt(numStr) > 0;
    } catch {
      return false;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Your Positions
          </Typography>
        </Box>
        <Button
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchPositions}
          disabled={loading || !walletAddress}
          variant="outlined"
          size="small"
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : positions.length === 0 ? (
        <Alert severity="info">
          No active Meteora positions found for this wallet. Start by adding liquidity to a Meteora pool.
        </Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Pool</TableCell>
                <TableCell align="right">Position Value</TableCell>
                <TableCell align="right">Fee Rate (30min)</TableCell>
                <TableCell align="right">30min Fees</TableCell>
                <TableCell align="right">Volume (30min)</TableCell>
                <TableCell align="right">Liquidity</TableCell>
                <TableCell align="right">5m Txs</TableCell>
                <TableCell align="right">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {positions.map((position, index) => (
                <PositionRow
                  key={index}
                  position={position}
                  formatNumber={formatNumber}
                  formatFeeRate={formatFeeRate}
                  formatLargeNumber={formatLargeNumber}
                  hasValue={hasValue}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {positions.length > 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="caption">
            <strong>Note:</strong> Position values are calculated based on your deposit history (deposits minus withdrawals) multiplied by current token prices from Meteora pools.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}

export default PositionsTable;
