import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  Button,
  useMediaQuery
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TwitterIcon from '@mui/icons-material/Twitter';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getPairXToken, formatNumber } from '../../utils/helpers';
import axios from 'axios';
import MarketStats from './MarketStats';
import SecurityReport from './SecurityReport';
import TokenInformation from './TokenInformation';
import TokenHolders from './TokenHolders';
import LiquidityDistribution from '../LiquidityDistribution';
import BubbleMaps from './BubbleMaps';
import ExternalLinks from './ExternalLinks';
import TradingViewChart from '../TradingViewChart';

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

// Main ExpandedRow Component
const ExpandedRow = ({ pair, timeframes, calculateTxnStats }) => {
  const pairXToken = getPairXToken(pair);
  // Enable all features in production
  const enableLocalhostFeatures = true;

  if (!pair || !pairXToken) {
    return (
      <Box sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
          No pair data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, bgcolor: 'background.default' }}>
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        {/* Quick Links Bar */}
        <Grid item xs={12}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, sm: 1.5, md: 2 },
              pb: { xs: 1.5, sm: 2 },
              borderBottom: 1,
              borderColor: 'divider',
              flexWrap: 'wrap'
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                mr: { xs: 0, sm: 1 },
                fontSize: { xs: '0.8rem', sm: '0.875rem' },
                display: { xs: 'none', sm: 'block' }
              }}
            >
              Quick Links:
            </Typography>
            <ExternalLinks pair={pair} />
          </Box>
        </Grid>

        {/* Token Information */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2, md: 3 },
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: { xs: 1, sm: 1.5, md: 2 },
              border: 1,
              borderColor: 'divider',
            }}
          >
            <TokenInformation tokenAddress={pairXToken.address} />
          </Paper>
        </Grid>

        {/* Security Report */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2, md: 3 },
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: { xs: 1, sm: 1.5, md: 2 },
              border: 1,
              borderColor: 'divider',
            }}
          >
            <SecurityReport pair={pair} />
          </Paper>
        </Grid>

        {/* Time Period Analysis - Next to Security Report */}
        {timeframes && calculateTxnStats && (
          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.5, sm: 2, md: 3 },
                height: '100%',
                bgcolor: 'background.paper',
                borderRadius: { xs: 1, sm: 1.5, md: 2 },
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{
                  color: 'primary.main',
                  mb: { xs: 1.5, sm: 2 },
                  fontWeight: 600,
                  pb: { xs: 0.75, sm: 1 },
                  borderBottom: 1,
                  borderColor: 'divider',
                  fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' }
                }}
              >
                Time Period Analysis
              </Typography>

              <Grid container spacing={1}>
                {Object.entries(timeframes).map(([period, data]) => {
                  const { total, buyPercent, sellPercent } = calculateTxnStats(data.txns);
                  return (
                    <Grid item xs={6} key={period}>
                      <Box sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'action.selected',
                        height: '100%'
                      }}>
                        <Typography
                          variant="overline"
                          sx={{
                            color: 'text.secondary',
                            fontWeight: 600,
                            display: 'block',
                            mb: 0.5,
                            fontSize: '0.6rem'
                          }}
                        >
                          {period.toUpperCase()}
                        </Typography>

                        {/* Transactions */}
                        <Box sx={{ mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                            Transactions
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.3, fontSize: '0.85rem' }}>
                            {total}
                          </Typography>
                          <Box sx={{
                            width: '100%',
                            height: '4px',
                            borderRadius: 1,
                            display: 'flex',
                            overflow: 'hidden',
                            bgcolor: 'background.default',
                            mb: 0.3
                          }}>
                            <Box sx={{
                              width: `${buyPercent}%`,
                              bgcolor: 'success.main',
                            }} />
                            <Box sx={{
                              width: `${sellPercent}%`,
                              bgcolor: 'error.main',
                            }} />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" sx={{ color: 'success.main', fontSize: '0.6rem' }}>
                              Buy {buyPercent.toFixed(0)}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'error.main', fontSize: '0.6rem' }}>
                              Sell {sellPercent.toFixed(0)}%
                            </Typography>
                          </Box>
                        </Box>

                        {/* Price Change */}
                        <Box sx={{ mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                            Price Change
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              color: (data.priceChange || 0) >= 0 ? 'success.main' : 'error.main'
                            }}
                          >
                            {(data.priceChange || 0) > 0 ? '+' : ''}
                            {(data.priceChange || 0)?.toFixed(2)}%
                          </Typography>
                        </Box>

                        {/* Volume */}
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>
                            Volume
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            ${formatNumber(data.volume || 0)}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>

              {/* TradingView Chart */}
              <Box sx={{ mt: 3 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: 'text.secondary',
                    mb: 2,
                    fontWeight: 600,
                    fontSize: { xs: '0.85rem', sm: '0.9rem' }
                  }}
                >
                  Price Chart
                </Typography>
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'background.default',
                    border: 1,
                    borderColor: 'divider'
                  }}
                >
                  <TradingViewChart
                    pairAddress={pair.address}
                    pairName={pair.name}
                  />
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Localhost-Only Features */}
        {enableLocalhostFeatures && (
          <>
            {/* Aggregated Liquidity Distribution */}
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 1.5, sm: 2, md: 3 },
                  bgcolor: 'background.paper',
                  borderRadius: { xs: 1, sm: 1.5, md: 2 },
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <LiquidityDistribution mintX={pair.mint_x} mintY={pair.mint_y} />
              </Paper>
            </Grid>

            {/* BubbleMaps Token Distribution - Only in localhost/development */}
            {(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
              <Grid item xs={12}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1.5, sm: 2, md: 3 },
                    bgcolor: 'background.paper',
                    borderRadius: { xs: 1, sm: 1.5, md: 2 },
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <BubbleMaps tokenAddress={pairXToken.address} />
                </Paper>
              </Grid>
            )}
          </>
        )}
      </Grid>
    </Box>
  );
};

ExpandedRow.propTypes = {
  pair: PropTypes.shape({
    address: PropTypes.string,
    pairName: PropTypes.string,
    mint_x: PropTypes.string,
    mint_y: PropTypes.string,
  }).isRequired,
  timeframes: PropTypes.object,
  calculateTxnStats: PropTypes.func,
};

export default ExpandedRow; 