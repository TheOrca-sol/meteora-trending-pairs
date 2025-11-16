import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab, useMediaQuery, useTheme, IconButton, Tooltip } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsModal from '../Settings/SettingsModal';

function Navigation() {
  const location = useLocation();
  const currentPath = location.pathname;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          mb: { xs: 2, sm: 2.5, md: 3 },
          position: 'relative'
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

        {/* Settings Button */}
        <Box
          sx={{
            position: 'absolute',
            right: { xs: 8, sm: 16 },
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          <Tooltip title="Settings">
            <IconButton
              onClick={() => setSettingsOpen(true)}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  color: 'primary.main',
                  bgcolor: 'action.hover'
                }
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

export default Navigation;
