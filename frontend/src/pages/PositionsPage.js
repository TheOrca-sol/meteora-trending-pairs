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
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  RemoveCircleOutline as WithdrawIcon,
  Close as CloseIcon,
  MonetizationOn as ClaimIcon
} from '@mui/icons-material';
import axios from 'axios';
import { removeLiquidity, closePosition, claimFees } from '../services/meteoraLiquidityService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PositionsPage = () => {
  const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stats, setStats] = useState({
    totalPositions: 0,
    totalLiquidityUSD: 0,
    totalFeesEarned: 0,
    totalPnL: 0,
    totalPnLPercent: 0
  });

  // Dialog states
  const [withdrawDialog, setWithdrawDialog] = useState({ open: false, position: null });
  const [closeDialog, setCloseDialog] = useState({ open: false, position: null });
  const [actionLoading, setActionLoading] = useState(false);

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

        // Calculate total initial liquidity to determine P&L percentage
        const totalInitialLiquidity = positionsData.reduce((sum, p) => {
          const initialX = (p.initial_amount_x || 0) * (p.price_x || 0);
          const initialY = (p.initial_amount_y || 0) * (p.price_y || 0);
          return sum + initialX + initialY;
        }, 0);

        const totalPnLPercent = totalInitialLiquidity > 0
          ? (totalPnL / totalInitialLiquidity * 100)
          : 0;

        setStats({
          totalPositions: positionsData.length,
          totalLiquidityUSD: totalLiquidity,
          totalFeesEarned: totalFees,
          totalPnL: totalPnL,
          totalPnLPercent: totalPnLPercent
        });
      }
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError(err.message || 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawDialog.position) return;

    try {
      setActionLoading(true);
      setError(null);

      const { signature } = await removeLiquidity({
        poolAddress: withdrawDialog.position.pool_address,
        positionAddress: withdrawDialog.position.position_address,
        bps: 10000, // 100% withdraw
        wallet: { signTransaction, signAllTransactions },
        walletPublicKey: publicKey
      });

      setSuccess(`Liquidity withdrawn successfully! Transaction: ${signature}`);
      setWithdrawDialog({ open: false, position: null });

      // Refresh positions
      setTimeout(() => fetchPositions(), 2000);
    } catch (err) {
      console.error('Error withdrawing liquidity:', err);
      setError(err.message || 'Failed to withdraw liquidity');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePosition = async () => {
    if (!closeDialog.position) return;

    try {
      setActionLoading(true);
      setError(null);

      const { signature } = await closePosition({
        poolAddress: closeDialog.position.pool_address,
        positionAddress: closeDialog.position.position_address,
        wallet: { signTransaction, signAllTransactions },
        walletPublicKey: publicKey
      });

      setSuccess(`Position closed successfully! Transaction: ${signature}`);
      setCloseDialog({ open: false, position: null });

      // Refresh positions
      setTimeout(() => fetchPositions(), 2000);
    } catch (err) {
      console.error('Error closing position:', err);
      setError(err.message || 'Failed to close position');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClaimFees = async (position) => {
    try {
      setActionLoading(true);
      setError(null);

      const { signature } = await claimFees({
        poolAddress: position.pool_address,
        positionAddress: position.position_address,
        wallet: { signTransaction, signAllTransactions },
        walletPublicKey: publicKey
      });

      setSuccess(`Fees claimed successfully! Transaction: ${signature}`);

      // Refresh positions
      setTimeout(() => fetchPositions(), 2000);
    } catch (err) {
      console.error('Error claiming fees:', err);
      setError(err.message || 'Failed to claim fees');
    } finally {
      setActionLoading(false);
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
                {stats.totalPnLPercent !== undefined && (
                  <Typography
                    variant="body2"
                    color={stats.totalPnLPercent >= 0 ? 'success.main' : 'error.main'}
                  >
                    ({stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%)
                  </Typography>
                )}
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
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {formatAmount(position.current_amount_x)} {position.token_x_symbol}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Initial: {formatAmount(position.initial_amount_x || 0)}
                        </Typography>
                      </Box>
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {formatAmount(position.current_amount_y)} {position.token_y_symbol}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Initial: {formatAmount(position.initial_amount_y || 0)}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(position.current_liquidity_usd)}
                      </Typography>
                      {position.price_x && position.price_y && (
                        <Typography variant="caption" color="text.secondary">
                          Initial: {formatCurrency(
                            ((position.initial_amount_x || 0) * position.price_x) +
                            ((position.initial_amount_y || 0) * position.price_y)
                          )}
                        </Typography>
                      )}
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
                      {position.unrealized_pnl_percent !== undefined && (
                        <Typography
                          variant="caption"
                          color={position.unrealized_pnl_percent >= 0 ? 'success.main' : 'error.main'}
                        >
                          ({position.unrealized_pnl_percent >= 0 ? '+' : ''}{position.unrealized_pnl_percent.toFixed(2)}%)
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(position.created_at)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Tooltip title="Claim Fees">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleClaimFees(position)}
                            disabled={actionLoading || position.fees_earned_usd === 0}
                          >
                            <ClaimIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Withdraw Liquidity">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setWithdrawDialog({ open: true, position })}
                            disabled={actionLoading}
                          >
                            <WithdrawIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Withdraw & Close Position">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setCloseDialog({ open: true, position })}
                            disabled={actionLoading}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Success/Error Messages */}
        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>

      {/* Withdraw Liquidity Dialog */}
      <Dialog open={withdrawDialog.open} onClose={() => !actionLoading && setWithdrawDialog({ open: false, position: null })}>
        <DialogTitle>Withdraw Liquidity</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to withdraw all liquidity from this position?
            {withdrawDialog.position && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Pool:</strong> {withdrawDialog.position.token_x_symbol} / {withdrawDialog.position.token_y_symbol}
                </Typography>
                <Typography variant="body2">
                  <strong>Position:</strong> {withdrawDialog.position.position_address.slice(0, 8)}...
                </Typography>
                <Typography variant="body2">
                  <strong>Current Value:</strong> {formatCurrency(withdrawDialog.position.current_liquidity_usd)}
                </Typography>
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialog({ open: false, position: null })} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleWithdraw} variant="contained" color="primary" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : 'Withdraw'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Position Dialog */}
      <Dialog open={closeDialog.open} onClose={() => !actionLoading && setCloseDialog({ open: false, position: null })}>
        <DialogTitle>Close Position</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to close this position? This will withdraw all liquidity and close the position account.
            {closeDialog.position && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Pool:</strong> {closeDialog.position.token_x_symbol} / {closeDialog.position.token_y_symbol}
                </Typography>
                <Typography variant="body2">
                  <strong>Position:</strong> {closeDialog.position.position_address.slice(0, 8)}...
                </Typography>
                <Typography variant="body2">
                  <strong>Current Value:</strong> {formatCurrency(closeDialog.position.current_liquidity_usd)}
                </Typography>
                <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                  ⚠️ This action cannot be undone
                </Typography>
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialog({ open: false, position: null })} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={handleClosePosition} variant="contained" color="error" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : 'Close Position'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PositionsPage;
