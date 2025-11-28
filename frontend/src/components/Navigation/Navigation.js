import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab, useMediaQuery, useTheme, IconButton, Tooltip, Chip, CircularProgress } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SettingsIcon from '@mui/icons-material/Settings';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SettingsModal from '../Settings/SettingsModal';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet } from '../../contexts/WalletContext';

function Navigation() {
  const location = useLocation();
  const currentPath = location.pathname;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Wallet state
  const { publicKey } = useSolanaWallet();
  const { walletMode, monitorAddress } = useWallet();
  const activeAddress = walletMode === 'monitor' ? monitorAddress : publicKey?.toBase58();

  // Check if dev wallet
  const DEV_WALLET = 'DQMwHbduxUEEW4MPJWF6PbLhcPJBiLm5XTie4pwUPbuV';
  const isDevWallet = publicKey?.toBase58() === DEV_WALLET;

  // Wallet balance state
  const [walletBalance, setWalletBalance] = useState({ sol: 0, usdc: 0 });
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Fetch wallet balance
  useEffect(() => {
    const fetchWalletBalance = async () => {
      if (!activeAddress) return;

      try {
        setBalanceLoading(true);
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/wallet/balance?walletAddress=${activeAddress}`
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

    fetchWalletBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchWalletBalance, 30000);
    return () => clearInterval(interval);
  }, [activeAddress]);

  return (
    <>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          mb: { xs: 2, sm: 2.5, md: 3 },
          position: 'relative'
        }}
      >
        <Tabs
          value={currentPath}
          centered={!isMobile}
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              minWidth: { xs: 80, sm: 150, md: 200 },
              fontSize: { xs: '0.75rem', sm: '0.95rem', md: '1rem' },
              fontWeight: 500,
              px: { xs: 0.5, sm: 2, md: 3 },
              py: { xs: 1.5, sm: 2 }
            }
          }}
        >
          <Tab
            label={isMobile ? "Analytics" : "Analytics"}
            value="/"
            component={Link}
            to="/"
            icon={<ShowChartIcon fontSize="small" />}
            iconPosition={isMobile ? "top" : "start"}
            sx={{
              '& .MuiTab-iconWrapper': {
                mb: { xs: 0.5, sm: 0 },
                mr: { xs: 0, sm: 1 }
              }
            }}
          />
          <Tab
            label={isMobile ? "Capital" : "Capital Rotation"}
            value="/capital-rotation"
            component={Link}
            to="/capital-rotation"
            icon={<AccountBalanceWalletIcon fontSize="small" />}
            iconPosition={isMobile ? "top" : "start"}
            sx={{
              '& .MuiTab-iconWrapper': {
                mb: { xs: 0.5, sm: 0 },
                mr: { xs: 0, sm: 1 }
              }
            }}
          />
          <Tab
            label={isMobile ? "Positions" : "My Positions"}
            value="/positions"
            component={Link}
            to="/positions"
            icon={<AccountBalanceIcon fontSize="small" />}
            iconPosition={isMobile ? "top" : "start"}
            sx={{
              '& .MuiTab-iconWrapper': {
                mb: { xs: 0.5, sm: 0 },
                mr: { xs: 0, sm: 1 }
              }
            }}
          />
          {isDevWallet && (
            <Tab
              label={isMobile ? "Admin" : "Backoffice"}
              value="/backoffice"
              component={Link}
              to="/backoffice"
              icon={<AdminPanelSettingsIcon fontSize="small" />}
              iconPosition={isMobile ? "top" : "start"}
              sx={{
                '& .MuiTab-iconWrapper': {
                  mb: { xs: 0.5, sm: 0 },
                  mr: { xs: 0, sm: 1 }
                }
              }}
            />
          )}
        </Tabs>

        {/* Wallet Balance & Settings Button */}
        <Box
          sx={{
            position: 'absolute',
            right: { xs: 8, sm: 16 },
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          {/* Wallet Balance Chips */}
          {activeAddress && !isMobile && (
            <>
              {balanceLoading ? (
                <Chip
                  icon={<CircularProgress size={16} />}
                  label="Loading..."
                  size="small"
                  variant="outlined"
                />
              ) : (
                <>
                  <Chip
                    icon={<AccountBalanceWalletIcon />}
                    label={`${walletBalance.sol.toFixed(4)} SOL`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    label={`${walletBalance.usdc.toFixed(2)} USDC`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </>
              )}
            </>
          )}

          <Tooltip title="Settings">
            <IconButton
              onClick={() => setSettingsOpen(true)}
              size={isMobile ? "small" : "medium"}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: 'action.hover'
                }
              }}
            >
              <SettingsIcon fontSize={isMobile ? "small" : "medium"} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

export default Navigation;
