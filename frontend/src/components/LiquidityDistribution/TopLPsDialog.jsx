import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
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
  IconButton,
  Chip,
  Link,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { BarChart, Bar, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TopLPsDialog = ({ open, onClose, pools }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lpData, setLpData] = useState(null);
  const [selectedPool, setSelectedPool] = useState('');

  // Set first pool as default when dialog opens
  useEffect(() => {
    if (open && pools && pools.length > 0 && !selectedPool) {
      setSelectedPool(pools[0].address);
    }
  }, [open, pools]);

  useEffect(() => {
    if (open && selectedPool) {
      fetchTopLPs(selectedPool);
    }
  }, [open, selectedPool]);

  const fetchTopLPs = async (poolAddr) => {
    setLoading(true);
    setError(null);

    try {
      const dlmmServiceUrl = process.env.REACT_APP_DLMM_SERVICE_URL || 'http://localhost:3001';
      const response = await fetch(`${dlmmServiceUrl}/api/top-lps/${poolAddr}?limit=20`);

      if (!response.ok) {
        throw new Error(`Failed to fetch top LPs: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch top LPs');
      }

      setLpData(result.data);
    } catch (err) {
      console.error('Error fetching top LPs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1_000_000) {
      return `$${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      return `$${(num / 1_000).toFixed(2)}K`;
    } else {
      return `$${num.toFixed(2)}`;
    }
  };

  const shortenAddress = (address) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getSelectedPoolName = () => {
    const pool = pools?.find(p => p.address === selectedPool);
    return pool ? pool.pairName : 'Unknown Pool';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              Top 20 Liquidity Providers
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Pool Selector */}
        {pools && pools.length > 1 && (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Pool</InputLabel>
            <Select
              value={selectedPool}
              label="Select Pool"
              onChange={(e) => setSelectedPool(e.target.value)}
            >
              {pools.map((pool) => (
                <MenuItem key={pool.address} value={pool.address}>
                  {pool.pairName} (Bin Step: {pool.binStep})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {pools && pools.length === 1 && (
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            {getSelectedPoolName()}
          </Typography>
        )}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {lpData && !loading && (
          <>
            {/* Summary Stats */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Chip
                label={`Total Positions: ${lpData.totalPositions}`}
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Total Liquidity: ${formatNumber(lpData.totalPoolLiquidity)}`}
                color="success"
                variant="outlined"
              />
            </Box>

            {/* LP Table */}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Rank</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Address</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Distribution</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Liquidity (USD)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>% of Pool</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lpData.topLPs.map((lp) => (
                    <TableRow
                      key={lp.owner}
                      sx={{
                        '&:hover': { bgcolor: 'action.hover' },
                        ...(lp.rank <= 3 && {
                          bgcolor: lp.rank === 1 ? 'warning.lighter' : 'action.selected'
                        })
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {lp.rank === 1 && '🥇'}
                          {lp.rank === 2 && '🥈'}
                          {lp.rank === 3 && '🥉'}
                          {lp.rank > 3 && `#${lp.rank}`}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`https://solscan.io/account/${lp.owner}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontFamily: 'monospace',
                            fontSize: '0.875rem'
                          }}
                        >
                          {shortenAddress(lp.owner)}
                          <OpenInNewIcon sx={{ fontSize: 14 }} />
                        </Link>
                      </TableCell>
                      <TableCell sx={{ width: 180, p: 1 }}>
                        {lp.bins && lp.bins.length > 0 ? (
                          <ResponsiveContainer width="100%" height={40}>
                            <BarChart data={lp.bins} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                              <Tooltip
                                formatter={(value) => [`$${value.toFixed(2)}`, 'Liquidity']}
                                labelFormatter={(binId) => `Bin #${binId}`}
                                contentStyle={{ fontSize: 11 }}
                              />
                              <Bar dataKey="liquidityUsd">
                                {lp.bins.map((bin, index) => {
                                  const activeBinId = lpData.activeBinId;
                                  let fill;
                                  if (bin.binId === activeBinId) {
                                    fill = '#ffa726'; // Orange for active bin
                                  } else if (bin.binId < activeBinId) {
                                    fill = '#66bb6a'; // Green for buy-side (below current price)
                                  } else {
                                    fill = '#ef5350'; // Red for sell-side (above current price)
                                  }
                                  return <Cell key={`cell-${index}`} fill={fill} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No data
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {formatNumber(lp.liquidityUsd)}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${lp.percentage.toFixed(2)}%`}
                          size="small"
                          color={lp.percentage > 10 ? 'warning' : 'default'}
                          sx={{ minWidth: 65 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Footer Note */}
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="caption">
                💡 Top LPs control the majority of liquidity in this pool. Click on addresses to view them on Solscan.
              </Typography>
            </Alert>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopLPsDialog;
