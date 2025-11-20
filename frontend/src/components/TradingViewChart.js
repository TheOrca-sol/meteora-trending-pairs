import React, { memo } from 'react';
import { Box, Typography } from '@mui/material';

const TradingViewChart = ({ pairAddress, pairName }) => {
  if (!pairAddress) {
    return (
      <Box
        sx={{
          width: '100%',
          height: 450,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No chart data available
        </Typography>
      </Box>
    );
  }

  // Birdeye TV widget - better iframe support than DexScreener
  const birdeyeUrl = `https://birdeye.so/tv-widget/solana/${pairAddress}?chain=solana&viewMode=pair&chartType=CANDLE&chartInterval=15&chartTimezone=America/New_York&chartLeftToolbar=show`;

  return (
    <Box
      sx={{
        width: '100%',
        height: 450,
        bgcolor: '#0d1421',
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider'
      }}
    >
      <iframe
        src={birdeyeUrl}
        title={`${pairName} Price Chart`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
      />
    </Box>
  );
};

export default memo(TradingViewChart);
