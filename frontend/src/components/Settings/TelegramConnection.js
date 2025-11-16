import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import {
  Telegram as TelegramIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Link as LinkIcon
} from '@mui/icons-material';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TelegramConnection = ({ onConnectionChange, walletAddress }) => {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authCode, setAuthCode] = useState(null);
  const [authBotLink, setAuthBotLink] = useState(null);
  const [authExpires, setAuthExpires] = useState(null);
  const [error, setError] = useState(null);

  // Check Telegram connection status
  const checkTelegramConnection = async () => {
    try {
      const response = await fetch(`${API_URL}/telegram/connection-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });

      const data = await response.json();

      if (data.status === 'success' && data.connected) {
        setTelegramConnected(true);
        setTelegramUsername(data.telegram_username);
        if (onConnectionChange) {
          onConnectionChange({ connected: true, username: data.telegram_username });
        }
      } else {
        setTelegramConnected(false);
        setTelegramUsername(null);
        if (onConnectionChange) {
          onConnectionChange({ connected: false, username: null });
        }
      }
    } catch (err) {
      console.error('Error checking Telegram connection:', err);
    }
  };

  // Initial connection check
  useEffect(() => {
    if (walletAddress) {
      checkTelegramConnection();
    }
  }, [walletAddress]);

  // Poll for connection during auth
  useEffect(() => {
    if (authDialogOpen) {
      const interval = setInterval(checkTelegramConnection, 3000);
      return () => clearInterval(interval);
    }
  }, [authDialogOpen]);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/telegram/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });

      const data = await response.json();

      if (data.code && data.bot_link) {
        setAuthCode(data.code);
        setAuthBotLink(data.bot_link);
        setAuthExpires(new Date(data.expires_at));
        setAuthDialogOpen(true);
      } else {
        setError('Failed to generate authentication code');
      }
    } catch (err) {
      console.error('Error generating Telegram auth code:', err);
      setError(err.message || 'Failed to connect to Telegram');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/telegram/disconnect`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });

      if (response.ok) {
        setTelegramConnected(false);
        setTelegramUsername(null);
        if (onConnectionChange) {
          onConnectionChange({ connected: false, username: null });
        }
      } else {
        setError('Failed to disconnect from Telegram');
      }
    } catch (err) {
      console.error('Error disconnecting from Telegram:', err);
      setError(err.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAuthDialog = () => {
    setAuthDialogOpen(false);
    setAuthCode(null);
    setAuthBotLink(null);
    setAuthExpires(null);
  };

  const copyCode = () => {
    if (authCode) {
      navigator.clipboard.writeText(authCode);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <TelegramIcon sx={{ color: '#0088cc' }} />
        <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
          Telegram Connection
        </Typography>
      </Box>

      {!walletAddress && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please connect your wallet first to manage Telegram notifications.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
        {telegramConnected ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 40 }} />
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                  Connected
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  @{telegramUsername}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You'll receive notifications about:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip label="High-fee pools (Degen Mode)" size="small" color="primary" variant="outlined" />
              <Chip label="Capital rotation opportunities" size="small" color="primary" variant="outlined" />
              <Chip label="Position updates" size="small" color="primary" variant="outlined" />
            </Box>

            <Button
              variant="outlined"
              color="error"
              onClick={handleDisconnect}
              disabled={loading || !walletAddress}
              startIcon={loading ? <CircularProgress size={16} /> : null}
              sx={{ mt: 1 }}
            >
              Disconnect
            </Button>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <ErrorIcon sx={{ color: 'text.secondary', fontSize: 40 }} />
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Not Connected
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Connect Telegram to receive real-time alerts
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Required for:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip label="Degen Mode alerts" size="small" />
              <Chip label="Capital Rotation alerts" size="small" />
            </Box>

            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={loading || !walletAddress}
              startIcon={loading ? <CircularProgress size={16} /> : <TelegramIcon />}
              sx={{
                mt: 1,
                bgcolor: '#0088cc',
                '&:hover': { bgcolor: '#006699' }
              }}
            >
              Connect Telegram
            </Button>
          </Box>
        )}
      </Paper>

      {/* Auth Dialog */}
      <Dialog
        open={authDialogOpen}
        onClose={handleCloseAuthDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
          Connect Telegram
        </DialogTitle>
        <DialogContent>
          {telegramConnected ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Successfully connected! You can close this window.
            </Alert>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Follow these steps to connect your Telegram account:
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Step 1: Open the bot
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<LinkIcon />}
                  href={authBotLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  Open Telegram Bot
                </Button>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Step 2: Send this code to the bot
                </Typography>
                <Paper
                  sx={{
                    p: 2,
                    bgcolor: 'background.default',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      letterSpacing: '0.1em'
                    }}
                  >
                    {authCode}
                  </Typography>
                  <Button size="small" onClick={copyCode}>
                    Copy
                  </Button>
                </Paper>
              </Box>

              {authExpires && (
                <Typography variant="caption" color="text.secondary">
                  Code expires at {authExpires.toLocaleTimeString()}
                </Typography>
              )}

              <Alert severity="info" sx={{ mt: 2 }}>
                Waiting for you to send the code to the bot...
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAuthDialog}>
            {telegramConnected ? 'Done' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TelegramConnection;
