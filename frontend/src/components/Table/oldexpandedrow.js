import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper,
  useTheme,
  Link,
  CircularProgress,
  IconButton,
  Tooltip,
  Snackbar,
  Button
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TwitterIcon from '@mui/icons-material/Twitter';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getPairXToken } from '../../utils/helpers';
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
  },
  statValue: {
    variant: "caption",
    fontWeight: 500
  },
  percentage: {
    variant: "caption",
    fontWeight: 500
  },
  statBox: {
    p: 1,
    borderRadius: 1,
    bgcolor: 'action.selected',
    height: '100%'
  }
};

const TimeframeStats = ({ label, txns, volume, priceChange }) => {
  // Add null checks with default values
  const safeVolume = volume ?? 0;
  const safePriceChange = priceChange ?? 0;
  const safeTxns = txns ?? { buys: 0, sells: 0 };

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography {...commonTypographyStyles.sectionTitle}>
        {label}
      </Typography>
      <Grid container spacing={1.5}>
        {/* Transactions */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mb: 1,
            bgcolor: 'action.selected',
            p: 1,
            borderRadius: 1
          }}>
            <Box>
              <Typography {...commonTypographyStyles.label}>Buys</Typography>
              <Typography {...commonTypographyStyles.value} color="success.main">
                {safeTxns.buys}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography {...commonTypographyStyles.label}>Sells</Typography>
              <Typography {...commonTypographyStyles.value} color="error.main">
                {safeTxns.sells}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Volume and Price Change */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            bgcolor: 'action.selected',
            p: 1,
            borderRadius: 1
          }}>
            <Box>
              <Typography {...commonTypographyStyles.label}>Volume</Typography>
              <Typography {...commonTypographyStyles.value}>
                ${Number(safeVolume).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography {...commonTypographyStyles.label}>Price Change</Typography>
              <Typography 
                {...commonTypographyStyles.value}
                color={safePriceChange >= 0 ? 'success.main' : 'error.main'}
              >
                {safePriceChange >= 0 ? '+' : ''}{safePriceChange.toFixed(2)}%
              </Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

const StatRow = ({ label, txns, volume, priceChange }) => {
  // Add null checks
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
        <Typography {...commonTypographyStyles.sectionTitle}>
          {label}
        </Typography>
        <Typography 
          {...commonTypographyStyles.percentage}
          sx={{ 
            color: 'white',
            bgcolor: (priceChange || 0) >= 0 ? 'success.main' : 'error.main',
            px: 1,
            py: 0.25,
            borderRadius: 1,
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
          <Typography {...commonTypographyStyles.label}>
            Volume
          </Typography>
          <Typography {...commonTypographyStyles.value}>
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
            <Typography 
              {...commonTypographyStyles.statValue}
            >
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
            <Typography 
              {...commonTypographyStyles.statValue}
            >
              ${((volume || 0) * (sellPercent / 100)).toLocaleString()}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          mt: 0.5
        }}>
          <Typography {...commonTypographyStyles.percentage} color="success.main">
            {buyPercent.toFixed(2)}%
          </Typography>
          <Typography {...commonTypographyStyles.percentage} color="error.main">
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
          <Typography {...commonTypographyStyles.label}>
            Transactions
          </Typography>
          <Typography {...commonTypographyStyles.value}>
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
            <Typography 
              {...commonTypographyStyles.statValue}
            >
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
            <Typography 
              {...commonTypographyStyles.statValue}
            >
              {txns.sells || 0}
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          mt: 0.5
        }}>
          <Typography {...commonTypographyStyles.percentage} color="success.main">
            {buyPercent.toFixed(2)}%
          </Typography>
          <Typography {...commonTypographyStyles.percentage} color="error.main">
            {sellPercent.toFixed(2)}%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const MarketStats = ({ pairAddress }) => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${pairAddress}`);
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

    if (pairAddress) {
      fetchMarketData();
    }
  }, [pairAddress]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!marketData) return null;

  return (
    <Box>
      <Typography {...commonTypographyStyles.sectionTitle}>
        Market Activity
      </Typography>
      
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

const TokenHolders = ({ tokenAddress }) => {
  const [holders, setHolders] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
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
            timeout: 10000 // 10 second timeout
          }
        );

        if (response.data.error) {
          throw new Error(response.data.error.message || 'Failed to fetch token holders');
        }

        if (!response.data.result?.value) {
          throw new Error('No holder data received');
        }

        setHolders(response.data.result.value);
        setRetryCount(0); // Reset retry count on success
      } catch (err) {
        console.error('Error fetching token holders:', err);
        setError('Failed to fetch token holders');
        
        // Retry logic
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 2000 * (retryCount + 1)); // Exponential backoff
        }
      } finally {
        setLoading(false);
      }
    };

    if (tokenAddress) {
      fetchHolders();
    }
  }, [tokenAddress, retryCount]);

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

  const formatAmount = (amount) => {
    return Number(amount).toLocaleString();
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
      <CircularProgress size={24} />
    </Box>
  );

  if (error) return (
    <Box sx={{ 
      p: 2, 
      textAlign: 'center',
      bgcolor: 'action.selected',
      borderRadius: 1
    }}>
      <Typography color="error" variant="body2" gutterBottom>
        {error}
      </Typography>
      <Button 
        size="small" 
        onClick={handleRetry}
        startIcon={<RefreshIcon />}
      >
        Retry
      </Button>
    </Box>
  );

  if (!holders?.length) return (
    <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
      No holder data available
    </Typography>
  );

  return (
    <Grid item xs={12} sx={{ flex: 1, minHeight: 0 }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 1
        }}>
          <Typography {...commonTypographyStyles.sectionTitle}>
            Top Holders
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            bgcolor: 'action.selected',
            px: 1.5,
            py: 0.5,
            borderRadius: 1
          }}>
            <Typography {...commonTypographyStyles.label}>
              Combined:
            </Typography>
            <Typography 
              {...commonTypographyStyles.value}
            >
              {calculateTop10Percentage()}%
            </Typography>
          </Box>
        </Box>

        <Box sx={{ 
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '3px',
          },
          '& .holder-row': {
            py: 0.75,
            px: 1,
            mb: 0.5
          }
        }}>
          {holders.slice(0, 10).map((holder, index) => (
            <Box 
              key={holder.address}
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 0.75,
                py: 0.75,
                px: 1.5,
                bgcolor: 'action.selected',
                borderRadius: 1,
                '&:hover': {
                  bgcolor: 'action.hover'
                },
                '&:last-child': {
                  mb: 0
                }
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1
              }}>
                <Typography {...commonTypographyStyles.label}>
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
                  <Typography {...commonTypographyStyles.value}>
                    {`${holder.address.slice(0, 4)}...${holder.address.slice(-4)}`}
                  </Typography>
                  <OpenInNewIcon sx={{ fontSize: '1.2rem' }} />
                </Link>
              </Box>
              <Typography 
                {...commonTypographyStyles.value}
              >
                {calculatePercentage(holder.amount).toFixed(2)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Grid>
  );
};

const TokenInformation = ({ tokenAddress }) => {
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`https://lite-api.jup.ag/tokens/v2/search?query=${tokenAddress}`);
        setTokenInfo(response.data?.[0]); // v2 returns an array
      } catch (err) {
        console.error('Error fetching token info:', err);
        setError('Failed to fetch token information');
      } finally {
        setLoading(false);
      }
    };

    if (tokenAddress) {
      fetchTokenInfo();
    }
  }, [tokenAddress]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getTwitterSearchUrl = (address) => {
    return `https://x.com/search?q=${address}&src=typed_query`;
  };

  const formatAddress = (address) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!tokenInfo) return null;

  return (
    <Grid container spacing={2} sx={{ height: '100%' }}>
      {/* Token Header with Address */}
      <Grid item xs={12}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          mb: 2 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {tokenInfo?.logoURI && (
              <img 
                src={tokenInfo.logoURI} 
                alt={tokenInfo.symbol} 
                style={{ width: 28, height: 28, borderRadius: '50%' }}
              />
            )}
            <Box>
              <Typography variant="h6">{tokenInfo?.symbol}</Typography>
              <Typography variant="caption" color="text.secondary">
                {tokenInfo?.name}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            bgcolor: 'action.selected',
            p: 0.5,
            borderRadius: 1,
            height: 'fit-content'
          }}>
            <Typography 
              {...commonTypographyStyles.label}
            >
              {formatAddress(tokenAddress)}
            </Typography>
            <Tooltip title="Copy Address">
              <IconButton 
                size="small" 
                onClick={handleCopyAddress}
                sx={{ color: 'text.secondary' }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="View on Twitter">
              <IconButton 
                size="small"
                component="a"
                href={getTwitterSearchUrl(tokenAddress)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'text.secondary' }}
              >
                <TwitterIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Grid>

      {/* Token Details */}
      <Grid item xs={12} sx={{ 
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }}>
        <Grid container spacing={1.5} sx={{ height: '100%' }}>
          {/* Token Info */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: 'primary.main' }}>
              Token Info
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  height: '100%'
                }}>
                  <Typography {...commonTypographyStyles.label}>Decimals</Typography>
                  <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
                    {tokenInfo?.decimals}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  height: '100%'
                }}>
                  <Typography {...commonTypographyStyles.label}>Created</Typography>
                  <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
                    {formatDate(tokenInfo?.created_at)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Security Info */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: 'primary.main' }}>
              Security Info
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  height: '100%'
                }}>
                  <Typography {...commonTypographyStyles.label}>
                    Mint Authority
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    {!tokenInfo?.mint_authority ? (
                      <CheckCircleIcon color="success" sx={{ fontSize: '1.2rem' }} />
                    ) : (
                      <CancelIcon color="error" sx={{ fontSize: '1.2rem' }} />
                    )}
                    <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
                      {!tokenInfo?.mint_authority ? 'Secure' : 'Risk'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'action.selected',
                  height: '100%'
                }}>
                  <Typography {...commonTypographyStyles.label}>
                    Freeze Authority
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    {!tokenInfo?.freeze_authority ? (
                      <CheckCircleIcon color="success" sx={{ fontSize: '1.2rem' }} />
                    ) : (
                      <CancelIcon color="error" sx={{ fontSize: '1.2rem' }} />
                    )}
                    <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
                      {!tokenInfo?.freeze_authority ? 'Secure' : 'Risk'}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Tags */}
          {tokenInfo?.tags && tokenInfo.tags.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {tokenInfo.tags.map((tag, index) => (
                  <Typography 
                    key={index} 
                    variant="caption" 
                    sx={{ 
                      bgcolor: 'action.selected',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontWeight: 500
                    }}
                  >
                    {tag}
                  </Typography>
                ))}
              </Box>
            </Grid>
          )}

          {/* Token Holders with flex growth */}
          <TokenHolders tokenAddress={tokenAddress} />
        </Grid>
      </Grid>

      {/* Copy Success Snackbar */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        message="Address copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Grid>
  );
};

