import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import StarIcon from '@mui/icons-material/Star';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

function OpportunitiesTable({
  walletAddress,
  whitelist,
  quotePreferences,
  positions,
  opportunities,
  setOpportunities
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOpportunities = async () => {
    if (!walletAddress || whitelist.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const capitalRotationService = (await import('../../services/capitalRotationService')).default;
      const result = await capitalRotationService.analyzeOpportunities(
        walletAddress,
        whitelist,
        quotePreferences,
        positions
      );

      if (result.success) {
        setOpportunities(result.opportunities);
      } else {
        setError(result.error || 'Failed to analyze opportunities');
      }
    } catch (err) {
      console.error('Error fetching opportunities:', err);
      setError('Failed to fetch opportunities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (walletAddress && whitelist.length > 0) {
      fetchOpportunities();
    }
  }, [walletAddress, whitelist, quotePreferences]);

  const formatNumber = (num) => {
    if (!num) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatPercent = (num) => {
    if (!num) return '0.00%';
    return `${num > 0 ? '+' : ''}${formatNumber(num)}%`;
  };

  const getOpportunityScore = (opportunity) => {
    // Simple scoring based on APR and volume
    if (opportunity.apr > 100) return 'Excellent';
    if (opportunity.apr > 50) return 'Good';
    return 'Average';
  };

  const getScoreColor = (score) => {
    switch (score) {
      case 'Excellent':
        return 'success';
      case 'Good':
        return 'primary';
      default:
        return 'default';
    }
  };

  const handleViewOnMeteora = (poolAddress) => {
    window.open(`https://app.meteora.ag/dlmm/${poolAddress}`, '_blank');
  };

  const canAnalyze = walletAddress && whitelist.length > 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Rotation Opportunities
          </Typography>
        </Box>
        <Button
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={fetchOpportunities}
          disabled={loading || !canAnalyze}
          variant="contained"
          size="small"
        >
          Analyze
        </Button>
      </Box>

      {!canAnalyze && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please connect a wallet and add tokens to your whitelist to discover opportunities.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Analyzing pools and comparing with your positions...
          </Typography>
        </Box>
      ) : opportunities.length === 0 ? (
        <Alert severity="info">
          {canAnalyze ?
            'No better opportunities found at this time. We\'ll keep monitoring for you.' :
            'Add tokens to your whitelist and connect a wallet to start finding opportunities.'
          }
        </Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Pool</TableCell>
                <TableCell align="right">APR</TableCell>
                <TableCell align="right">24h Fees</TableCell>
                <TableCell align="right">Volume (24h)</TableCell>
                <TableCell align="right">Liquidity</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {opportunities.map((opp, index) => {
                const score = getOpportunityScore(opp);
                return (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {opp.pairName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {opp.quoteToken} pair
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatPercent(opp.apr)}
                        color={opp.apr > 50 ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        ${formatNumber(opp.fees24h)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        ${formatNumber(opp.volume24h)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        ${formatNumber(opp.liquidity)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={score}
                        color={getScoreColor(score)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Tooltip title="View on Meteora">
                          <IconButton
                            size="small"
                            onClick={() => handleViewOnMeteora(opp.address)}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Compare with current position">
                          <IconButton size="small" color="primary">
                            <CompareArrowsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="caption">
          <strong>How it works:</strong> The system analyzes available Meteora pools for your whitelisted tokens and compares them with your current positions. Better opportunities are ranked based on APR, fees, volume, and liquidity.
        </Typography>
      </Alert>
    </Box>
  );
}

export default OpportunitiesTable;
