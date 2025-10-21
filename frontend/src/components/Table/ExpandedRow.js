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
import MarketStats from './MarketStats';
import SecurityReport from './SecurityReport';
import TokenInformation from './TokenInformation';
import TokenHolders from './TokenHolders';
import BubbleMaps from './BubbleMaps';
import LiquidityDistribution from '../LiquidityDistribution';
import ExternalLinks from './ExternalLinks';

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
const ExpandedRow = ({ pair }) => {
  const pairXToken = getPairXToken(pair);
  // Enable localhost-only features via environment variable
  const enableLocalhostFeatures = process.env.REACT_APP_ENABLE_LOCALHOST_FEATURES === 'true';

  if (!pair || !pairXToken) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No pair data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default' }}>
      <Grid container spacing={3}>
        {/* Quick Links Bar */}
        <Grid item xs={12}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              pb: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                mr: 1,
              }}
            >
              Quick Links:
            </Typography>
            <ExternalLinks pair={pair} />
          </Box>
        </Grid>

        {/* Token Information & Security Side by Side */}
        <Grid item xs={12} md={enableLocalhostFeatures ? 4 : 6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <TokenInformation tokenAddress={pairXToken.address} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={enableLocalhostFeatures ? 4 : 6}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              height: '100%',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <SecurityReport pair={pair} />
          </Paper>
        </Grid>

        {/* BubbleMaps - Only show when localhost features enabled */}
        {enableLocalhostFeatures && (
          <Grid item xs={12} md={4}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                height: '100%',
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <BubbleMaps tokenAddress={pairXToken.address} />
            </Paper>
          </Grid>
        )}

        {/* Full Width - Liquidity Distribution - Only show when localhost features enabled */}
        {enableLocalhostFeatures && (
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <LiquidityDistribution mintX={pair.mint_x} mintY={pair.mint_y} />
            </Paper>
          </Grid>
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
};

export default ExpandedRow; 