// Pair Details Component
const PairDetails = ({ pair }) => {
  const getSolscanLink = (address) => `https://solscan.io/address/${address}`;
  
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Typography variant="h6">Pair Details</Typography>
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: pair.is_blacklisted ? 'error.main' : 'success.main',
          px: 1,
          py: 0.5,
          borderRadius: 1,
        }}>
          <Typography 
            variant="caption" 
            sx={{ color: 'white', fontWeight: 500 }}
          >
            {pair.is_blacklisted ? 'Blacklisted' : 'Active'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ 
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.selected',
        }}>
          <Typography {...commonTypographyStyles.label}>Pair Address</Typography>
          <Link
            href={getSolscanLink(pair.address)}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 0.5,
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <Typography {...commonTypographyStyles.value}>
              {`${pair.address.slice(0, 4)}...${pair.address.slice(-4)}`}
            </Typography>
            <OpenInNewIcon sx={{ fontSize: '1.2rem' }} />
          </Link>
        </Box>

        <Grid container spacing={1.5}>
          <Grid item xs={6}>
            <Box sx={{ 
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.selected',
              height: '100%'
            }}>
              <Typography {...commonTypographyStyles.label}>Base Fee</Typography>
              <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
                {pair.baseFee}%
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ 
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.selected',
              height: '100%'
            }}>
              <Typography {...commonTypographyStyles.label}>Bin Step</Typography>
              <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
                {pair.binStep}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

