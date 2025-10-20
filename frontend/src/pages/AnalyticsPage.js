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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PairsTable from '../components/Table/PairsTable';
import PairsFilters from '../components/Filters/PairsFilters';
import { trackUserInteraction } from '../utils/analytics';

function AnalyticsPage() {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [orderBy, setOrderBy] = useState('fee_rate_30min');
  const [order, setOrder] = useState('desc');
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    minFees30min: '',
    minFees24h: '',
    minApr: '',
    binStep: '',
    baseFee: '',
    minTotalLiquidity: '',
    sortBy: '',
    sortDirection: '',
  });

  const isInitialLoad = useRef(true);

  const fetchPairs = useCallback(async (isManualRefresh = false, isPagination = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else if (isPagination) {
        setPaginationLoading(true);
      }

      const response = await axios({
        method: 'get',
        url: 'http://localhost:5000/api/pairs',
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: filters.search,
          min_liquidity: filters.minTotalLiquidity,
          sort_by: orderBy,
          // Force refresh bypasses cache for fresh data when manually refreshing
          force_refresh: isManualRefresh ? 'true' : 'false'
        }
      });

      console.log('API Response:', response.data);
      setPairs(response.data.data);
      setPagination(response.data.pagination);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
      setError({
        message: err.response?.data?.message || err.message || 'Unknown error',
        status: err.response?.status,
        data: err.response?.data,
        stack: err.stack
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPaginationLoading(false);
    }
  }, [page, rowsPerPage, filters, orderBy]);

  useEffect(() => {
    const isPagination = !isInitialLoad.current && !loading && !refreshing;
    fetchPairs(false, isPagination);

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Apply client-side filters to the pairs data
  const filteredPairs = React.useMemo(() => {
    return pairs.filter(pair => {
      // Filter by 30min fees
      if (filters.minFees30min && parseFloat(filters.minFees30min) > 0) {
        const fees30min = parseFloat(pair.fees30min || 0);
        if (fees30min < parseFloat(filters.minFees30min)) {
          return false;
        }
      }

      // Filter by 24h fees
      if (filters.minFees24h && parseFloat(filters.minFees24h) > 0) {
        const fees24h = parseFloat(pair.fees24h || 0);
        if (fees24h < parseFloat(filters.minFees24h)) {
          return false;
        }
      }

      // Filter by APR
      if (filters.minApr && parseFloat(filters.minApr) > 0) {
        const apr = parseFloat(pair.apr || 0);
        if (apr < parseFloat(filters.minApr)) {
          return false;
        }
      }

      // Filter by bin step
      if (filters.binStep && filters.binStep !== '') {
        const binStep = parseInt(pair.binStep || 0);
        if (binStep !== parseInt(filters.binStep)) {
          return false;
        }
      }

      // Filter by base fee
      if (filters.baseFee && parseFloat(filters.baseFee) > 0) {
        const baseFee = parseFloat(pair.baseFee || 0);
        if (baseFee < parseFloat(filters.baseFee)) {
          return false;
        }
      }

      return true;
    });
  }, [pairs, filters]);

  const sortedPairs = React.useMemo(() => filteredPairs, [filteredPairs]);
  const paginatedPairs = React.useMemo(() => filteredPairs, [filteredPairs]);

  const handleChangePage = (event, newPage) => {
    setPaginationLoading(true);
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setPaginationLoading(true);
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleManualRefresh = async () => {
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
    }
  }, [pairs]);

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
        <Typography color="error" sx={{ mt: 4 }}>{error.message || error}</Typography>
      </Container>
    );
  }

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
          <Typography>{error.message || error}</Typography>
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
            pairs={paginatedPairs}
            orderBy={orderBy}
            order={order}
            page={page}
            rowsPerPage={rowsPerPage}
            handleSort={handleSort}
            handleChangePage={handleChangePage}
            handleChangeRowsPerPage={handleChangeRowsPerPage}
            totalCount={pagination?.total || pairs.length}
            paginationLoading={paginationLoading}
          />
        </Paper>
      )}
    </Container>
  );
}

export default AnalyticsPage;
