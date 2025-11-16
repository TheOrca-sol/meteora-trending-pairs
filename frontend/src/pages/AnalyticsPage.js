import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Paper,
  Button,
  Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PairsTable from '../components/Table/PairsTable';
import PairsFilters from '../components/Filters/PairsFilters';
import ErrorBoundary from '../components/ErrorBoundary';
import TableSkeleton from '../components/Table/TableSkeleton';
import DegenMode from '../components/DegenMode';
import { trackUserInteraction } from '../utils/analytics';
import { generateCacheKey, getCachedData, setCachedData, clearAllCache } from '../utils/cache';

function AnalyticsPage() {
  const [allPairs, setAllPairs] = useState([]); // All fetched pairs
  const [displayedPairs, setDisplayedPairs] = useState([]); // Pairs currently displayed
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [orderBy, setOrderBy] = useState('fee_rate_30min');
  const [order, setOrder] = useState('desc');
  const [newDataAvailable, setNewDataAvailable] = useState(false); // Banner flag
  const [displayLimit, setDisplayLimit] = useState(10); // Start with 10 pairs
  const [hasMore, setHasMore] = useState(true);

  // Initialize filters from localStorage or use defaults
  const getInitialFilters = () => {
    try {
      const savedFilters = localStorage.getItem('pairsFilters');
      if (savedFilters) {
        return JSON.parse(savedFilters);
      }
    } catch (error) {
      console.error('Error loading filters from localStorage:', error);
    }

    // Default filter values
    return {
      search: '',
      minFees30min: '100',
      minVolume24h: '25000',
      minTotalLiquidity: '10000',
      sortBy: '',
      sortDirection: '',
    };
  };

  const [filters, setFilters] = useState(getInitialFilters());

  const isInitialLoad = useRef(true);
  const scrollContainerRef = useRef(null);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('pairsFilters', JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filters to localStorage:', error);
    }
  }, [filters]);

  const fetchPairs = useCallback(async (isManualRefresh = false) => {
    const requestParams = {
      page: 1,
      limit: 20,
      search: filters.search,
      min_liquidity: filters.minTotalLiquidity,
      min_volume_24h: filters.minVolume24h,
      sort_by: orderBy,
      sort_order: order,
    };

    // Generate cache key based on request parameters
    const cacheKey = generateCacheKey(requestParams);

    // Check cache first (unless manual refresh)
    if (!isManualRefresh) {
      const { data: cachedData, isStale } = getCachedData(cacheKey);

      if (cachedData) {
        console.log('Using cached data, length:', cachedData.length);
        // Apply client-side filtering for 30min fees
        let filteredData = cachedData;
        if (filters.minFees30min && parseFloat(filters.minFees30min) > 0) {
          filteredData = filteredData.filter(pair => {
            const fees30min = parseFloat(pair.fees30min || 0);
            return fees30min >= parseFloat(filters.minFees30min);
          });
        }

        console.log('After filtering, data length:', filteredData.length);

        // Show cached data immediately
        setAllPairs(filteredData);
        setDisplayedPairs(filteredData.slice(0, 10));
        setHasMore(filteredData.length > 10);
        setError(null);
        setLoading(false);

        // If data is fresh, no need to fetch
        if (!isStale) {
          console.log('Using fresh cached data');
          return;
        }

        // Data is stale, fetch in background but don't show loading
        console.log('Using stale cached data, fetching fresh data in background');
      }
    }

    try {
      if (isManualRefresh) {
        setRefreshing(true);
        // Clear all cache on manual refresh
        clearAllCache();
      }

      console.log('Fetching from API with params:', requestParams);

      const response = await axios({
        method: 'get',
        url: `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/pairs`,
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          ...requestParams,
          force_refresh: isManualRefresh ? 'true' : 'false'
        }
      });

      console.log('API Response received, data length:', response.data.data?.length);

      // Cache the fresh data
      setCachedData(cacheKey, response.data.data);

      // Apply client-side filtering for 30min fees (backend doesn't support this filter)
      let filteredData = response.data.data;
      if (filters.minFees30min && parseFloat(filters.minFees30min) > 0) {
        filteredData = filteredData.filter(pair => {
          const fees30min = parseFloat(pair.fees30min || 0);
          return fees30min >= parseFloat(filters.minFees30min);
        });
      }

      console.log('After filtering, final data length:', filteredData.length);

      setAllPairs(filteredData);
      setDisplayedPairs(filteredData.slice(0, 10));
      setHasMore(filteredData.length > 10);
      setError(null);
      setLastUpdated(new Date());

      // Reset to top on manual refresh
      if (isManualRefresh && scrollContainerRef.current) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setDisplayLimit(10); // Reset to initial limit
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError({
        message: err.response?.data?.message || err.message || 'Unknown error',
        status: err.response?.status,
        data: err.response?.data,
        stack: err.stack
      });
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, orderBy, order]);

  // Initial load
  useEffect(() => {
    if (isInitialLoad.current) {
      fetchPairs(false);
      isInitialLoad.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters or sorting change
  useEffect(() => {
    if (!isInitialLoad.current) {
      setLoading(true);
      setDisplayLimit(10); // Reset to initial limit
      fetchPairs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, orderBy, order]);

  // Auto-refresh: Show banner instead of refreshing
  useEffect(() => {
    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        setNewDataAvailable(true);
      }, 60000); // 60 seconds
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh]);

  // Load more pairs when scrolling
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setTimeout(() => {
      const newLimit = displayLimit + 5;
      setDisplayLimit(newLimit);
      setDisplayedPairs(allPairs.slice(0, newLimit));
      setHasMore(allPairs.length > newLimit);
      setLoadingMore(false);
    }, 300); // Slight delay for UX
  }, [displayLimit, allPairs, hasMore, loadingMore]);

  // Infinite scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;

      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;

      // Load more when user is 200px from bottom
      if (documentHeight - scrollPosition < 200) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore, loadingMore, hasMore]);

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    trackUserInteraction.sortChange(property, isAsc ? 'desc' : 'asc');
  };

  const handleFilterChange = (filterName) => (event) => {
    const value = event.target.value;

    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));

    trackUserInteraction.filterChange(filterName, value);
  };

  const handleManualRefresh = async () => {
    trackUserInteraction.refreshData(false);
    setNewDataAvailable(false);
    await fetchPairs(true);
  };

  const handleBannerClick = async () => {
    setNewDataAvailable(false);
    setDisplayLimit(10); // Reset to top
    await fetchPairs(true);
  };

  const handleAutoRefreshToggle = (event) => {
    setAutoRefresh(event.target.checked);
    if (!event.target.checked) {
      setNewDataAvailable(false);
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && allPairs.length > 0) {
      console.log('Total pairs fetched:', allPairs.length);
      console.log('Displayed pairs:', displayedPairs.length);
      console.log('Sample pair full data:', allPairs[0]);
    }
  }, [allPairs, displayedPairs]);

  if (loading) {
    return (
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
        <Paper
          elevation={2}
          sx={{
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <TableSkeleton rows={10} />
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Typography color="error" sx={{ mt: 4 }}>{error.message || error}</Typography>
      </Container>
    );
  }

  return (
    <Container
      maxWidth={false}
      sx={{
        mt: { xs: 1.5, sm: 2, md: 3, lg: 4 },
        mb: { xs: 3, sm: 3.5, md: 4 },
        flex: 1,
        px: { xs: 1, sm: 1.5, md: 2, lg: 3 },
        maxWidth: '2000px !important',
      }}
      ref={scrollContainerRef}
    >
      {/* New Data Available Banner (Twitter-style) */}
      {newDataAvailable && (
        <Box
          sx={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
          }}
        >
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={handleBannerClick}>
                Refresh
              </Button>
            }
            sx={{
              boxShadow: 3,
              cursor: 'pointer',
            }}
            onClick={handleBannerClick}
          >
            New data available
          </Alert>
        </Box>
      )}

      {/* Header Section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', md: 'center' },
          mb: { xs: 3, sm: 3.5, md: 4 },
          gap: { xs: 1.5, sm: 2 },
          borderBottom: 1,
          borderColor: 'divider',
          pb: { xs: 2, sm: 2.5, md: 3 }
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' },
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
          gap: { xs: 2, sm: 2.5, md: 3 },
          flexWrap: 'wrap',
          width: { xs: '100%', md: 'auto' }
        }}>
          {lastUpdated && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 0.75, sm: 1 },
              bgcolor: 'background.paper',
              p: { xs: 0.75, sm: 1 },
              borderRadius: 1,
              boxShadow: 1,
              flex: { xs: '1 1 auto', sm: '0 0 auto' }
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                Last updated:
              </Typography>
              <Typography variant="body2" color="primary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                {lastUpdated.toLocaleTimeString()}
              </Typography>
            </Box>
          )}

          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            bgcolor: 'background.paper',
            p: { xs: 0.75, sm: 1 },
            borderRadius: 1,
            boxShadow: 1,
            flex: { xs: '1 1 auto', sm: '0 0 auto' }
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
                <Typography variant="body2" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>Auto-refresh</Typography>
              }
              sx={{ m: 0 }}
            />
            <Tooltip title="Refresh data">
              <IconButton
                onClick={handleManualRefresh}
                disabled={refreshing}
                size="small"
                sx={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                  bgcolor: 'primary.main',
                  color: 'white',
                  minWidth: { xs: 40, sm: 36 },
                  minHeight: { xs: 40, sm: 36 },
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
      {/* Degen Mode Section */}
      <Box sx={{ mb: { xs: 3, sm: 3.5, md: 4 } }}>
        <ErrorBoundary>
          <DegenMode />
        </ErrorBoundary>
      </Box>

      <Paper
        elevation={2}
        sx={{
          mb: { xs: 3, sm: 3.5, md: 4 },
          p: { xs: 1.5, sm: 2, md: 3 },
          borderRadius: { xs: 1, sm: 1.5, md: 2 },
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
          <Typography>{error.message || error}</Typography>
        </Paper>
      ) : (
        <>
          <ErrorBoundary errorMessage="Failed to load pairs table. Please try refreshing the page.">
            <Paper
              elevation={2}
              sx={{
                borderRadius: { xs: 1, sm: 1.5, md: 2 },
                overflow: 'hidden'
              }}
            >
              <PairsTable
                pairs={displayedPairs}
                orderBy={orderBy}
                order={order}
                handleSort={handleSort}
              />
            </Paper>
          </ErrorBoundary>

          {/* Loading more indicator */}
          {loadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 2, sm: 2.5, md: 3 }, mb: { xs: 1.5, sm: 2 } }}>
              <CircularProgress size={30} />
            </Box>
          )}

          {/* End of results message */}
          {!hasMore && displayedPairs.length > 0 && (
            <Box sx={{ textAlign: 'center', mt: { xs: 2, sm: 2.5, md: 3 }, mb: { xs: 1.5, sm: 2 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                No more pairs to load
              </Typography>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

export default AnalyticsPage;