// Performance Metrics Component
const PerformanceMetrics = ({ pair }) => (
  <Paper sx={{ p: 2, height: '100%' }}>
    <Typography variant="h6" gutterBottom>Performance Metrics</Typography>
    <Grid container spacing={1.5}>
      <Grid item xs={6}>
        <Box sx={{ 
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.selected',
          height: '100%'
        }}>
          <Typography {...commonTypographyStyles.label}>30min Volume</Typography>
          <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
            ${Number(pair.volume30min).toLocaleString()}
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ 
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.selected',
          height: '100%'
        }}>
          <Typography {...commonTypographyStyles.label}>30min Fees</Typography>
          <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
            ${Number(pair.fees30min).toLocaleString()}
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ 
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.selected',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Typography {...commonTypographyStyles.label}>24h Fees</Typography>
          <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
            ${Number(pair.fees24h).toLocaleString()}
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={6}>
        <Box sx={{ 
          p: 1.5,
          borderRadius: 1,
          bgcolor: 'action.selected',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Typography {...commonTypographyStyles.label}>APR</Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'baseline',
            gap: 0.5 
          }}>
            <Typography {...commonTypographyStyles.value} sx={{ fontWeight: 500 }}>
              {Number(pair.apr).toLocaleString()}
            </Typography>
            <Typography {...commonTypographyStyles.percentage} color="text.secondary">%</Typography>
          </Box>
        </Box>
      </Grid>
    </Grid>
  </Paper>
);

