import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Box,
  Typography,
  Divider,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

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
      {/* Search */}
      <Box sx={{ mb: 3 }}>
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
      </Box>

      {/* Advanced Filters */}
      <Paper 
        variant="outlined" 
        sx={{ 
          p: 2,
          bgcolor: 'background.default'
        }}
      >
        <FilterSection title="Filters">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
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
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Min 24h Volume"
                size="small"
                type="number"
                value={filters.minVolume24h}
                onChange={handleFilterChange('minVolume24h')}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Min TVL"
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
      </Paper>
    </Box>
  );
};

export default PairsFilters; 