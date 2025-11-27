import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Tabs,
  Tab,
  IconButton,
  Typography,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  AccountBalanceWallet as WalletIcon,
  Telegram as TelegramIcon,
  Settings as AutomationIcon
} from '@mui/icons-material';
import TelegramConnection from './TelegramConnection';
import AutomationSettings from './AutomationSettings';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const SettingsModal = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const { publicKey, connected } = useWallet();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        zIndex: 1000  // Lower than wallet modal (99999)
      }}
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          pb: 0
        }}
      >
        Settings
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="settings tabs"
          sx={{ px: 3 }}
        >
          <Tab
            icon={<WalletIcon />}
            iconPosition="start"
            label="Wallet"
            sx={{ fontFamily: "'Inter', sans-serif", textTransform: 'none' }}
          />
          <Tab
            icon={<TelegramIcon />}
            iconPosition="start"
            label="Telegram"
            sx={{ fontFamily: "'Inter', sans-serif", textTransform: 'none' }}
          />
          <Tab
            icon={<AutomationIcon />}
            iconPosition="start"
            label="Automation"
            sx={{ fontFamily: "'Inter', sans-serif", textTransform: 'none' }}
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ minHeight: 400 }}>
        {/* Wallet Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <WalletIcon color="primary" />
              <Typography variant="h6" sx={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
                Wallet Connection
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect your Solana wallet to access all features, monitor positions, and execute capital rotation strategies.
            </Typography>

            <Box
              sx={{
                p: 3,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 3
              }}
            >
              {connected ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <WalletIcon sx={{ color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                        Wallet Connected
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                      >
                        {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Features available:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Typography component="li" variant="body2" color="text.secondary">
                      View your liquidity positions
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Access capital rotation opportunities
                    </Typography>
                    <Typography component="li" variant="body2" color="text.secondary">
                      Monitor portfolio performance
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 3 }}>
                    <WalletMultiButton
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255, 255, 255, 0.23)',
                        color: '#f44336',
                        fontFamily: "'Inter', sans-serif"
                      }}
                    />
                  </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2
                    }}
                  >
                    <WalletIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                  </Box>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                    No Wallet Connected
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Connect a Solana wallet to get started
                  </Typography>
                  <WalletMultiButton
                    style={{
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                </Box>
              )}
            </Box>

            <Box
              sx={{
                p: 2,
                bgcolor: 'info.dark',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'info.main'
              }}
            >
              <Typography variant="caption" color="info.light">
                <strong>Note:</strong> Your wallet is never stored on our servers. All transactions require your explicit approval.
              </Typography>
            </Box>
          </Box>
        </TabPanel>

        {/* Telegram Tab */}
        <TabPanel value={tabValue} index={1}>
          <TelegramConnection walletAddress={publicKey?.toBase58()} />
        </TabPanel>

        {/* Automation Tab */}
        <TabPanel value={tabValue} index={2}>
          <AutomationSettings />
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
