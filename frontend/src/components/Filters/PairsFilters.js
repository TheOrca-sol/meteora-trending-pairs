import React, { useState } from 'react';
import PropTypes from 'prop-types';
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
  Collapse,
  IconButton,
  useMediaQuery,
  useTheme,
  Badge
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // Collapsed by default on mobile, always expanded on desktop
  const [filtersExpanded, setFiltersExpanded] = useState(!isMobile);

  // Count active filters
  const activeFiltersCount = [
    filters.minFees30min,
    filters.minVolume24h,
    filters.minTotalLiquidity
  ].filter(val => val && val !== '' && val !== '0').length;

  return (
    <Box>
      {/* Search */}
      <Box sx={{ mb: 2 }}>
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

      {/* Advanced Filters - Collapsible on Mobile */}
      <Paper
        variant="outlined"
        sx={{
          bgcolor: 'background.default',
          overflow: 'hidden'
        }}
      >
        {/* Filters Header (Mobile Only) */}
        {isMobile && (
          <Box
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1.5,
              cursor: 'pointer',
              bgcolor: 'action.hover',
              '&:hover': {
                bgcolor: 'action.selected',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterListIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" color="primary" fontWeight={600}>
                Filters
              </Typography>
              {activeFiltersCount > 0 && (
                <Badge
                  badgeContent={activeFiltersCount}
                  color="primary"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: '0.7rem',
                      height: 18,
                      minWidth: 18,
                    }
                  }}
                />
              )}
            </Box>
            <IconButton size="small">
              {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        )}

        <Collapse in={filtersExpanded} timeout="auto">
          <Box sx={{ p: 2 }}>
            {!isMobile && (
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
                  Filters
                </Typography>
                <Divider sx={{ flex: 1 }} />
              </Box>
            )}

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
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: isMobile ? '16px' : '0.875rem', // Prevent zoom on iOS
                    }
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
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: isMobile ? '16px' : '0.875rem', // Prevent zoom on iOS
                    }
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
                  sx={{
                    '& .MuiInputBase-input': {
                      fontSize: isMobile ? '16px' : '0.875rem', // Prevent zoom on iOS
                    }
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

// PropTypes for FilterSection component
FilterSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

// PropTypes for PairsFilters component
PairsFilters.propTypes = {
  filters: PropTypes.shape({
    search: PropTypes.string,
    minFees30min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    minVolume24h: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    minTotalLiquidity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sortBy: PropTypes.string,
    sortDirection: PropTypes.string,
  }).isRequired,
  handleFilterChange: PropTypes.func.isRequired,
};

export default PairsFilters; 