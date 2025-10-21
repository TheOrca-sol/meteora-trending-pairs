import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import {
  Box,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import Navigation from './components/Navigation/Navigation';
import AnalyticsPage from './pages/AnalyticsPage';
import CapitalRotationPage from './pages/CapitalRotationPage';
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary'
        }}
      >
        {/* Header with Theme Toggle */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: 3,
            pt: 2,
            pb: 1
          }}
        >
          <ThemeToggle isDarkMode={isDarkMode} onToggle={handleThemeToggle} />
        </Box>

        {/* Navigation */}
        <Navigation />

        {/* Routes */}
        <Box sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<AnalyticsPage />} />
            <Route path="/capital-rotation" element={<CapitalRotationPage />} />
          </Routes>
        </Box>

        {/* Footer */}
        <Footer />
      </Box>
      <Analytics />
    </ThemeProvider>
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
