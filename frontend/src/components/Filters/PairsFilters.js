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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

const PairsFilters = ({ filters, handleFilterChange }) => {
  return (
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
          label="Min 30min Volume ($)"
          variant="outlined"
          type="number"
          value={filters.minVolume30min}
          onChange={handleFilterChange('minVolume30min')}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="Min 30min Fees ($)"
          variant="outlined"
          type="number"
          value={filters.minFees30min}
          onChange={handleFilterChange('minFees30min')}
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
          label="Min APR (%)"
          variant="outlined"
          type="number"
          value={filters.minApr}
          onChange={handleFilterChange('minApr')}
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
          label="Base Fee (%)"
          variant="outlined"
          type="number"
          value={filters.baseFee}
          onChange={handleFilterChange('baseFee')}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="Min Total Liquidity ($)"
          variant="outlined"
          type="number"
          value={filters.minTotalLiquidity}
          onChange={handleFilterChange('minTotalLiquidity')}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControlLabel
          control={
            <Switch
              checked={filters.hideBlacklisted}
              onChange={handleFilterChange('hideBlacklisted')}
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
            <MenuItem value="fees30min">30min Fees</MenuItem>
            <MenuItem value="fees24h">24h Fees</MenuItem>
            <MenuItem value="apr">APR</MenuItem>
            <MenuItem value="totalLiquidity">Total Liquidity</MenuItem>
            <MenuItem value="totalVolume">Total Volume</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} md={3}>
        <FormControl fullWidth>
          <InputLabel>Sort Direction</InputLabel>
          <Select
            value={filters.sortDirection}
            label="Sort Direction"
            onChange={handleFilterChange('sortDirection')}
          >
            <MenuItem value="desc">Descending</MenuItem>
            <MenuItem value="asc">Ascending</MenuItem>
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
};

export default PairsFilters; 