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
import MarketStats from './MarketStats';
import SecurityReport from './SecurityReport';
import TokenInformation from './TokenInformation';
import TokenHolders from './TokenHolders';
import BubbleMaps from './BubbleMaps';

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
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        {/* Left Column - Token Information */}
        <Grid item xs={12} md={3}>
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
            <TokenInformation tokenAddress={pairXToken.address} />
          </Paper>
        </Grid>

        {/* Middle Column - Market Activity */}
        

        {/* Right Column - Security Report */}
        <Grid item xs={12} md={3}>
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
            <SecurityReport pair={pair} />
          </Paper>
        </Grid>

        {/* Right Column - Token Holders */}
        

        {/* Bottom Row - BubbleMaps */}
        <Grid item xs={6}>
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
            <BubbleMaps tokenAddress={pairXToken.address} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ExpandedRow; 