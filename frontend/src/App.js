import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Box,
  Typography,
  CircularProgress,
  TablePagination,
  TableSortLabel,
  Grid,
  InputAdornment,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
  IconButton,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';

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
    minFees24h: '10',
    minApr: '10',
    binStep: '',
    baseFee: '',
    hideBlacklisted: true,
    minTotalLiquidity: '1000',
    sortBy: 'volume30min',
    sortDirection: 'desc',
  });

  const fetchPairs = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      }
      const response = await axios.get('https://api.imded.fun/api/pairs', {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      setPairs(response.data.data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
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

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleFilterChange = (field) => (event) => {
    setFilters(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    setPage(0);
  };

  const filteredPairs = pairs.filter(pair => {
    const matchesSearch = pair.pairName.toLowerCase().includes(filters.search.toLowerCase());
    const matchesVolume = !filters.minVolume30min || pair.volume30min >= Number(filters.minVolume30min);
    const matchesFees24h = !filters.minFees24h || pair.fees24h >= Number(filters.minFees24h);
    const matchesApr = !filters.minApr || (pair.apr >= Number(filters.minApr));
    const matchesBinStep = !filters.binStep || pair.binStep === Number(filters.binStep);
    const matchesBaseFee = !filters.baseFee || pair.baseFee === Number(filters.baseFee);
    const matchesBlacklist = !filters.hideBlacklisted || !pair.isBlacklisted;
    const matchesLiquidity = !filters.minTotalLiquidity || pair.totalLiquidity >= Number(filters.minTotalLiquidity);
    
    return matchesSearch && matchesVolume && matchesFees24h && matchesApr && 
           matchesBinStep && matchesBaseFee && matchesBlacklist && matchesLiquidity;
  });

  const sortedPairs = filteredPairs.sort((a, b) => {
    if (order === 'asc') {
      return a[orderBy] > b[orderBy] ? 1 : -1;
    } else {
      return b[orderBy] > a[orderBy] ? 1 : -1;
    }
  });

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const columns = [
    { id: 'pairName', label: 'Pair Name', numeric: false },
    { id: 'binStep', label: 'Bin Step', numeric: true },
    { id: 'baseFee', label: 'Base Fee %', numeric: true },
    { id: 'volume30min', label: '30min Volume', numeric: true },
    { id: 'fees24h', label: '24h Fees', numeric: true },
    { id: 'apr', label: '24h Fee/TVL (APR)', numeric: true },
    { id: 'totalLiquidity', label: 'Total Liquidity', numeric: true },
    { id: 'totalVolume', label: 'Total Volume', numeric: true },
  ];

  const getMeteoraLink = (pair) => {
    return `https://app.meteora.ag/dlmm/${pair.address}`;
  };

  const handleManualRefresh = () => {
    fetchPairs(true);
  };

  const handleAutoRefreshToggle = (event) => {
    setAutoRefresh(event.target.checked);
  };

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
    <Container maxWidth="xl" sx={{ mt: 4 }}>
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
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Search Pairs"
            variant="outlined"
            value={filters.search}
            onChange={handleFilterChange('search')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Min 30min Volume"
            variant="outlined"
            type="number"
            value={filters.minVolume30min}
            onChange={handleFilterChange('minVolume30min')}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Min 24h Fees ($)"
            variant="outlined"
            type="number"
            value={filters.minFees24h}
            onChange={handleFilterChange('minFees24h')}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Min 24h Fee/TVL (APR) %"
            variant="outlined"
            type="number"
            value={filters.minApr}
            onChange={handleFilterChange('minApr')}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Min Total Liquidity"
            variant="outlined"
            type="number"
            value={filters.minTotalLiquidity}
            onChange={handleFilterChange('minTotalLiquidity')}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Bin Step"
            variant="outlined"
            type="number"
            value={filters.binStep}
            onChange={handleFilterChange('binStep')}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            label="Base Fee %"
            variant="outlined"
            type="number"
            value={filters.baseFee}
            onChange={handleFilterChange('baseFee')}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControlLabel
            control={
              <Switch
                checked={filters.hideBlacklisted}
                onChange={(e) => handleFilterChange('hideBlacklisted')(e)}
                color="primary"
              />
            }
            label="Hide Blacklisted Pairs"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={filters.sortBy}
              label="Sort By"
              onChange={handleFilterChange('sortBy')}
            >
              <MenuItem value="volume30min">30min Volume</MenuItem>
              <MenuItem value="fees24h">24h Fees</MenuItem>
              <MenuItem value="apr">APR</MenuItem>
              <MenuItem value="totalLiquidity">Total Liquidity</MenuItem>
              <MenuItem value="totalVolume">Total Volume</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="pairs table">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.numeric ? 'right' : 'left'}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === column.id}
                    direction={orderBy === column.id ? order : 'asc'}
                    onClick={() => handleSort(column.id)}
                  >
                    {column.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPairs
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((pair, index) => (
                <TableRow 
                  key={index}
                  sx={{ 
                    backgroundColor: pair.isBlacklisted ? '#fff4f4' : 'inherit',
                    '&:hover': {
                      backgroundColor: pair.isBlacklisted ? '#ffe8e8' : 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Link
                        href={getMeteoraLink(pair)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          }
                        }}
                      >
                        {pair.pairName}
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </Link>
                      {pair.isBlacklisted && (
                        <Tooltip title="Blacklisted Pair">
                          <WarningIcon color="warning" sx={{ fontSize: 20 }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{pair.binStep}</TableCell>
                  <TableCell align="right">{pair.baseFee}%</TableCell>
                  <TableCell align="right">
                    ${Number(pair.volume30min).toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(pair.fees24h).toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    {Number(pair.apr).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}%
                  </TableCell>
                  <TableCell align="right">
                    ${Number(pair.totalLiquidity).toLocaleString()}
                  </TableCell>
                  <TableCell align="right">
                    ${Number(pair.totalVolume).toLocaleString()}
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={sortedPairs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
      
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
