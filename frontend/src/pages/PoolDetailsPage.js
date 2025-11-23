import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid
} from '@mui/material';
import ExpandedRow from '../components/Table/ExpandedRow';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PoolDetailsPage = () => {
  const { address } = useParams();
  const [poolData, setPoolData] = useState(null);
  const [timeframes, setTimeframes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPoolData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch pool data from our backend API
        const response = await axios.get(`${API_URL}/pool/${address}`);

        if (response.data.status === 'success') {
          const pool = response.data.data.pool;
          setPoolData(pool);

          // Fetch DexScreener data for Time Period Analysis
          try {
            const dexResponse = await axios.get(
              `https://api.dexscreener.com/latest/dex/pairs/solana/${address}`,
              { timeout: 5000 }
            );

            if (dexResponse.data?.pairs?.[0]) {
              const dexData = dexResponse.data.pairs[0];

              // Build timeframes object from DexScreener data
              const timeframesData = {
                '5m': {
                  txns: dexData?.txns?.m5 || { buys: 0, sells: 0 },
                  volume: dexData?.volume?.m5 || 0,
                  priceChange: dexData?.priceChange?.m5 || 0
                },
                '1h': {
                  txns: dexData?.txns?.h1 || { buys: 0, sells: 0 },
                  volume: dexData?.volume?.h1 || 0,
                  priceChange: dexData?.priceChange?.h1 || 0
                },
                '6h': {
                  txns: dexData?.txns?.h6 || { buys: 0, sells: 0 },
                  volume: dexData?.volume?.h6 || 0,
                  priceChange: dexData?.priceChange?.h6 || 0
                },
                '24h': {
                  txns: dexData?.txns?.h24 || { buys: 0, sells: 0 },
                  volume: dexData?.volume?.h24 || 0,
                  priceChange: dexData?.priceChange?.h24 || 0
                }
              };
              setTimeframes(timeframesData);
            }
          } catch (dexErr) {
            console.warn('Failed to fetch DexScreener data:', dexErr);
            // Continue without timeframes - Time Period Analysis won't show
          }
        } else {
          setError('Failed to load pool data');
        }
      } catch (err) {
        console.error('Error fetching pool data:', err);
        setError(err.response?.data?.message || 'Failed to load pool data');
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchPoolData();
    }
  }, [address]);

  // Calculate transaction stats
  const calculateTxnStats = (txns) => {
    if (!txns) {
      return { total: 0, buyPercent: 0, sellPercent: 0 };
    }

    // Handle DexScreener format: { buys: number, sells: number }
    const buys = txns.buys || 0;
    const sells = txns.sells || 0;
    const total = buys + sells;

    return {
      total,
      buyPercent: total > 0 ? (buys / total) * 100 : 0,
      sellPercent: total > 0 ? (sells / total) * 100 : 0
    };
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!poolData) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="warning">Pool not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Pool Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider'
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 1,
            fontFamily: "'Inter', sans-serif"
          }}
        >
          {poolData.name}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: 'monospace' }}
        >
          {address}
        </Typography>
      </Paper>

      {/* Pool Details - Using ExpandedRow Component */}
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <ExpandedRow
          pair={poolData}
          timeframes={timeframes}
          calculateTxnStats={calculateTxnStats}
        />
      </Paper>
    </Container>
  );
};

export default PoolDetailsPage;
