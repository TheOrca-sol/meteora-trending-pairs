import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Link,
  Tooltip,
  IconButton,
  useTheme,
  Grid,
} from '@mui/material';
import {
  Groups as GroupsIcon,
  ErrorOutline as ErrorOutlineIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import axios from 'axios';

const commonTypographyStyles = {
  sectionTitle: {
    variant: "body1",
    color: "primary.main",
    mb: 1,
    fontWeight: 500
  },
  label: {
    variant: "caption",
    color: "text.secondary"
  },
  value: {
    variant: "caption",
    fontWeight: 500
  }
};

const TokenHolders = ({ tokenAddress }) => {
  const [holders, setHolders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [copySuccess, setCopySuccess] = useState({});
  const theme = useTheme();

  const fetchHolders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        'https://mainnet.helius-rpc.com/?api-key=498ead61-0162-4f2b-b6ec-617ae17935d0',
        {
          jsonrpc: '2.0',
          id: 'helius-graphql',
          method: 'getTokenLargestAccounts',
          params: [tokenAddress]
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error.message || 'Failed to fetch token holders');
      }

      setHolders(response.data.result?.value || []);
    } catch (err) {
      console.error('Error fetching holders:', err);
      setError('Failed to load holder information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenAddress) {
      fetchHolders();
    }
  }, [tokenAddress]);

  const handleRetry = () => {
    setRetryCount(0); // Reset retry count and trigger a new fetch
  };

  const calculatePercentage = (amount) => {
    if (!holders) return 0;
    const totalSupply = holders.reduce((sum, holder) => sum + Number(holder.amount), 0);
    return (Number(amount) / totalSupply) * 100;
  };

  const calculateTop10Percentage = () => {
    if (!holders) return 0;
    const top10Total = holders.slice(0, 10).reduce((sum, holder) => sum + Number(holder.amount), 0);
    const totalSupply = holders.reduce((sum, holder) => sum + Number(holder.amount), 0);
    return ((top10Total / totalSupply) * 100).toFixed(2);
  };

  const handleCopyAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopySuccess(prev => ({ ...prev, [address]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [address]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!tokenAddress) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No token address provided
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) return (
    <Box sx={{ p: 3, textAlign: 'center', color: 'error.main' }}>
      <ErrorOutlineIcon sx={{ fontSize: 40, mb: 1 }} />
      <Typography gutterBottom>{error}</Typography>
      <Button
        startIcon={<RefreshIcon />}
        onClick={fetchHolders}
        size="small"
        sx={{ mt: 1 }}
      >
        Retry
      </Button>
    </Box>
  );

  if (!holders) return null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        mb: 3
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupsIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Top Holders
          </Typography>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.default',
          px: 1.5,
          py: 0.5,
          borderRadius: 1
        }}>
          <Typography variant="caption" color="text.secondary">
            Top 10:
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {calculateTop10Percentage()}%
          </Typography>
        </Box>
      </Box>

      {/* Holders List */}
      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}>
        {holders.slice(0, 10).map((holder, index) => (
          <Paper
            key={holder.address}
            elevation={0}
            sx={{ 
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'text.secondary',
                    minWidth: '24px'
                  }}
                >
                  #{index + 1}
                </Typography>
                <Link
                  href={`https://solscan.io/account/${holder.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: 0.5,
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {`${holder.address.slice(0, 4)}...${holder.address.slice(-4)}`}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </Link>
              </Box>
              <Box sx={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 500,
                    color: 'text.primary'
                  }}
                >
                  {calculatePercentage(holder.amount).toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Solscan Link */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Link
          href={`https://solscan.io/token/${tokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            justifyContent: 'center',
            textDecoration: 'none',
            color: 'primary.main',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          <Typography variant="caption">View all holders on Solscan</Typography>
          <OpenInNewIcon sx={{ fontSize: 14 }} />
        </Link>
      </Box>
    </Box>
  );
};

export default TokenHolders; 