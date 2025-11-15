import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Fade,
  Button,
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletSetup from './WalletSetup';
import MonitoringControls from './MonitoringControls';
import SettingsModal from '../Settings/SettingsModal';

const DegenMode = () => {
  const { publicKey } = useWallet();
  const [activeStep, setActiveStep] = useState(0);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [walletSetup, setWalletSetup] = useState(false);
  const [degenWallet, setDegenWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const steps = ['Connect Telegram', 'Setup Wallet', 'Start Monitoring'];

  useEffect(() => {
    if (publicKey) {
      checkStatus();
    } else {
      setLoading(false);
    }
  }, [publicKey]);

  const checkStatus = async () => {
    if (!publicKey) return;

    try {
      setLoading(true);

      // Check Telegram connection
      const telegramRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/telegram/connection-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: publicKey.toString() }),
      });

      if (telegramRes.ok) {
        const telegramData = await telegramRes.json();
        setTelegramConnected(telegramData.connected);

        if (telegramData.connected) {
          setActiveStep(1);

          // Check degen wallet setup
          const degenRes = await fetch(
            `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/degen/monitoring/status?walletAddress=${publicKey.toString()}`
          );

          if (degenRes.ok) {
            const degenData = await degenRes.json();
            if (degenData.data && degenData.data.wallet_address) {
              setWalletSetup(true);
              setDegenWallet(degenData.data.wallet_address);
              setActiveStep(2);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error checking status:', err);
      setError('Failed to load status. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletSetupComplete = (wallet) => {
    setWalletSetup(true);
    setDegenWallet(wallet);
    setActiveStep(2);
  };

  if (!publicKey) {
    return (
      <Paper
        elevation={3}
        sx={{
          p: 4,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          🚀 Degen Mode
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Connect your wallet to access Degen Mode features.
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading Degen Mode...</Typography>
      </Paper>
    );
  }

  return (
    <Fade in>
      <Box>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            mb: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3,
          }}
        >
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            🚀 Degen Mode
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
            Get instant Telegram alerts for high-fee pools. Monitor all Meteora pools in real-time.
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mt: 3 }}>
            {steps.map((label, index) => (
              <Step key={label} completed={index < activeStep}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': {
                      color: 'rgba(255,255,255,0.7)',
                    },
                    '& .MuiStepLabel-label.Mui-active': {
                      color: 'white',
                      fontWeight: 600,
                    },
                    '& .MuiStepLabel-label.Mui-completed': {
                      color: 'rgba(255,255,255,0.9)',
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 1: Connect Telegram */}
        {!telegramConnected && (
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Step 1: Connect Telegram
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              You need to connect your Telegram account before using Degen Mode. This is required to receive
              real-time notifications.
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Open Settings to connect your Telegram account and get started.
            </Alert>
            <Button
              variant="contained"
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsOpen(true)}
              sx={{
                bgcolor: '#0088cc',
                '&:hover': { bgcolor: '#006699' },
                fontFamily: "'Inter', sans-serif"
              }}
            >
              Open Settings
            </Button>
          </Paper>
        )}

        {/* Step 2: Setup Wallet */}
        {telegramConnected && !walletSetup && (
          <WalletSetup
            walletAddress={publicKey.toString()}
            onComplete={handleWalletSetupComplete}
            onError={setError}
          />
        )}

        {/* Step 3: Monitoring Controls */}
        {walletSetup && degenWallet && (
          <MonitoringControls
            walletAddress={publicKey.toString()}
            degenWallet={degenWallet}
            onError={setError}
          />
        )}

        {/* Settings Modal */}
        <SettingsModal
          open={settingsOpen}
          onClose={() => {
            setSettingsOpen(false);
            // Refresh status after settings are closed
            checkStatus();
          }}
        />
      </Box>
    </Fade>
  );
};

export default DegenMode;
