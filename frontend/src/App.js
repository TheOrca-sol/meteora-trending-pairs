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
  Paper,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PairsTable from './components/Table/PairsTable';
import PairsFilters from './components/Filters/PairsFilters';
import Footer from './components/Footer/Footer';
import { initGA, logPageView, trackUserInteraction } from './utils/analytics';
import { lightTheme, darkTheme } from './utils/theme';
import ThemeToggle from './components/ThemeToggle/ThemeToggle';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50); // Increase default to 50
  const [orderBy, setOrderBy] = useState('fees_24h'); // Use backend field name
  const [order, setOrder] = useState('desc');
  const [pagination, setPagination] = useState(null); // Add pagination state
  const [filters, setFilters] = useState({
    search: '',
    minVolume30min: '',
    minFees30min: '',
    minFees24h: '',
    minApr: '',
    binStep: '',
    baseFee: '',
    hideBlacklisted: false,
    minTotalLiquidity: '',
    sortBy: '',
    sortDirection: '',
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
        url: 'http://localhost:5000/api/pairs',
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          page: page + 1, // Convert 0-based to 1-based
          limit: rowsPerPage,
          search: filters.search, // Use filters.search for searchTerm
          min_liquidity: filters.minTotalLiquidity, // Use filters.minTotalLiquidity for minLiquidity
          sort_by: orderBy // Use orderBy for sortBy
        }
      });
      
      console.log('API Response:', response.data);
      setPairs(response.data.data);
      setPagination(response.data.pagination); // This line was not in the new_code, so it's removed.
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Error fetching pairs data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, rowsPerPage, filters.search, filters.minTotalLiquidity, orderBy]); // Added dependencies

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

  // Add console logs to track data flow
  console.log('Filtered pairs:', filteredPairs.length);
  console.log('Sorted pairs:', sortedPairs.length);
  console.log('Sample pair:', sortedPairs[0]);

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
        <Container 
          maxWidth={false} 
          sx={{ 
            mt: { xs: 2, md: 4 }, 
            mb: 4, 
            flex: 1,
            px: { xs: 1, sm: 2, md: 3 },
            maxWidth: '2000px !important',
          }}
        >
          {/* Header Section */}
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between', 
              alignItems: { xs: 'flex-start', md: 'center' },
              mb: 4,
              gap: 2,
              borderBottom: 1,
              borderColor: 'divider',
              pb: 3
            }}
          >
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 700,
                background: theme => `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Meteora Analytics
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 3,
              flexWrap: 'wrap'
            }}>
              {lastUpdated && (
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  bgcolor: 'background.paper',
                  p: 1,
                  borderRadius: 1,
                  boxShadow: 1
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Last updated:
                  </Typography>
                  <Typography variant="body2" color="primary">
                    {lastUpdated.toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                bgcolor: 'background.paper',
                p: 1,
                borderRadius: 1,
                boxShadow: 1
              }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={handleAutoRefreshToggle}
                      color="primary"
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">Auto-refresh</Typography>
                  }
                />
                <ThemeToggle isDarkMode={isDarkMode} onToggle={handleThemeToggle} />
                <Tooltip title="Refresh data">
                  <IconButton 
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    size="small"
                    sx={{ 
                      animation: refreshing ? 'spin 1s linear infinite' : 'none',
                      bgcolor: 'primary.main',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      },
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          {/* Filters Section */}
          <Paper 
            elevation={2}
            sx={{ 
              mb: 4,
              p: { xs: 2, md: 3 },
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <PairsFilters 
              filters={filters}
              handleFilterChange={handleFilterChange}
            />
          </Paper>

          {/* Table Section */}
          {loading ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              minHeight: 400
            }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Paper 
              sx={{ 
                p: 3, 
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: 'error.light',
                color: 'error.dark'
              }}
            >
              <Typography>{error}</Typography>
            </Paper>
          ) : (
            <Paper 
              elevation={2}
              sx={{ 
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <PairsTable
                pairs={sortedPairs}
                orderBy={orderBy}
                order={order}
                page={page}
                rowsPerPage={rowsPerPage}
                handleSort={handleSort}
                handleChangePage={handleChangePage}
                handleChangeRowsPerPage={handleChangeRowsPerPage}
                totalCount={filteredPairs.length}
              />
            </Paper>
          )}
        </Container>
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
