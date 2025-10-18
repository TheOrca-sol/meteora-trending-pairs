import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Alert
} from '@mui/material';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet } from '../../contexts/WalletContext';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PublicKey } from '@solana/web3.js';

function WalletManager() {
  const { publicKey, disconnect } = useSolanaWallet();
  const {
    walletMode,
    monitorAddress,
    switchToConnectMode,
    switchToMonitorMode,
    clearMonitorAddress,
  } = useWallet();

  const [addressInput, setAddressInput] = useState('');
  const [addressError, setAddressError] = useState('');

  const handleModeChange = (event, newMode) => {
    if (newMode === null) return;

    if (newMode === 'connect') {
      switchToConnectMode();
      setAddressInput('');
      setAddressError('');
    } else if (newMode === 'monitor') {
      // Disconnect wallet when switching to monitor mode
      if (publicKey) {
        disconnect();
      }
      switchToMonitorMode('');
    }
  };

  const handleMonitorAddress = () => {
    try {
      // Validate Solana address
      new PublicKey(addressInput);
      switchToMonitorMode(addressInput);
      setAddressError('');
    } catch (error) {
      setAddressError('Invalid Solana address');
    }
  };

  const handleClearMonitor = () => {
    clearMonitorAddress();
    setAddressInput('');
    setAddressError('');
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const activeAddress = walletMode === 'monitor' ? monitorAddress : publicKey?.toBase58();

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Wallet Setup
      </Typography>

      {/* Mode Toggle */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Choose how you want to interact:
        </Typography>
        <ToggleButtonGroup
          value={walletMode}
          exclusive
          onChange={handleModeChange}
          aria-label="wallet mode"
          sx={{ mt: 1 }}
        >
          <ToggleButton value="connect" aria-label="connect wallet">
            <AccountBalanceWalletIcon sx={{ mr: 1 }} />
            Connect Wallet
          </ToggleButton>
          <ToggleButton value="monitor" aria-label="monitor address">
            <VisibilityIcon sx={{ mr: 1 }} />
            Monitor Address
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Connect Mode */}
      {walletMode === 'connect' && (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Connect your wallet to view and manage positions:
          </Typography>
          <Box sx={{ mt: 2 }}>
            <WalletMultiButton />
          </Box>
          {publicKey && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Connected: <strong>{truncateAddress(publicKey.toBase58())}</strong>
            </Alert>
          )}
        </Box>
      )}

      {/* Monitor Mode */}
      {walletMode === 'monitor' && (
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Enter a Solana wallet address to monitor (read-only):
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="Wallet Address"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setAddressError('');
              }}
              error={Boolean(addressError)}
              helperText={addressError}
              disabled={Boolean(monitorAddress)}
              placeholder="Enter Solana wallet address"
              size="small"
            />
            {!monitorAddress ? (
              <Button
                variant="contained"
                onClick={handleMonitorAddress}
                disabled={!addressInput}
                sx={{ minWidth: 100 }}
              >
                Monitor
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={handleClearMonitor}
                sx={{ minWidth: 100 }}
              >
                Clear
              </Button>
            )}
          </Box>
          {monitorAddress && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Monitoring: <strong>{truncateAddress(monitorAddress)}</strong>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Read-only mode - you cannot execute rotations
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {/* Active Wallet Status */}
      {activeAddress && (
        <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Active Wallet:
          </Typography>
          <Chip
            label={activeAddress}
            color="primary"
            sx={{ fontFamily: 'monospace' }}
          />
        </Box>
      )}
    </Box>
  );
}

export default WalletManager;
