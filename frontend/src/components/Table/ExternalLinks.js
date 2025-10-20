import React from 'react';
import { Box, Button, Typography, Grid } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getPairXToken } from '../../utils/helpers';

const ExternalLinks = ({ pair }) => {
  const pairXToken = getPairXToken(pair);

  if (!pair || !pairXToken) {
    return null;
  }

  const tokenAddress = pairXToken.address;
  const pairAddress = pair.address;

  const links = [
    {
      name: 'Meteora',
      url: `https://app.meteora.ag/pools/${pairAddress}`,
      color: '#9945FF',
      bgColor: 'rgba(153, 69, 255, 0.1)',
    },
    {
      name: 'Jupiter',
      url: `https://jup.ag/swap/USDC-${tokenAddress}`,
      color: '#FCC00A',
      bgColor: 'rgba(252, 192, 10, 0.1)',
    },
    {
      name: 'Bubble Maps',
      url: `https://app.bubblemaps.io/sol/token/${tokenAddress}`,
      color: '#00D4AA',
      bgColor: 'rgba(0, 212, 170, 0.1)',
    },
    {
      name: 'GMGN',
      url: `https://gmgn.ai/sol/token/${tokenAddress}`,
      color: '#FF6B6B',
      bgColor: 'rgba(255, 107, 107, 0.1)',
    },
    {
      name: 'Birdeye',
      url: `https://birdeye.so/token/${tokenAddress}?chain=solana`,
      color: '#00A3FF',
      bgColor: 'rgba(0, 163, 255, 0.1)',
    },
  ];

  return (
    <Box>
      <Typography
        variant="body1"
        sx={{
          color: 'primary.main',
          mb: 2,
          fontWeight: 500
        }}
      >
        External Links
      </Typography>

      <Grid container spacing={1.5}>
        {links.map((link) => (
          <Grid item xs={12} sm={6} md={4} key={link.name}>
            <Button
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
              sx={{
                justifyContent: 'space-between',
                textTransform: 'none',
                bgcolor: link.bgColor,
                color: link.color,
                border: `1px solid ${link.color}40`,
                py: 1.5,
                px: 2,
                borderRadius: 2,
                '&:hover': {
                  bgcolor: link.bgColor,
                  borderColor: link.color,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 4px 12px ${link.color}30`,
                },
                transition: 'all 0.2s ease',
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                }}
              >
                {link.name}
              </Typography>
              <OpenInNewIcon sx={{ fontSize: '1.1rem', opacity: 0.8 }} />
            </Button>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default ExternalLinks;
