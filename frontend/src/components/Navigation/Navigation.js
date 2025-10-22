import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab, useMediaQuery, useTheme } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

function Navigation() {
  const location = useLocation();
  const currentPath = location.pathname;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Only show navigation on localhost
  if (window.location.hostname !== 'localhost') {
    return null;
  }

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        mb: { xs: 2, sm: 2.5, md: 3 }
      }}
    >
      <Tabs
        value={currentPath}
        centered={!isMobile}
        variant={isMobile ? "fullWidth" : "standard"}
        sx={{
          '& .MuiTab-root': {
            minWidth: { xs: 'auto', sm: 150, md: 200 },
            fontSize: { xs: '0.875rem', sm: '0.95rem', md: '1rem' },
            fontWeight: 500,
            px: { xs: 1, sm: 2, md: 3 },
            py: { xs: 1.5, sm: 2 }
          }
        }}
      >
        <Tab
          label="Analytics"
          value="/"
          component={Link}
          to="/"
          icon={<ShowChartIcon fontSize={isMobile ? "small" : "medium"} />}
          iconPosition="start"
        />
        <Tab
          label="Capital Rotation"
          value="/capital-rotation"
          component={Link}
          to="/capital-rotation"
          icon={<AccountBalanceWalletIcon fontSize={isMobile ? "small" : "medium"} />}
          iconPosition="start"
        />
      </Tabs>
    </Box>
  );
}

export default Navigation;
