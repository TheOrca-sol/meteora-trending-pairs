import { Box, Link } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getMeteoraLink } from '../../utils/helpers';

// Helper function to format numbers
const formatNumber = (value) => {
  const num = Number(value);
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

// Helper function to format percentages
const formatPercentage = (value) => {
  const num = Number(value);
  return `${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`;
};

export const getColumns = () => [
  { 
    id: 'pairName', 
    label: 'Pair Name', 
    numeric: false,
    render: (row) => (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Link
          href={getMeteoraLink(row)}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            display: 'flex', 
            alignItems: 'center',
            textDecoration: 'none',
            color: 'primary.main',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          {row.pairName}
          <OpenInNewIcon sx={{ ml: 0.5, fontSize: '0.9rem' }} />
        </Link>
      </Box>
    )
  },
  { id: 'binStep', label: 'Bin Step', numeric: true },
  { id: 'baseFee', label: 'Base Fee %', numeric: true },
  {
    id: 'volume30min',
    label: '30min Volume',
    numeric: true,
    render: (row) => formatNumber(row.volume30min)
  },
  {
    id: 'fees30min',
    label: '30min Fees',
    numeric: true,
    render: (row) => formatNumber(row.fees30min)
  },
  {
    id: 'fees24h',
    label: '24h Fees',
    numeric: true,
    render: (row) => formatNumber(row.fees24h)
  },
  {
    id: 'apr',
    label: '24h Fee/TVL (APR)',
    numeric: true,
    render: (row) => formatPercentage(row.apr)
  },
  {
    id: 'totalLiquidity',
    label: 'Total Liquidity',
    numeric: true,
    render: (row) => formatNumber(row.totalLiquidity)
  },
  {
    id: 'totalVolume',
    label: 'Total Volume',
    numeric: true,
    render: (row) => formatNumber(row.totalVolume)
  }
]; 