const RugCheckReport = ({ tokenAddress }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRugCheckReport = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report/summary`
        );
        setReportData(response.data);
      } catch (err) {
        console.error('Error fetching RugCheck report:', err);
        setError('Failed to fetch security report');
      } finally {
        setLoading(false);
      }
    };

    if (tokenAddress) {
      fetchRugCheckReport();
    }
  }, [tokenAddress]);

  const getRiskColor = (level) => {
    switch (level) {
      case 'danger':
        return 'error.main';
      case 'warn':
        return 'warning.main';
      default:
        return 'success.main';
    }
  };

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Typography color="error">{error}</Typography>;
  if (!reportData) return null;

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 2 
      }}>
        <Typography variant="h6">Security Report</Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 1,
          bgcolor: 'action.selected',
          px: 1.5,
          py: 0.5,
          borderRadius: 1
        }}>
          <Typography {...commonTypographyStyles.label}>
            Score:
          </Typography>
          <Typography 
            {...commonTypographyStyles.value}
            sx={{ 
              fontWeight: 500,
              color: reportData.score > 50000 ? 'success.main' : 'error.main'
            }}
          >
            {reportData.score.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5
      }}>
        {reportData.risks.map((risk, index) => (
          <Box 
            key={index}
            sx={{ 
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.selected',
              border: 1,
              borderColor: getRiskColor(risk.level),
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 0.5
            }}>
              <Typography 
                {...commonTypographyStyles.value}
                sx={{ 
                  fontWeight: 500,
                  color: getRiskColor(risk.level)
                }}
              >
                {risk.name}
              </Typography>
              {risk.value && (
                <Typography 
                  {...commonTypographyStyles.value}
                  sx={{ 
                    fontWeight: 500,
                    color: getRiskColor(risk.level)
                  }}
                >
                  {risk.value}
                </Typography>
              )}
            </Box>
            <Typography {...commonTypographyStyles.label} color="text.secondary">
              {risk.description}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

// Main ExpandedRow Component
const ExpandedRow = ({ pair }) => {
  const [activeTab, setActiveTab] = useState('info');
  const theme = useTheme();
  const pairXToken = getPairXToken(pair);

  const TabPanel = ({ value, index, children }) => (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ 
        p: 3,
        height: '100%',
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1
      }}
    >
      {value === index && children}
    </Box>
  );

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={3}>
        {/* Left Column - Token Information */}
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider'
            }}
          >
            <TokenInformation tokenAddress={pairXToken?.address} />
          </Paper>
        </Grid>

        {/* Middle Column - Market Activity */}
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider'
            }}
          >
            <MarketStats pairAddress={pair.address} />
          </Paper>
        </Grid>

        {/* Right Column - Security Report */}
        <Grid item xs={12} md={4}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider'
            }}
          >
            <RugCheckReport tokenAddress={pairXToken?.address} />
          </Paper>
        </Grid>

        {/* Bottom Row - Token Holders */}
        <Grid item xs={12}>
          <Paper 
            elevation={0}
            sx={{ 
              p: 3,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider'
            }}
          >
            <TokenHolders tokenAddress={pairXToken?.address} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ExpandedRow; 