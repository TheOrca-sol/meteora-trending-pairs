import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Button,
  Divider,
  useTheme
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ErrorOutline as ErrorOutlineIcon,
  Refresh as RefreshIcon,
  ShowChart as ShowChartIcon
} from '@mui/icons-material';
import axios from 'axios';

const TimeframeStats = ({ label, data }) => {
  const theme = useTheme();
  
  if (!data) return null;
  
  const { volume, priceChange, txns } = data;
  const totalTxns = (txns?.buys || 0) + (txns?.sells || 0);
  const buyPercent = totalTxns ? ((txns?.buys || 0) / totalTxns) * 100 : 0;
  const sellPercent = totalTxns ? ((txns?.sells || 0) / totalTxns) * 100 : 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.default'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 2 
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: (priceChange || 0) >= 0 ? 'success.lighter' : 'error.lighter',
            color: (priceChange || 0) >= 0 ? 'success.main' : 'error.main'
          }}
        >
          {(priceChange || 0) >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {(priceChange || 0) >= 0 ? '+' : ''}{(priceChange || 0)?.toFixed(2)}%
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {/* Volume Stats */}
        <Grid item xs={12}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mb: 1
            }}>
              <Typography variant="caption" color="text.secondary">
                Volume
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                ${(volume || 0).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ 
              height: 8,
              borderRadius: 4,
              bgcolor: 'background.paper',
              overflow: 'hidden',
              display: 'flex'
            }}>
              <Box 
                sx={{ 
                  width: `${buyPercent}%`,
                  bgcolor: 'success.main',
                  transition: 'width 0.3s ease'
                }} 
              />
              <Box 
                sx={{ 
                  width: `${sellPercent}%`,
                  bgcolor: 'error.main',
                  transition: 'width 0.3s ease'
                }} 
              />
            </Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              mt: 0.5
            }}>
              <Typography variant="caption" color="success.main">
                Buy {buyPercent.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="error.main">
                Sell {sellPercent.toFixed(1)}%
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Transaction Stats */}
        <Grid item xs={6}>
          <Box sx={{ 
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'success.lighter',
            textAlign: 'center'
          }}>
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mb: 0.5 }}>
              Buy Txns
            </Typography>
            <Typography variant="subtitle2" color="success.main" sx={{ fontWeight: 600 }}>
              {txns?.buys || 0}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ 
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'error.lighter',
            textAlign: 'center'
          }}>
            <Typography variant="caption" color="error.main" sx={{ display: 'block', mb: 0.5 }}>
              Sell Txns
            </Typography>
            <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 600 }}>
              {txns?.sells || 0}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

const MarketStats = ({ pair }) => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair?.address}`);
        const pairData = response.data.pairs?.[0];
        if (!pairData) {
          throw new Error('No pair data found');
        }
        setMarketData(pairData);
      } catch (err) {
        console.error('Error fetching market data:', err);
        setError('Failed to fetch market data');
      } finally {
        setLoading(false);
      }
    };

    if (pair?.address) {
      fetchMarketData();
    }
  }, [pair?.address]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
      <CircularProgress size={24} />
    </Box>
  );
  
  if (error) return (
    <Box sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
      <ErrorOutlineIcon sx={{ mb: 1 }} />
      <Typography>{error}</Typography>
    </Box>
  );

  if (!marketData) return null;

  return (
    <Box>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        mb: 3 
      }}>
        <ShowChartIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Market Activity
        </Typography>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <StatRow 
            label="Last 5 Minutes"
            txns={marketData.txns?.m5}
            volume={marketData.volume?.m5}
            priceChange={marketData.priceChange?.m5}
          />
          
          <StatRow 
            label="Last Hour"
            txns={marketData.txns?.h1}
            volume={marketData.volume?.h1}
            priceChange={marketData.priceChange?.h1}
          />
        </Grid>
        
        <Grid item xs={12} md={6}>
          <StatRow 
            label="Last 6 Hours"
            txns={marketData.txns?.h6}
            volume={marketData.volume?.h6}
            priceChange={marketData.priceChange?.h6}
          />
          
          <StatRow 
            label="Last 24 Hours"
            txns={marketData.txns?.h24}
            volume={marketData.volume?.h24}
            priceChange={marketData.priceChange?.h24}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

const StatRow = ({ label, txns, volume, priceChange }) => {
  if (!txns || !volume) return null;
  
  const total = (txns.buys || 0) + (txns.sells || 0);
  const buyPercent = total ? ((txns.buys || 0) / total) * 100 : 0;
  const sellPercent = total ? ((txns.sells || 0) / total) * 100 : 0;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 1
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography 
          variant="caption"
          sx={{ 
            color: 'white',
            bgcolor: (priceChange || 0) >= 0 ? 'success.main' : 'error.main',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontWeight: 500
          }}
        >
          {(priceChange || 0) >= 0 ? '+' : ''}{(priceChange || 0)?.toFixed(2)}%
        </Typography>
      </Box>
      
      {/* Volume Row */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5 
        }}>
          <Typography variant="caption" color="text.secondary">
            Volume
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            ${(volume || 0).toLocaleString()}
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          height: '24px',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider'
        }}>
          <Box sx={{ 
            width: `${buyPercent}%`,
            bgcolor: 'success.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              ${((volume || 0) * (buyPercent / 100)).toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ 
            width: `${sellPercent}%`,
            bgcolor: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              ${((volume || 0) * (sellPercent / 100)).toLocaleString()}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          mt: 0.5
        }}>
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 500 }}>
            {buyPercent.toFixed(2)}%
          </Typography>
          <Typography variant="caption" color="error.main" sx={{ fontWeight: 500 }}>
            {sellPercent.toFixed(2)}%
          </Typography>
        </Box>
      </Box>

      {/* Transactions Row */}
      <Box>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 0.5 
        }}>
          <Typography variant="caption" color="text.secondary">
            Transactions
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {total}
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          height: '24px',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider'
        }}>
          <Box sx={{ 
            width: `${buyPercent}%`,
            bgcolor: 'success.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {txns.buys || 0}
            </Typography>
          </Box>
          <Box sx={{ 
            width: `${sellPercent}%`,
            bgcolor: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
              {txns.sells || 0}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          mt: 0.5
        }}>
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 500 }}>
            {buyPercent.toFixed(2)}%
          </Typography>
          <Typography variant="caption" color="error.main" sx={{ fontWeight: 500 }}>
            {sellPercent.toFixed(2)}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default MarketStats; 