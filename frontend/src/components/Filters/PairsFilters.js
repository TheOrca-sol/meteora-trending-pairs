import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  InputAdornment,
  Box,
  Typography,
  Divider,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import TuneIcon from '@mui/icons-material/Tune';
import TimelineIcon from '@mui/icons-material/Timeline';

const FilterSection = ({ title, children }) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1,
      mb: 2 
    }}>
      <Typography 
        variant="subtitle2" 
        color="primary"
        sx={{ 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <FilterListIcon fontSize="small" />
        {title}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
    {children}
  </Box>
);

const PairsFilters = ({ filters, handleFilterChange }) => {
  return (
    <Box>
      {/* Search and Quick Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="Search by pair name or address..."
            size="small"
            value={filters.search}
            onChange={handleFilterChange('search')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'background.default',
                '&:hover': {
                  '& > fieldset': {
                    borderColor: 'primary.main',
                  }
                }
              }
            }}
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            alignItems: 'center',
            height: '100%'
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.hideBlacklisted}
                  onChange={handleFilterChange('hideBlacklisted')}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Typography variant="body2">Hide Blacklisted</Typography>
              }
            />
            <Divider orientation="vertical" flexItem />
            <Box sx={{
              display: 'flex',
              gap: 1,
              alignItems: 'center'
            }}>
              <Typography variant="body2" color="text.secondary">
                Quick Sort:
              </Typography>
              <Tooltip title="Sort by 30min Fee Rate">
                <IconButton
                  size="small"
                  onClick={() => handleFilterChange('sortBy')({ target: { value: 'fee_rate_30min' } })}
                  color={filters.sortBy === 'fee_rate_30min' ? 'primary' : 'default'}
                >
                  <TimelineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Advanced Filters */}
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2,
          bgcolor: 'background.default'
        }}
      >
        <FilterSection title="Volume & Fees">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Min 30min Volume"
                size="small"
                type="number"
                value={filters.minVolume30min}
                onChange={handleFilterChange('minVolume30min')}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Min 30min Fees"
                size="small"
                type="number"
                value={filters.minFees30min}
                onChange={handleFilterChange('minFees30min')}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Min 24h Fees"
                size="small"
                type="number"
                value={filters.minFees24h}
                onChange={handleFilterChange('minFees24h')}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Min Total Liquidity"
                size="small"
                type="number"
                value={filters.minTotalLiquidity}
                onChange={handleFilterChange('minTotalLiquidity')}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>
          </Grid>
        </FilterSection>

        <FilterSection title="Pool Parameters">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bin Step"
                size="small"
                type="number"
                value={filters.binStep}
                onChange={handleFilterChange('binStep')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Base Fee"
                size="small"
                type="number"
                value={filters.baseFee}
                onChange={handleFilterChange('baseFee')}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
              />
            </Grid>
          </Grid>
        </FilterSection>
      </Paper>
    </Box>
  );
};

export default PairsFilters; 