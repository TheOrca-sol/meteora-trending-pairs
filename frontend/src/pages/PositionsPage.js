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
  DialogContentText,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as AccountBalanceIcon,
  RemoveCircleOutline as WithdrawIcon,
  Close as CloseIcon,
  MonetizationOn as ClaimIcon,
  Add as AddIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import axios from 'axios';
import { removeLiquidity, closePosition, claimFees, addLiquidityToPosition } from '../services/meteoraLiquidityService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PositionsPage = () => {
  const { publicKey, connected, signTransaction, signAllTransactions } = useWallet();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active'); // 'active', 'closed', 'all'
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
  const [addLiquidityDialog, setAddLiquidityDialog] = useState({ open: false, position: null });
  const [addLiquidityAmounts, setAddLiquidityAmounts] = useState({ amountX: '', amountY: '' });
  const [automationDialog, setAutomationDialog] = useState({ open: false, position: null });
  const [automationSettings, setAutomationSettings] = useState({
    takeProfitEnabled: false,
    takeProfitType: 'percentage',
    takeProfitValue: '',
    stopLossEnabled: false,
    stopLossType: 'percentage',
    stopLossValue: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPositions();
    }
  }, [connected, publicKey, statusFilter]);

  const fetchPositions = async () => {
    if (!publicKey) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_URL}/liquidity/positions`, {
        params: {
          walletAddress: publicKey.toString(),
          status: statusFilter
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

  const handleAddLiquidity = async () => {
    if (!addLiquidityDialog.position) return;

    const { amountX, amountY } = addLiquidityAmounts;

    if (!amountX || !amountY || parseFloat(amountX) <= 0 || parseFloat(amountY) <= 0) {
      setError('Please enter valid amounts for both tokens');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const { signature } = await addLiquidityToPosition({
        poolAddress: addLiquidityDialog.position.pool_address,
        positionAddress: addLiquidityDialog.position.position_address,
        amountX: parseFloat(amountX),
        amountY: parseFloat(amountY),
        wallet: { signTransaction, signAllTransactions },
        walletPublicKey: publicKey
      });

      setSuccess(`Liquidity added successfully! Transaction: ${signature}`);
      setAddLiquidityDialog({ open: false, position: null });
      setAddLiquidityAmounts({ amountX: '', amountY: '' });

      // Refresh positions
      setTimeout(() => fetchPositions(), 2000);
    } catch (err) {
      console.error('Error adding liquidity:', err);
      setError(err.message || 'Failed to add liquidity');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveAutomation = async () => {
    if (!automationDialog.position) return;

    try {
      setActionLoading(true);
      setError(null);

      const response = await axios.put(
        `${API_URL}/liquidity/positions/${automationDialog.position.position_address}/automation`,
        {
          takeProfitEnabled: automationSettings.takeProfitEnabled,
          takeProfitType: automationSettings.takeProfitType,
          takeProfitValue: automationSettings.takeProfitValue ? parseFloat(automationSettings.takeProfitValue) : null,
          stopLossEnabled: automationSettings.stopLossEnabled,
          stopLossType: automationSettings.stopLossType,
          stopLossValue: automationSettings.stopLossValue ? parseFloat(automationSettings.stopLossValue) : null
        }
      );

      if (response.data.success) {
        setSuccess('Automation settings saved successfully!');
        setAutomationDialog({ open: false, position: null });

        // Refresh positions
        setTimeout(() => fetchPositions(), 1000);
      }
    } catch (err) {
      console.error('Error saving automation:', err);
      setError(err.response?.data?.error || 'Failed to save automation settings');
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" fontWeight="bold">
            My Liquidity Positions
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(e, newValue) => newValue && setStatusFilter(newValue)}
              size="small"
            >
              <ToggleButton value="active">Active</ToggleButton>
              <ToggleButton value="closed">Closed</ToggleButton>
              <ToggleButton value="all">All</ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchPositions}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>
        </Box>

        {/* Stats Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  borderColor: 'primary.main'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Positions
                  </Typography>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <AccountBalanceIcon sx={{ fontSize: 20, color: 'white' }} />
                  </Box>
                </Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {stats.totalPositions}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Active liquidity pools
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.02) 100%)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  borderColor: 'info.main'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Liquidity
                  </Typography>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'info.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <AccountBalanceIcon sx={{ fontSize: 20, color: 'white' }} />
                  </Box>
                </Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {formatCurrency(stats.totalLiquidityUSD)}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Total value locked
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.02) 100%)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  borderColor: 'success.main'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Fees Earned
                  </Typography>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 20, color: 'white' }} />
                  </Box>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="success.main" sx={{ mb: 0.5 }}>
                  {formatCurrency(stats.totalFeesEarned)}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Accumulated rewards
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                background: stats.totalPnL >= 0
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.02) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  borderColor: stats.totalPnL >= 0 ? 'success.main' : 'error.main'
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total P&L
                  </Typography>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: stats.totalPnL >= 0 ? 'success.main' : 'error.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {stats.totalPnL >= 0 ? (
                      <TrendingUpIcon sx={{ fontSize: 20, color: 'white' }} />
                    ) : (
                      <TrendingDownIcon sx={{ fontSize: 20, color: 'white' }} />
                    )}
                  </Box>
                </Box>
                <Typography
                  variant="h4"
                  fontWeight="bold"
                  color={stats.totalPnL >= 0 ? 'success.main' : 'error.main'}
                  sx={{ mb: 0.5 }}
                >
                  {formatCurrency(stats.totalPnL)}
                </Typography>
                <Typography
                  variant="caption"
                  color={stats.totalPnL >= 0 ? 'success.main' : 'error.main'}
                  fontWeight={600}
                >
                  {stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}% overall
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
              {statusFilter === 'active'
                ? 'No active positions found. Add liquidity to a pool to get started!'
                : statusFilter === 'closed'
                ? 'No closed positions found.'
                : 'No positions found. Add liquidity to a pool to get started!'}
            </Typography>
          </Paper>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              width: '100%'
            }}
          >
            <Table sx={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead sx={{ bgcolor: 'grey.50' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '10%' }}>Pool</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '7%' }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '11%' }}>Current Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '11%' }}>Initial Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '10%' }}>Range</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '8%' }}>Fees</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '8%' }}>P&L</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '8%' }}>Strategy</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '9%' }}>Created</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', width: '26%' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((position) => (
                  <TableRow
                    key={position.position_address}
                    sx={{
                      '&:hover': {
                        bgcolor: 'action.hover'
                      },
                      borderBottom: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    {/* Pool Info */}
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                          {position.token_x_symbol} / {position.token_y_symbol}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                          {position.position_address.slice(0, 6)}...{position.position_address.slice(-4)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Chip
                        label={position.status || 'active'}
                        size="small"
                        color={
                          position.status === 'active' ? 'success' :
                          position.status === 'closed' ? 'default' :
                          'error'
                        }
                        sx={{
                          textTransform: 'capitalize',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 22,
                          '& .MuiChip-label': {
                            px: 1.5
                          }
                        }}
                      />
                    </TableCell>

                    {/* Current Value */}
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                        {formatCurrency(position.current_liquidity_usd)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatAmount(position.current_amount_x)} {position.token_x_symbol}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatAmount(position.current_amount_y)} {position.token_y_symbol}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Initial Value */}
                    <TableCell align="right">
                      {position.price_x && position.price_y ? (
                        <>
                          <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5 }}>
                            {formatCurrency(
                              ((position.initial_amount_x || 0) * position.price_x) +
                              ((position.initial_amount_y || 0) * position.price_y)
                            )}
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatAmount(position.initial_amount_x || 0)} {position.token_x_symbol}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatAmount(position.initial_amount_y || 0)} {position.token_y_symbol}
                            </Typography>
                          </Box>
                        </>
                      ) : (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      )}
                    </TableCell>

                    {/* Price Range */}
                    <TableCell align="right">
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Low: {position.lower_price.toFixed(6)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          High: {position.upper_price.toFixed(6)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Fees Earned */}
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight="bold">
                        {formatCurrency(position.fees_earned_usd)}
                      </Typography>
                    </TableCell>

                    {/* P&L */}
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={position.unrealized_pnl_usd >= 0 ? 'success.main' : 'error.main'}
                        sx={{ mb: 0.5 }}
                      >
                        {formatCurrency(position.unrealized_pnl_usd)}
                      </Typography>
                      {position.unrealized_pnl_percent !== undefined && (
                        <Typography
                          variant="caption"
                          color={position.unrealized_pnl_percent >= 0 ? 'success.main' : 'error.main'}
                          fontWeight={600}
                        >
                          {position.unrealized_pnl_percent >= 0 ? '+' : ''}{position.unrealized_pnl_percent.toFixed(2)}%
                        </Typography>
                      )}
                    </TableCell>

                    {/* Strategy */}
                    <TableCell>
                      <Chip
                        label={position.strategy_name || 'Manual'}
                        size="small"
                        color={position.position_type === 'automated' ? 'primary' : 'default'}
                        variant={position.position_type === 'automated' ? 'filled' : 'outlined'}
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          height: 22,
                          '& .MuiChip-label': {
                            px: 1.5
                          }
                        }}
                      />
                    </TableCell>

                    {/* Created Date */}
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(position.created_at)}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Tooltip title="Automation" arrow>
                          <IconButton
                            size="small"
                            onClick={() => {
                              const rules = position.automation_rules || {};
                              setAutomationSettings({
                                takeProfitEnabled: rules.take_profit_enabled || false,
                                takeProfitType: rules.take_profit_type || 'percentage',
                                takeProfitValue: rules.take_profit_value || '',
                                stopLossEnabled: rules.stop_loss_enabled || false,
                                stopLossType: rules.stop_loss_type || 'percentage',
                                stopLossValue: rules.stop_loss_value || ''
                              });
                              setAutomationDialog({ open: true, position });
                            }}
                            disabled={actionLoading}
                            sx={{
                              bgcolor: 'warning.main',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'warning.dark'
                              },
                              '&:disabled': {
                                bgcolor: 'action.disabledBackground',
                                color: 'action.disabled'
                              },
                              width: 32,
                              height: 32
                            }}
                          >
                            <SettingsIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Add Liquidity" arrow>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setAddLiquidityDialog({ open: true, position });
                              setAddLiquidityAmounts({ amountX: '', amountY: '' });
                            }}
                            disabled={actionLoading}
                            sx={{
                              bgcolor: 'info.main',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'info.dark'
                              },
                              '&:disabled': {
                                bgcolor: 'action.disabledBackground',
                                color: 'action.disabled'
                              },
                              width: 32,
                              height: 32
                            }}
                          >
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Claim Fees" arrow>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleClaimFees(position)}
                              disabled={actionLoading || position.fees_earned_usd === 0}
                              sx={{
                                bgcolor: 'success.main',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'success.dark'
                                },
                                '&:disabled': {
                                  bgcolor: 'action.disabledBackground',
                                  color: 'action.disabled'
                                },
                                width: 32,
                                height: 32
                              }}
                            >
                              <ClaimIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Withdraw" arrow>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => setWithdrawDialog({ open: true, position })}
                              disabled={actionLoading}
                              sx={{
                                bgcolor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'primary.dark'
                                },
                                '&:disabled': {
                                  bgcolor: 'action.disabledBackground',
                                  color: 'action.disabled'
                                },
                                width: 32,
                                height: 32
                              }}
                            >
                              <WithdrawIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Close" arrow>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => setCloseDialog({ open: true, position })}
                              disabled={actionLoading}
                              sx={{
                                bgcolor: 'error.main',
                                color: 'white',
                                '&:hover': {
                                  bgcolor: 'error.dark'
                                },
                                '&:disabled': {
                                  bgcolor: 'action.disabledBackground',
                                  color: 'action.disabled'
                                },
                                width: 32,
                                height: 32
                              }}
                            >
                              <CloseIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="View" arrow>
                          <IconButton
                            size="small"
                            href={`https://solscan.io/account/${position.position_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              bgcolor: 'grey.200',
                              color: 'grey.700',
                              '&:hover': {
                                bgcolor: 'grey.300'
                              },
                              width: 32,
                              height: 32
                            }}
                          >
                            <OpenInNewIcon sx={{ fontSize: 16 }} />
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

      {/* Add Liquidity Dialog */}
      <Dialog
        open={addLiquidityDialog.open}
        onClose={() => !actionLoading && setAddLiquidityDialog({ open: false, position: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Liquidity to Position</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Add more liquidity to this position. The liquidity will be distributed across the same price range.
            {addLiquidityDialog.position && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Pool:</strong> {addLiquidityDialog.position.token_x_symbol} / {addLiquidityDialog.position.token_y_symbol}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Current Value:</strong> {formatCurrency(addLiquidityDialog.position.current_liquidity_usd)}
                </Typography>
                <Typography variant="body2">
                  <strong>Range:</strong> {addLiquidityDialog.position.lower_price.toFixed(6)} - {addLiquidityDialog.position.upper_price.toFixed(6)}
                </Typography>
              </Box>
            )}
          </DialogContentText>
          {addLiquidityDialog.position && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={`Amount ${addLiquidityDialog.position.token_x_symbol}`}
                type="number"
                value={addLiquidityAmounts.amountX}
                onChange={(e) => setAddLiquidityAmounts({ ...addLiquidityAmounts, amountX: e.target.value })}
                fullWidth
                inputProps={{ step: 'any', min: '0' }}
                disabled={actionLoading}
              />
              <TextField
                label={`Amount ${addLiquidityDialog.position.token_y_symbol}`}
                type="number"
                value={addLiquidityAmounts.amountY}
                onChange={(e) => setAddLiquidityAmounts({ ...addLiquidityAmounts, amountY: e.target.value })}
                fullWidth
                inputProps={{ step: 'any', min: '0' }}
                disabled={actionLoading}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddLiquidityDialog({ open: false, position: null });
              setAddLiquidityAmounts({ amountX: '', amountY: '' });
            }}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleAddLiquidity} variant="contained" color="primary" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : 'Add Liquidity'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Automation Settings Dialog */}
      <Dialog
        open={automationDialog.open}
        onClose={() => !actionLoading && setAutomationDialog({ open: false, position: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Configure Position Automation</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Set up automated take profit and stop loss rules for this position.
            {automationDialog.position && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Pool:</strong> {automationDialog.position.token_x_symbol} / {automationDialog.position.token_y_symbol}
                </Typography>
                <Typography variant="body2">
                  <strong>Current Value:</strong> {formatCurrency(automationDialog.position.current_liquidity_usd)}
                </Typography>
              </Box>
            )}
          </DialogContentText>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Take Profit Section */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={automationSettings.takeProfitEnabled}
                    onChange={(e) => setAutomationSettings({ ...automationSettings, takeProfitEnabled: e.target.checked })}
                    disabled={actionLoading}
                  />
                }
                label={<Typography variant="h6">Take Profit</Typography>}
              />
              {automationSettings.takeProfitEnabled && (
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={automationSettings.takeProfitType}
                      label="Type"
                      onChange={(e) => setAutomationSettings({ ...automationSettings, takeProfitType: e.target.value })}
                      disabled={actionLoading}
                    >
                      <MenuItem value="percentage">Percentage (%)</MenuItem>
                      <MenuItem value="usd_amount">USD Amount ($)</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label={automationSettings.takeProfitType === 'percentage' ? 'Profit %' : 'Profit Amount ($)'}
                    type="number"
                    value={automationSettings.takeProfitValue}
                    onChange={(e) => setAutomationSettings({ ...automationSettings, takeProfitValue: e.target.value })}
                    fullWidth
                    inputProps={{ step: 'any', min: '0' }}
                    disabled={actionLoading}
                  />
                </Box>
              )}
            </Box>

            <Divider />

            {/* Stop Loss Section */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={automationSettings.stopLossEnabled}
                    onChange={(e) => setAutomationSettings({ ...automationSettings, stopLossEnabled: e.target.checked })}
                    disabled={actionLoading}
                  />
                }
                label={<Typography variant="h6">Stop Loss</Typography>}
              />
              {automationSettings.stopLossEnabled && (
                <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={automationSettings.stopLossType}
                      label="Type"
                      onChange={(e) => setAutomationSettings({ ...automationSettings, stopLossType: e.target.value })}
                      disabled={actionLoading}
                    >
                      <MenuItem value="percentage">Percentage (%)</MenuItem>
                      <MenuItem value="usd_amount">USD Amount ($)</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label={automationSettings.stopLossType === 'percentage' ? 'Loss %' : 'Loss Amount ($)'}
                    type="number"
                    value={automationSettings.stopLossValue}
                    onChange={(e) => setAutomationSettings({ ...automationSettings, stopLossValue: e.target.value })}
                    fullWidth
                    inputProps={{ step: 'any', min: '0' }}
                    disabled={actionLoading}
                  />
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setAutomationDialog({ open: false, position: null })}
            disabled={actionLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveAutomation} variant="contained" color="primary" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={24} /> : 'Save Settings'}
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
