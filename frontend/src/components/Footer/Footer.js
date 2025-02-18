import React from 'react';
import { Box, Link, Typography, useTheme } from '@mui/material';
import TwitterIcon from '@mui/icons-material/Twitter';

const Footer = () => {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: theme.palette.divider,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1
      }}
    >
      <Typography variant="body2" color="text.secondary">
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
        <Typography variant="body2">
          TheOrca.sol
        </Typography>
        <TwitterIcon sx={{ fontSize: '1rem' }} />
      </Link>
    </Box>
  );
};

export default Footer; 