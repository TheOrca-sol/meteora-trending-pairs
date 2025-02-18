import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Switch,
  FormControlLabel,
  Tooltip,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PairsTable from './components/Table/PairsTable';
import PairsFilters from './components/Filters/PairsFilters';
import Footer from './components/Footer/Footer';
import { initGA, logPageView, trackUserInteraction } from './utils/analytics';
import { lightTheme, darkTheme } from './utils/theme';
import ThemeToggle from './components/ThemeToggle/ThemeToggle';

function App() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('volume30min');
  const [order, setOrder] = useState('desc');
  const [filters, setFilters] = useState({
    search: '',
    minVolume30min: '1000',
    minFees30min: '10',
    minFees24h: '',
    minApr: '10',
    binStep: '',
    baseFee: '',
    hideBlacklisted: true,
    minTotalLiquidity: '1000',
    sortBy: 'volume30min',
    sortDirection: 'desc',
  });

  // Add theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
    trackUserInteraction.themeChange(!isDarkMode ? 'dark' : 'light');
  };

  const fetchPairs = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      
      const response = await axios({
        method: 'get',
        url: 'https://api.imded.fun/api/pairs',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setPairs(response.data.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Fetch error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        stack: err.stack
      });
      setError('Error fetching pairs data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  useEffect(() => {
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchPairs();
      }, 60000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, fetchPairs]);

  // Initialize GA
  useEffect(() => {
    initGA();
    logPageView();
  }, []);

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);

    // Track sort changes
    trackUserInteraction.sortChange(property, isAsc ? 'desc' : 'asc');
  };

  const handleFilterChange = (filterName) => (event) => {
    const value = filterName === 'hideBlacklisted' 
      ? event.target.checked 
      : event.target.value;
    
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));

    // Track filter changes
    trackUserInteraction.filterChange(filterName, value);
  };

  const filteredPairs = React.useMemo(() => {
    return pairs.filter(pair => {
      const matchesSearch = pair.pairName.toLowerCase().includes(filters.search.toLowerCase());
      const matchesVolume = !filters.minVolume30min || pair.volume30min >= Number(filters.minVolume30min);
      const matchesFees30min = !filters.minFees30min || pair.fees30min >= Number(filters.minFees30min);
      const matchesFees24h = !filters.minFees24h || pair.fees24h >= Number(filters.minFees24h);
      const matchesApr = !filters.minApr || pair.apr >= Number(filters.minApr);
      const matchesBinStep = !filters.binStep || pair.binStep === Number(filters.binStep);
      const matchesBaseFee = !filters.baseFee || pair.baseFee === Number(filters.baseFee);
      const matchesLiquidity = !filters.minTotalLiquidity || pair.totalLiquidity >= Number(filters.minTotalLiquidity);
      const matchesBlacklist = !filters.hideBlacklisted || !pair.is_blacklisted;
      
      return matchesSearch && matchesVolume && matchesFees30min && matchesFees24h && 
             matchesApr && matchesBinStep && matchesBaseFee && matchesBlacklist && 
             matchesLiquidity;
    });
  }, [pairs, filters]);

  const sortedPairs = React.useMemo(() => {
    return [...filteredPairs].sort((a, b) => {
      if (order === 'asc') {
        return a[orderBy] > b[orderBy] ? 1 : -1;
      } else {
        return b[orderBy] > a[orderBy] ? 1 : -1;
      }
    });
  }, [filteredPairs, order, orderBy]);

  const paginatedPairs = React.useMemo(() => {
    return sortedPairs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedPairs, page, rowsPerPage]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleManualRefresh = async () => {
    // Track manual refresh
    trackUserInteraction.refreshData(false);
    await fetchPairs(true);
  };

  const handleAutoRefreshToggle = (event) => {
    setAutoRefresh(event.target.checked);
  };

  useEffect(() => {
    if (pairs.length > 0) {
      console.log('Total pairs:', pairs.length);
      console.log('Sample pair full data:', pairs[0]);
      console.log('Blacklisted pairs:', pairs.filter(p => p.is_blacklisted).length);
      console.log('Non-blacklisted pairs:', pairs.filter(p => !p.is_blacklisted).length);
    }
  }, [pairs]);

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Typography color="error" sx={{ mt: 4 }}>{error}</Typography>
      </Container>
    );
  }

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
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4">
              Meteora Trending Pairs
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {lastUpdated && (
                <Typography variant="body2" color="text.secondary">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </Typography>
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={handleAutoRefreshToggle}
                    color="primary"
                  />
                }
                label="Auto-refresh"
              />
              <ThemeToggle 
                isDarkMode={isDarkMode} 
                onToggle={handleThemeToggle}
              />
              <Tooltip title="Refresh data">
                <IconButton 
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  sx={{ 
                    animation: refreshing ? 'spin 1s linear infinite' : 'none',
                    '@keyframes spin': {
                      '0%': { transform: 'rotate(0deg)' },
                      '100%': { transform: 'rotate(360deg)' }
                    }
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <PairsFilters 
            filters={filters}
            handleFilterChange={handleFilterChange}
          />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography color="error" sx={{ mt: 4 }}>{error}</Typography>
          ) : (
            <PairsTable
              pairs={paginatedPairs}
              orderBy={orderBy}
              order={order}
              page={page}
              rowsPerPage={rowsPerPage}
              handleSort={handleSort}
              handleChangePage={handleChangePage}
              handleChangeRowsPerPage={handleChangeRowsPerPage}
              totalCount={filteredPairs.length}
            />
          )}

          {refreshing && (
            <Box sx={{ 
              position: 'fixed', 
              top: '1rem', 
              right: '1rem',
              zIndex: 1500 
            }}>
              <CircularProgress size={20} />
            </Box>
          )}
        </Container>
        <Footer />
      </Box>
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
