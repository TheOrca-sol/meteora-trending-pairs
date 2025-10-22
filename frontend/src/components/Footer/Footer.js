import React from 'react';
import { Box, Link, Typography, useTheme } from '@mui/material';
import TwitterIcon from '@mui/icons-material/Twitter';

const Footer = () => {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        py: { xs: 2, sm: 2.5, md: 3 },
        px: { xs: 1.5, sm: 2 },
        mt: 'auto',
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: theme.palette.divider,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap'
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
        Created by
      </Typography>
      <Link
        href="https://x.com/TheOrcaSol"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          textDecoration: 'none',
          color: 'primary.main',
          '&:hover': {
            textDecoration: 'underline'
          }
        }}
      >
        <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
          TheOrca.sol
        </Typography>
        <TwitterIcon sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} />
      </Link>
    </Box>
  );
};

export default Footer; 