import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Button,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import TelegramIcon from '@mui/icons-material/Telegram';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import monitoringService from '../../services/monitoringService';

function MonitoringPanel({ walletAddress, whitelist, setWhitelist, quotePreferences, setQuotePreferences, minFees30min, setMinFees30min }) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Telegram connection state
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authCode, setAuthCode] = useState(null);
  const [authBotLink, setAuthBotLink] = useState(null);
  const [authExpires, setAuthExpires] = useState(null);
  const [checkingConnection, setCheckingConnection] = useState(false);

  // Monitoring configuration
  const [config, setConfig] = useState({
    intervalMinutes: 15,
    thresholdMultiplier: 1.3
  });

  // Monitoring status
  const [status, setStatus] = useState({
    active: false,
    next_run: null,
    interval_minutes: null,
    last_check: null
  });

  // Load monitoring status and Telegram connection on mount
  useEffect(() => {
    if (walletAddress) {
      loadStatus();
      checkTelegramConnection();
    }
  }, [walletAddress]);

  // Auto-refresh status every 30 seconds when monitoring is enabled
  useEffect(() => {
    if (!walletAddress || !enabled) return;

    const interval = setInterval(() => {
      loadStatus();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [walletAddress, enabled]);

  // Poll for Telegram connection when auth dialog is open
  useEffect(() => {
    let interval;
    if (authDialogOpen && authCode) {
      interval = setInterval(() => {
        checkTelegramConnection();
      }, 3000); // Check every 3 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [authDialogOpen, authCode, walletAddress]);

  const checkTelegramConnection = async () => {
    if (!walletAddress) return;

    setCheckingConnection(true);
    const result = await monitoringService.checkTelegramConnection(walletAddress);

    if (result.success && result.connected) {
      setTelegramConnected(true);
      setTelegramUsername(result.telegram_username);

      // Close auth dialog if it was open
      if (authDialogOpen) {
        setAuthDialogOpen(false);
        setSuccess('Telegram connected successfully!');
      }
    } else {
      setTelegramConnected(false);
      setTelegramUsername(null);
    }

    setCheckingConnection(false);
  };

  const loadStatus = async () => {
    setStatusLoading(true);
    const result = await monitoringService.getStatus(walletAddress);
    if (result.success) {
      setStatus(result.monitoring);
      setEnabled(result.monitoring.active);
      if (result.monitoring.active && result.monitoring.interval_minutes) {
        setConfig(prev => ({
          ...prev,
          intervalMinutes: result.monitoring.interval_minutes
        }));
      }

      // Sync config to parent if it exists in the response
      if (result.monitoring?.config) {
        const dbConfig = result.monitoring.config;

        // Sync whitelist from database if it exists
        if (dbConfig.whitelist && Array.isArray(dbConfig.whitelist) && dbConfig.whitelist.length > 0) {
          const currentWhitelist = whitelist || [];
          const mergedWhitelist = [...new Set([...currentWhitelist, ...dbConfig.whitelist])];

          if (JSON.stringify(currentWhitelist.sort()) !== JSON.stringify(mergedWhitelist.sort())) {
            console.log('[MonitoringPanel] Syncing whitelist from database:', dbConfig.whitelist);
            if (setWhitelist) {
              setWhitelist(mergedWhitelist);
            }
            localStorage.setItem('tokenWhitelist', JSON.stringify(mergedWhitelist));
          }
        }

        // Sync quote preferences from database if they exist
        if (dbConfig.quote_preferences && setQuotePreferences) {
          setQuotePreferences(dbConfig.quote_preferences);
          localStorage.setItem('quotePreferences', JSON.stringify(dbConfig.quote_preferences));
        }

        // Sync min fees from database if it exists
        if (dbConfig.min_fees_30min && setMinFees30min) {
          const dbMinFees = parseFloat(dbConfig.min_fees_30min);
          setMinFees30min(dbMinFees);
          localStorage.setItem('minFees30min', dbMinFees.toString());
        }
      }
    }
    setStatusLoading(false);
  };

  const handleConnectTelegram = async () => {
    setLoading(true);
    setError(null);

    const result = await monitoringService.generateTelegramCode(walletAddress);

    if (result.success) {
      setAuthCode(result.code);
      setAuthBotLink(result.botLink);
      setAuthExpires(Date.now() + (result.expiresIn * 1000));
      setAuthDialogOpen(true);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleDisconnectTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect Telegram? This will stop all monitoring.')) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await monitoringService.disconnectTelegram(walletAddress);

    if (result.success) {
      setTelegramConnected(false);
      setTelegramUsername(null);
      setEnabled(false);
      setSuccess('Telegram disconnected successfully');
      await loadStatus();
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleToggle = async (event) => {
    const newEnabled = event.target.checked;

    if (!telegramConnected) {
      setError('Please connect Telegram first');
      return;
    }

    if (newEnabled) {
      // Start monitoring
      setLoading(true);
      setError(null);
      setSuccess(null);

      const result = await monitoringService.startMonitoring(walletAddress, {
        ...config,
        whitelist,
        quotePreferences,
        minFees30min
      });

      if (result.success) {
        setEnabled(true);
        setSuccess(result.message);
        await loadStatus();
      } else {
        setError(result.error);
      }

      setLoading(false);
    } else {
      // Stop monitoring
      setLoading(true);
      setError(null);
      setSuccess(null);

      const result = await monitoringService.stopMonitoring(walletAddress);

      if (result.success) {
        setEnabled(false);
        setSuccess(result.message);
        await loadStatus();
      } else {
        setError(result.error);
      }

      setLoading(false);
    }
  };

  const handleConfigChange = (field) => (event) => {
    setConfig(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleThresholdChange = (event, newValue) => {
    setConfig(prev => ({
      ...prev,
      thresholdMultiplier: newValue
    }));
  };

  const formatNextRun = (isoString) => {
    if (!isoString) return 'Not scheduled';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'Running soon...';
    if (diffMins < 60) return `In ${diffMins} minutes`;
    const diffHours = Math.floor(diffMins / 60);
    const remainMins = diffMins % 60;
    return `In ${diffHours}h ${remainMins}m`;
  };

  const formatLastCheck = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours} hours ago`;
  };

  return (
    <>
      <Box sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            bgcolor: 'background.paper',
            cursor: 'pointer'
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {enabled ? (
              <NotificationsActiveIcon color="success" />
            ) : (
              <NotificationsOffIcon color="disabled" />
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Auto-Monitoring {enabled && '(Active)'}
              </Typography>
              {status.active && !statusLoading && (
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={`Next check: ${formatNextRun(status.next_run)}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={`Last check: ${formatLastCheck(status.last_check)}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {telegramConnected && (
              <Chip
                icon={<CheckCircleIcon />}
                label={`@${telegramUsername || 'Connected'}`}
                color="success"
                size="small"
                variant="outlined"
              />
            )}
            {!walletAddress && (
              <Tooltip title="Connect wallet to enable monitoring">
                <InfoIcon color="disabled" />
              </Tooltip>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={handleToggle}
                  disabled={!walletAddress || !telegramConnected || loading || statusLoading}
                  onClick={(e) => e.stopPropagation()}
                />
              }
              label={loading ? <CircularProgress size={20} /> : ''}
              onClick={(e) => e.stopPropagation()}
            />
            <IconButton>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Settings Panel */}
        <Collapse in={expanded}>
          <Box sx={{ p: 3, bgcolor: 'background.default', borderTop: 1, borderColor: 'divider' }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Get Telegram notifications when new opportunities are found. Configure your monitoring preferences below.
            </Typography>

            {/* Telegram Connection Section */}
            <Box sx={{ mb: 4, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TelegramIcon color={telegramConnected ? 'primary' : 'disabled'} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Telegram Connection
                  </Typography>
                </Box>
                {telegramConnected ? (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<LinkOffIcon />}
                    onClick={handleDisconnectTelegram}
                    disabled={loading}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<TelegramIcon />}
                    onClick={handleConnectTelegram}
                    disabled={!walletAddress || loading}
                  >
                    Connect Telegram
                  </Button>
                )}
              </Box>

              {telegramConnected ? (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  Connected as <strong>@{telegramUsername || 'Unknown'}</strong>
                </Alert>
              ) : (
                <Alert severity="info">
                  Connect your Telegram account to receive notifications. You can also manage connections in Settings (⚙️ in navbar).
                </Alert>
              )}
            </Box>

            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              {/* Monitoring Settings */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Monitoring Settings
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Check Interval</InputLabel>
                  <Select
                    value={config.intervalMinutes}
                    onChange={handleConfigChange('intervalMinutes')}
                    disabled={enabled}
                    label="Check Interval"
                  >
                    <MenuItem value={5}>Every 5 minutes</MenuItem>
                    <MenuItem value={15}>Every 15 minutes</MenuItem>
                    <MenuItem value={30}>Every 30 minutes</MenuItem>
                    <MenuItem value={60}>Every 1 hour</MenuItem>
                  </Select>
                </FormControl>

                <Typography variant="body2" sx={{ mb: 1 }}>
                  Notification Threshold: {config.thresholdMultiplier.toFixed(1)}x better
                </Typography>
                <Slider
                  value={config.thresholdMultiplier}
                  onChange={handleThresholdChange}
                  disabled={enabled}
                  min={1.1}
                  max={3.0}
                  step={0.1}
                  marks={[
                    { value: 1.1, label: '1.1x' },
                    { value: 2.0, label: '2.0x' },
                    { value: 3.0, label: '3.0x' }
                  ]}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Only notify when fee rate is at least this much better than your best position
                </Typography>
              </Box>

              {/* Info */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  How It Works
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <strong>1. Connect Telegram</strong> - Link your Telegram account using a one-time code
                  <br /><br />
                  <strong>2. Configure Settings</strong> - Set how often to check and notification thresholds
                  <br /><br />
                  <strong>3. Enable Monitoring</strong> - Turn on the switch to start receiving notifications
                  <br /><br />
                  <strong>4. Get Notified</strong> - Receive Telegram messages about new opportunities!
                </Typography>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* Telegram Auth Dialog */}
      <Dialog open={authDialogOpen} onClose={() => setAuthDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TelegramIcon color="primary" />
            Connect Telegram
          </Box>
        </DialogTitle>
        <DialogContent>
          {checkingConnection ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>
                Waiting for Telegram connection...
              </Typography>
            </Box>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                Your authentication code (valid for 5 minutes):
              </Alert>

              <Box sx={{ textAlign: 'center', my: 3 }}>
                <Typography variant="h3" sx={{ fontWeight: 'bold', letterSpacing: 4, color: 'primary.main' }}>
                  {authCode}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Steps to connect:</strong>
              </Typography>

              <Typography variant="body2" component="div" sx={{ mb: 2 }}>
                1. Click the button below to open the Telegram bot
                <br />
                2. The bot will automatically use your code
                <br />
                3. Wait for confirmation in this dialog
              </Typography>

              <Button
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                startIcon={<TelegramIcon />}
                href={authBotLink}
                target="_blank"
                sx={{ mb: 2 }}
              >
                Open Telegram Bot
              </Button>

              <Alert severity="warning">
                <Typography variant="caption">
                  Or manually start the bot and send: <code>/start {authCode}</code>
                </Typography>
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuthDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default MonitoringPanel;
