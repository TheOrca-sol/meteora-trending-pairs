import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

const BubbleMaps = ({ tokenAddress }) => {
  if (!tokenAddress) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No token address available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 500 }}>
        Token Distribution Map
      </Typography>
      <Box sx={{ 
        width: '100%', 
        height: '400px',
        overflow: 'hidden',
        borderRadius: 1
      }}>
        <iframe
          src={`https://app.bubblemaps.io/sol/token/${tokenAddress}`}
          width="100%"
          height="100%"
          frameBorder="0"
          loading="lazy"
          title="Bubble Maps Token Distribution"
        />
      </Box>
    </Box>
  );
};

export default BubbleMaps; 