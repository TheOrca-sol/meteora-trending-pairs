import React, { useState } from 'react';
import { Container, Box, Typography, Paper, Grid, Divider } from '@mui/material';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { useWallet } from '../contexts/WalletContext';
import WalletManager from '../components/CapitalRotation/WalletManager';
import WhitelistManager from '../components/CapitalRotation/WhitelistManager';
import PreferencesPanel from '../components/CapitalRotation/PreferencesPanel';
import MonitoringPanel from '../components/CapitalRotation/MonitoringPanel';
import PositionsTable from '../components/CapitalRotation/PositionsTable';
import OpportunitiesTable from '../components/CapitalRotation/OpportunitiesTable';

function CapitalRotationPage() {
  const { publicKey } = useSolanaWallet();
  const { walletMode, monitorAddress } = useWallet();

  // Determine active wallet address
  const activeAddress = walletMode === 'monitor' ? monitorAddress : publicKey?.toBase58();
  const hasActiveWallet = Boolean(activeAddress);

  // State for whitelist and preferences
  const [whitelist, setWhitelist] = useState(() => {
    const saved = localStorage.getItem('tokenWhitelist');
    return saved ? JSON.parse(saved) : [];
  });

  const [quotePreferences, setQuotePreferences] = useState(() => {
    const saved = localStorage.getItem('quotePreferences');
    return saved ? JSON.parse(saved) : { sol: true, usdc: true };
  });

  const [positions, setPositions] = useState([]);
  const [opportunities, setOpportunities] = useState([]);

  const [minFees30min, setMinFees30min] = useState(() => {
    const saved = localStorage.getItem('minFees30min');
    return saved ? Number(saved) : 100;
  });

  return (
    <Container
      maxWidth={false}
      sx={{
        mt: { xs: 2, md: 4 },
        mb: 4,
        flex: 1,
        px: { xs: 1, sm: 2, md: 3 },
        maxWidth: '2000px !important',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mb: 4,
          gap: 2,
          borderBottom: 1,
          borderColor: 'divider',
          pb: 3
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: theme => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Capital Rotation
        </Typography>
      </Box>

      {/* Wallet Manager Section */}
      <Paper
        elevation={2}
        sx={{
          mb: 4,
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          bgcolor: 'background.paper',
        }}
      >
        <WalletManager />
      </Paper>

      {/* Main Content - Only show if wallet is connected or monitoring */}
      {hasActiveWallet && (
        <>
          {/* Configuration Section */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={2}
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: 2,
                  height: '100%',
                }}
              >
                <WhitelistManager
                  whitelist={whitelist}
                  setWhitelist={setWhitelist}
                />
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper
                elevation={2}
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: 2,
                  height: '100%',
                }}
              >
                <PreferencesPanel
                  quotePreferences={quotePreferences}
                  setQuotePreferences={setQuotePreferences}
                />
              </Paper>
            </Grid>
          </Grid>

          {/* Auto-Monitoring Section */}
          <Box sx={{ mb: 4 }}>
            <MonitoringPanel
              walletAddress={activeAddress}
              whitelist={whitelist}
              quotePreferences={quotePreferences}
              minFees30min={minFees30min}
            />
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Positions Section */}
          <Paper
            elevation={2}
            sx={{
              mb: 4,
              p: { xs: 2, md: 3 },
              borderRadius: 2,
            }}
          >
            <PositionsTable
              walletAddress={activeAddress}
              whitelist={whitelist}
              quotePreferences={quotePreferences}
              positions={positions}
              setPositions={setPositions}
            />
          </Paper>

          {/* Opportunities Section */}
          <Paper
            elevation={2}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 2,
            }}
          >
            <OpportunitiesTable
              walletAddress={activeAddress}
              whitelist={whitelist}
              quotePreferences={quotePreferences}
              positions={positions}
              opportunities={opportunities}
              setOpportunities={setOpportunities}
              minFees30min={minFees30min}
              setMinFees30min={setMinFees30min}
            />
          </Paper>
        </>
      )}
    </Container>
  );
}

export default CapitalRotationPage;
