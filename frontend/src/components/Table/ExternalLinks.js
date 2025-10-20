import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { getPairXToken } from '../../utils/helpers';

const ExternalLinks = ({ pair }) => {
  const pairXToken = getPairXToken(pair);

  if (!pair || !pairXToken) {
    return null;
  }

  const tokenAddress = pairXToken.address;
  const pairAddress = pair.address;
  const mintX = pair.mint_x;
  const mintY = pair.mint_y;

  const links = [
    {
      name: 'Meteora',
      url: `https://app.meteora.ag/dlmm/${pairAddress}`,
      logo: '/meteora.svg',
    },
    {
      name: 'Jupiter',
      url: `https://jup.ag/swap?sell=${mintY}&buy=${mintX}`,
      logo: 'https://jup.ag/svg/jupiter-logo.svg',
    },
    {
      name: 'Bubble Maps',
      url: `https://app.bubblemaps.io/sol/token/${tokenAddress}`,
      logo: '/Bubblemaps_idgHlaD7f9_1.svg',
    },
    {
      name: 'GMGN',
      url: `https://gmgn.ai/sol/token/${tokenAddress}`,
      logo: 'https://gmgn.ai/static/logo.svg',
    },
    {
      name: 'Birdeye',
      url: `https://birdeye.so/token/${tokenAddress}?chain=solana`,
      logo: '/Birdeye Logo_Black logomark 200x200.png',
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {links.map((link) => (
        <Tooltip
          key={link.name}
          title={`View on ${link.name}`}
          arrow
          placement="top"
        >
          <IconButton
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px) scale(1.05)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
          >
            <Box
              component="img"
              src={link.logo}
              alt={`${link.name} logo`}
              sx={{
                width: 28,
                height: 28,
                objectFit: 'contain',
              }}
            />
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
};

export default ExternalLinks;
