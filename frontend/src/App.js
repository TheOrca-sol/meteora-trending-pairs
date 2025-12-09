import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import {
  Box,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import Navigation from './components/Navigation/Navigation';
import LandingPage from './pages/LandingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CapitalRotationPage from './pages/CapitalRotationPage';
import BackofficePage from './pages/BackofficePage';
import PoolDetailsPage from './pages/PoolDetailsPage';
import Footer from './components/Footer/Footer';
import { initGA, logPageView, trackUserInteraction } from './utils/analytics';
import { lightTheme, darkTheme } from './utils/theme';
import ThemeToggle from './components/ThemeToggle/ThemeToggle';
import { Analytics } from '@vercel/analytics/react';

function App() {
  // Add theme state (default to dark mode)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true; // Default to dark mode
  });

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
    trackUserInteraction.themeChange(!isDarkMode ? 'dark' : 'light');
  };

  // Initialize GA
  useEffect(() => {
    initGA();
    logPageView();
  }, []);

  return (
    <ThemeProvider theme={isDarkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <AppContent isDarkMode={isDarkMode} handleThemeToggle={handleThemeToggle} />
      <Analytics />
    </ThemeProvider>
  );
}

function AppContent({ isDarkMode, handleThemeToggle }) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary'
      }}
    >
      {/* Header with Theme Toggle - More compact on mobile - Hidden on landing page */}
      {!isLandingPage && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: { xs: 1, sm: 2, md: 3 },
            pt: { xs: 1, sm: 1.5, md: 2 },
            pb: { xs: 0.5, sm: 0.75, md: 1 }
          }}
        >
          <ThemeToggle isDarkMode={isDarkMode} onToggle={handleThemeToggle} />
        </Box>
      )}

      {/* Navigation - Hidden on landing page */}
      {!isLandingPage && <Navigation />}

      {/* Routes */}
      <Box sx={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<AnalyticsPage />} />
          <Route path="/capital-rotation" element={<CapitalRotationPage />} />
          <Route path="/backoffice" element={<BackofficePage />} />
          <Route path="/pool/:address" element={<PoolDetailsPage />} />
        </Routes>
      </Box>

      {/* Footer - Hidden on landing page (has its own footer) */}
      {!isLandingPage && <Footer />}
    </Box>
  );
}

const styles = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default App;
