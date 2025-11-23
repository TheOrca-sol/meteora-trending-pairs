import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  Box,
  Slider,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  TrendingUp,
  AccessTime,
  AccountBalanceWallet,
  Notifications,
} from '@mui/icons-material';

const MonitoringControls = ({ walletAddress, degenWallet, onError }) => {
  const [threshold, setThreshold] = useState(5);
  const [tempThreshold, setTempThreshold] = useState(5);
  const [monitoring, setMonitoring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [walletBalance, setWalletBalance] = useState({ sol: 0, usdc: 0 });
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchWalletBalance();
    const interval = setInterval(() => {
      fetchStatus();
      fetchWalletBalance();
    }, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [walletAddress, degenWallet]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/monitoring/status?walletAddress=${walletAddress}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setMonitoring(data.data.active);
          setThreshold(data.data.threshold || 5);
          setTempThreshold(data.data.threshold || 5);
          setStatus(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchWalletBalance = async () => {
    if (!degenWallet) return;

    try {
      setBalanceLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/wallet/balance?walletAddress=${degenWallet}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setWalletBalance(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleStartMonitoring = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/monitoring/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          threshold: tempThreshold,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMonitoring(true);
        setThreshold(tempThreshold);
        onError('');
        await fetchStatus();
      } else {
        onError(data.message || 'Failed to start monitoring');
      }
    } catch (err) {
      onError('Error starting monitoring. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/monitoring/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();

      if (response.ok) {
        setMonitoring(false);
        onError('');
        await fetchStatus();
      } else {
        onError(data.message || 'Failed to stop monitoring');
      }
    } catch (err) {
      onError('Error stopping monitoring. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateThreshold = async () => {
    if (tempThreshold === threshold) return;

    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          threshold: tempThreshold,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setThreshold(tempThreshold);
        onError('');
        await fetchStatus();
      } else {
        onError(data.message || 'Failed to update threshold');
      }
    } catch (err) {
      onError('Error updating threshold. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loadingStatus) {
    return (
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading monitoring status...</Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Step 3: Monitoring Controls
        </Typography>
        <Chip
          label={monitoring ? 'Active' : 'Inactive'}
          color={monitoring ? 'success' : 'default'}
          icon={monitoring ? <Notifications /> : <Stop />}
        />
      </Box>

      {/* Status Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AccountBalanceWallet fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  Degen Wallet
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {degenWallet ? `${degenWallet.slice(0, 8)}...${degenWallet.slice(-6)}` : 'Not set'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card variant="outlined">
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AccessTime fontSize="small" color="primary" />
                <Typography variant="caption" color="text.secondary">
                  Check Interval
                </Typography>
              </Box>
              <Typography variant="body2">Every 1 minute</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {status && status.last_check && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Last Check
                </Typography>
                <Typography variant="body2">{formatDate(status.last_check)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <AccountBalanceWallet fontSize="small" color="success" />
                  <Typography variant="caption" color="text.secondary">
                    Wallet Balance
                  </Typography>
                </Box>
                {balanceLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <Box display="flex" alignItems="baseline" gap={1.5}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {walletBalance.sol.toFixed(4)} SOL
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.secondary">
                      {walletBalance.usdc.toFixed(2)} USDC
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Threshold Control */}
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Fee Rate Threshold
          </Typography>
          <Chip
            label={`${tempThreshold}%`}
            color="primary"
            size="small"
            icon={<TrendingUp />}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          Get notified when pools have a 30-minute fee rate at or above this threshold.
        </Typography>
        <Slider
          value={tempThreshold}
          onChange={(e, newValue) => setTempThreshold(newValue)}
          min={1}
          max={20}
          step={0.5}
          marks={[
            { value: 1, label: '1%' },
            { value: 5, label: '5%' },
            { value: 10, label: '10%' },
            { value: 15, label: '15%' },
            { value: 20, label: '20%' },
          ]}
          disabled={loading}
          sx={{ mt: 2 }}
        />
        {tempThreshold !== threshold && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleUpdateThreshold}
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Update Threshold'}
          </Button>
        )}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Control Buttons */}
      <Box>
        {!monitoring ? (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Start monitoring to receive Telegram notifications when high-fee pools are found. Checks run every
              minute.
            </Alert>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
              onClick={handleStartMonitoring}
              disabled={loading}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                },
              }}
            >
              {loading ? 'Starting...' : 'Start Monitoring'}
            </Button>
          </>
        ) : (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                🎯 Monitoring Active
              </Typography>
              <Typography variant="body2">
                You'll receive Telegram notifications when pools exceed {threshold}% fee rate. Top 5 pools are
                sent per check.
              </Typography>
            </Alert>
            <Button
              variant="outlined"
              fullWidth
              size="large"
              color="error"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Stop />}
              onClick={handleStopMonitoring}
              disabled={loading}
            >
              {loading ? 'Stopping...' : 'Stop Monitoring'}
            </Button>
          </>
        )}
      </Box>

      <Alert severity="warning" sx={{ mt: 3 }}>
        <Typography variant="body2">
          💡 Tip: Use the Telegram bot commands to check status and adjust threshold on the go. Type /help in
          Telegram.
        </Typography>
      </Alert>
    </Paper>
  );
};

export default MonitoringControls;
