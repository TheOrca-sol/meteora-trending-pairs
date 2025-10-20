import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

function Navigation() {
  const location = useLocation();
  const currentPath = location.pathname;

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
        mb: 3
      }}
    >
      <Tabs
        value={currentPath}
        centered
        sx={{
          '& .MuiTab-root': {
            minWidth: 200,
            fontSize: '1rem',
            fontWeight: 500,
          }
        }}
      >
        <Tab
          label="Analytics"
          value="/"
          component={Link}
          to="/"
          icon={<ShowChartIcon />}
          iconPosition="start"
        />
        <Tab
          label="Capital Rotation"
          value="/capital-rotation"
          component={Link}
          to="/capital-rotation"
          icon={<AccountBalanceWalletIcon />}
          iconPosition="start"
        />
      </Tabs>
    </Box>
  );
}

export default Navigation;
