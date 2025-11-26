import React, { useState, useEffect } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Grid,
  IconButton,
  Tooltip,
  Chip,
  Button,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon,
  Check as CheckIcon,
  ErrorOutline as ErrorOutlineIcon,
  Refresh as RefreshIcon,
  SwapHoriz as SwapIcon
} from '@mui/icons-material';
import { useWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';

const TokenInformation = ({ tokenAddress }) => {
  const { wallet } = useWallet(); // Get connected wallet from Solana adapter
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchTokenInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`https://lite-api.jup.ag/tokens/v2/search?query=${tokenAddress}`);
      setTokenInfo(response.data?.[0]); // v2 returns an array
    } catch (err) {
      setError('Failed to load token information');
      console.error('Error fetching token info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const handleSwap = () => {
    // SOL mint address (wrapped SOL)
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    // Open Jupiter in new tab with pre-filled swap
    // Jupiter will auto-detect and connect the user's wallet
    const jupiterUrl = `https://jup.ag/swap/${SOL_MINT}-${tokenAddress}`;
    window.open(jupiterUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: 'error.main' }}>
        <ErrorOutlineIcon sx={{ fontSize: 40, mb: 1 }} />
        <Typography variant="body2" gutterBottom>{error}</Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchTokenInfo}
          size="small"
          sx={{ mt: 1 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (!tokenInfo) return null;

  return (
    <Box>
      {/* Token Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        mb: 2
      }}>
        {tokenInfo?.logoURI && (
          <Avatar
            src={tokenInfo.logoURI}
            alt={tokenInfo.symbol}
            sx={{
              width: 48,
              height: 48,
              border: 1,
              borderColor: 'divider'
            }}
          />
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {tokenInfo?.symbol}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {tokenInfo?.name}
          </Typography>
        </Box>
      </Box>

      {/* Jupiter Swap Button */}
      <Button
        variant="contained"
        fullWidth
        startIcon={<SwapIcon />}
        onClick={handleSwap}
        endIcon={<OpenInNewIcon fontSize="small" />}
        sx={{
          mb: 3,
          bgcolor: 'primary.main',
          '&:hover': {
            bgcolor: 'primary.dark',
            transform: 'translateY(-1px)',
          },
          fontWeight: 600,
          py: 1.5,
          boxShadow: 2,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        Swap on Jupiter
      </Button>

      {/* Token Address */}
      <Box sx={{ 
        mb: 3,
        p: 2,
        bgcolor: 'background.default',
        borderRadius: 2,
        border: 1,
        borderColor: 'divider'
      }}>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Token Address
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 1,
          mt: 0.5
        }}>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'monospace',
              flex: 1
            }}
          >
            {`${tokenAddress.slice(0, 8)}...${tokenAddress.slice(-8)}`}
          </Typography>
          <Tooltip title="Copy Address">
            <IconButton 
              size="small" 
              onClick={handleCopyAddress}
              sx={{ color: copySuccess ? 'success.main' : 'action.active' }}
            >
              {copySuccess ? <CheckIcon /> : <ContentCopyIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="View on Explorer">
            <IconButton 
              size="small"
              component="a"
              href={`https://solscan.io/token/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Token Details */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Box sx={{ 
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            height: '100%'
          }}>
            <Typography variant="caption" color="text.secondary">
              Decimals
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 600 }}>
              {tokenInfo?.decimals || 'N/A'}
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box sx={{ 
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            height: '100%'
          }}>
            <Typography variant="caption" color="text.secondary">
              Created
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 600 }}>
              {tokenInfo?.created_at ? new Date(tokenInfo.created_at).toLocaleDateString() : 'N/A'}
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Tags */}
      {tokenInfo?.tags && tokenInfo.tags.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Tags
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {tokenInfo.tags.map((tag, index) => (
              <Chip 
                key={index}
                label={tag}
                size="small"
                sx={{ 
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  '& .MuiChip-label': {
                    px: 1,
                    fontWeight: 500
                  }
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default TokenInformation; 