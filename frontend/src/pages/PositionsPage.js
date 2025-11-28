import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PositionsPage = () => {
  const { publicKey, connected } = useWallet();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPositions: 0,
    totalLiquidityUSD: 0,
    totalFeesEarned: 0,
    totalPnL: 0
  });

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions();
    }
  }, [connected, publicKey]);

  const fetchPositions = async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/liquidity/positions`, {
        params: {
          walletAddress: publicKey.toString(),
          status: 'active'
        }
      });

      if (response.data.success) {
        const positionsData = response.data.positions;
        setPositions(positionsData);

        // Calculate stats
        const totalLiquidity = positionsData.reduce((sum, p) => sum + (p.current_liquidity_usd || 0), 0);
        const totalFees = positionsData.reduce((sum, p) => sum + (p.fees_earned_usd || 0), 0);
        const totalPnL = positionsData.reduce((sum, p) => sum + (p.unrealized_pnl_usd || 0), 0);

        setStats({
          totalPositions: positionsData.length,
          totalLiquidityUSD: totalLiquidity,
          totalFeesEarned: totalFees,
          totalPnL: totalPnL
        });
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err.message || 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatAmount = (value) => {
    if (value === null || value === undefined) return '0';
    return parseFloat(value).toFixed(6);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  if (!connected) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">
          Please connect your wallet to view your liquidity positions.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            My Liquidity Positions
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchPositions}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceIcon color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Total Positions
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  {stats.totalPositions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AccountBalanceIcon color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Total Liquidity
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold">
                  {formatCurrency(stats.totalLiquidityUSD)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TrendingUpIcon color="success" />
                  <Typography variant="body2" color="text.secondary">
                    Fees Earned
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {formatCurrency(stats.totalFeesEarned)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {stats.totalPnL >= 0 ? (
                    <TrendingUpIcon color="success" />
                  ) : (
                    <TrendingDownIcon color="error" />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Total P&L
                  </Typography>
                </Box>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  color={stats.totalPnL >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(stats.totalPnL)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Positions Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : positions.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No active positions found. Add liquidity to a pool to get started!
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Pool</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="right">Value (USD)</TableCell>
                  <TableCell align="right">Range</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell align="right">Fees Earned</TableCell>
                  <TableCell align="right">P&L</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.position_address} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {position.token_x_symbol} / {position.token_y_symbol}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {position.pool_address.slice(0, 8)}...
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {position.position_address.slice(0, 8)}...{position.position_address.slice(-6)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2">
                        {formatAmount(position.current_amount_x)} {position.token_x_symbol}
                      </Typography>
                      <Typography variant="body2">
                        {formatAmount(position.current_amount_y)} {position.token_y_symbol}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(position.current_liquidity_usd)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="caption" display="block">
                        {position.lower_price.toFixed(6)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        to
                      </Typography>
                      <Typography variant="caption" display="block">
                        {position.upper_price.toFixed(6)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={position.strategy_name || 'Manual'}
                        size="small"
                        color={position.position_type === 'automated' ? 'primary' : 'default'}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        {formatCurrency(position.fees_earned_usd)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={position.unrealized_pnl_usd >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(position.unrealized_pnl_usd)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(position.created_at)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title="View on Solscan">
                        <IconButton
                          size="small"
                          href={`https://solscan.io/account/${position.position_address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Container>
  );
};

export default PositionsPage;
