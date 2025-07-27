import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  TablePagination,
  Collapse,
  IconButton,
  Box,
  Avatar,
  Typography,
  StepIcon,
  CircularProgress,
  Backdrop
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getColumns } from './columns';
import { trackUserInteraction } from '../../utils/analytics';
import ExpandedRow from './ExpandedRow';
import { TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, AttachMoney as AttachMoneyIcon, CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getPairXToken } from '../../utils/helpers';
import axios from 'axios';

// Utility functions for number formatting
const formatNumber = (num) => {
  // Handle null, undefined, or non-numeric values
  if (num === null || num === undefined || num === '') {
    return '0.00';
  }

  // Convert string numbers to floats
  const value = typeof num === 'string' ? parseFloat(num) : num;

  // Check if it's a valid number after conversion
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00';
  }

  try {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    } else {
      return value.toFixed(2);
    }
  } catch (error) {
    console.error('Error formatting number:', error, 'Value:', num);
    return '0.00';
  }
};

const formatPrice = (price) => {
  // Handle null, undefined, or non-numeric values
  if (price === null || price === undefined || price === '') {
    return '0.00';
  }

  // Convert string prices to floats
  const value = typeof price === 'string' ? parseFloat(price) : price;

  // Check if it's a valid number after conversion
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00';
  }

  try {
    if (value < 0.01) {
      return value.toFixed(8);
    } else if (value < 1) {
      return value.toFixed(4);
    } else {
      return value.toFixed(2);
    }
  } catch (error) {
    console.error('Error formatting price:', error, 'Value:', price);
    return '0.00';
  }
};

const Row = ({ pair, periodData }) => {
  const [open, setOpen] = useState(false);
  const [pairData, setPairData] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const theme = useTheme();
  const pairXToken = getPairXToken(pair);

  useEffect(() => {
    const fetchPairData = async () => {
      try {
        const [dexScreenerResponse, jupiterResponse] = await Promise.all([
          axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair.address}`),
          axios.get(`https://lite-api.jup.ag/tokens/v2/search?query=${pairXToken?.address}`)
        ]);

        const dexScreenerData = dexScreenerResponse.data.pairs?.[0];
        const jupiterData = jupiterResponse.data?.[0]; // v2 returns an array

        if (dexScreenerData) {
          setPairData(dexScreenerData);
        }
        if (jupiterData) {
          setTokenInfo(jupiterData);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    if (pair.address && pairXToken?.address) {
      fetchPairData();
    }
  }, [pair.address, pairXToken?.address]);

  const handleRowClick = () => {
    setOpen(!open);
    trackUserInteraction.pairClick(pair.pairName);
  };

  // Calculate transaction percentages
  const calculateTxnStats = (txns) => {
    if (!txns) return { total: 0, buyPercent: 0, sellPercent: 0 };
    const total = (txns.buys || 0) + (txns.sells || 0);
    const buyPercent = total ? ((txns.buys || 0) / total) * 100 : 0;
    const sellPercent = total ? ((txns.sells || 0) / total) * 100 : 0;
    return { total, buyPercent, sellPercent };
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  // Calculate fees for different periods using DexScreener data if available, or Jupiter data
  const volume24h = pairData?.volume?.h24 || (tokenInfo?.stats24h?.buyVolume + tokenInfo?.stats24h?.sellVolume) || 0;
  const volume30m = pairData?.volume?.m30 || 0;
  const feePercentage = pair.baseFee || 0.3; // Use backend baseFee
  const dailyFees = volume24h * (feePercentage / 100);
  const thirtyMinFees = volume30m * (feePercentage / 100);
  
  // Calculate APR using daily fees from DexScreener/Jupiter or fallback to backend APR
  const tvl = pairData?.liquidity?.usd || tokenInfo?.liquidity || pair.totalLiquidity || 0;
  const calculatedApr = tvl > 0 ? ((dailyFees * 365 * 100) / tvl) : 0;
  const finalApr = calculatedApr || pair.apr || 0;

  // Get stats for each timeframe from DexScreener or Jupiter fallback
  const timeframes = {
    '5m': {
      txns: pairData?.txns?.m5 || { 
        buys: tokenInfo?.stats5m?.numBuys || 0, 
        sells: tokenInfo?.stats5m?.numSells || 0 
      },
      volume: pairData?.volume?.m5 || (tokenInfo?.stats5m?.buyVolume + tokenInfo?.stats5m?.sellVolume) || 0,
      priceChange: pairData?.priceChange?.m5 || tokenInfo?.stats5m?.priceChange || 0
    },
    '1h': {
      txns: pairData?.txns?.h1 || { 
        buys: tokenInfo?.stats1h?.numBuys || 0, 
        sells: tokenInfo?.stats1h?.numSells || 0 
      },
      volume: pairData?.volume?.h1 || (tokenInfo?.stats1h?.buyVolume + tokenInfo?.stats1h?.sellVolume) || 0,
      priceChange: pairData?.priceChange?.h1 || tokenInfo?.stats1h?.priceChange || 0
    },
    '6h': {
      txns: pairData?.txns?.h6 || { 
        buys: tokenInfo?.stats6h?.numBuys || 0, 
        sells: tokenInfo?.stats6h?.numSells || 0 
      },
      volume: pairData?.volume?.h6 || (tokenInfo?.stats6h?.buyVolume + tokenInfo?.stats6h?.sellVolume) || 0,
      priceChange: pairData?.priceChange?.h6 || tokenInfo?.stats6h?.priceChange || 0
    },
    '24h': {
      txns: pairData?.txns?.h24 || { 
        buys: tokenInfo?.stats24h?.numBuys || 0, 
        sells: tokenInfo?.stats24h?.numSells || 0 
      },
      volume: pairData?.volume?.h24 || (tokenInfo?.stats24h?.buyVolume + tokenInfo?.stats24h?.sellVolume) || 0,
      priceChange: pairData?.priceChange?.h24 || tokenInfo?.stats24h?.priceChange || 0
    }
  };

  // Add debug logging
  console.log('Row data sources:', {
    pairName: pair?.pairName,
    dexScreener: pairData ? 'Available' : 'Not loaded',
    jupiterToken: tokenInfo ? 'Available' : 'Not loaded',
    dexVolume24h: pairData?.volume?.h24,
    jupiterVolume24h: tokenInfo?.stats24h ? (tokenInfo.stats24h.buyVolume + tokenInfo.stats24h.sellVolume) : 'N/A',
    dexLiquidity: pairData?.liquidity?.usd,
    jupiterLiquidity: tokenInfo?.liquidity,
    backendPrice: pair?.price,
    finalVolume24h: volume24h,
    finalTvl: tvl
  });

  // Don't return null - always show the row, even if DexScreener data is loading
  // if (!pairData) return null;

  return (
    <>
      <TableRow
        hover
        sx={{
          cursor: 'pointer',
          height: '48px',
          '& > td': {
            bgcolor: pair.is_blacklisted ? 'error.lighter' : 'transparent',
            border: 0,
            p: 1,
            color: 'text.secondary',
            fontFamily: 'monospace',
          },
          '&:hover': {
            '& > td': {
              bgcolor: 'rgba(255, 255, 255, 0.03)',
            }
          }
        }}
        onClick={handleRowClick}
      >
        {/* Expand/Collapse */}
        <TableCell sx={{ width: 30 }}>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
            sx={{ color: 'text.secondary', p: 0 }}
          >
            <KeyboardArrowDownIcon 
              sx={{ 
                transform: open ? 'rotate(180deg)' : 'none',
                transition: '0.2s'
              }}
            />
          </IconButton>
        </TableCell>

        {/* Pair Name & Info */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar 
                src={pairData?.baseToken?.logoURI || tokenInfo?.logoURI} 
                alt={pairData?.baseToken?.symbol || tokenInfo?.symbol}
                sx={{ width: 24, height: 24 }}
              />
              <Avatar 
                src={pairData?.quoteToken?.logoURI} 
                alt={pairData?.quoteToken?.symbol}
                sx={{ 
                  width: 24, 
                  height: 24, 
                  ml: -1 // Negative margin to overlap icons slightly
                }}
              />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>
                  {pairData?.baseToken?.symbol || pair.pairName?.split('-')[0] || 'Unknown'}-{pairData?.quoteToken?.symbol || pair.pairName?.split('-')[1] || 'SOL'}
                </Typography>
                <Typography 
                  sx={{ 
                    color: 'primary.main',
                    bgcolor: 'primary.darker',
                    px: 0.5,
                    py: 0.25,
                    borderRadius: 0.5,
                    fontSize: '0.75rem',
                  }}
                >
                  DLMM
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <StepIcon 
                    icon="⚡" 
                    sx={{ 
                      fontSize: '0.875rem',
                      color: 'text.secondary',
                    }} 
                  />
                  <Typography variant="caption" color="text.secondary">
                    {pair.binStep}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AttachMoneyIcon sx={{ fontSize: '0.875rem', color: 'info.main' }} />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: 'info.main',
                      bgcolor: 'info.darker',
                      px: 0,
                      py: 0.25,
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                    }}
                  >
                    {Number(pair.baseFee || 0).toFixed(2)}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {formatTimeAgo(pairData?.pairCreatedAt)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </TableCell>

        {/* Price */}
        <TableCell align="right">
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
            ${formatPrice(pairData?.priceUsd || tokenInfo?.usdPrice || pair?.price || 0)}
          </Typography>
        </TableCell>

        {/* Today's Fees + 30min Fees */}
        <TableCell align="right">
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Typography sx={{ fontWeight: 500, color: 'success.main' }}>
              ${formatNumber(dailyFees || pair?.fees24h || 0)}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              30m: ${formatNumber(thirtyMinFees)}
            </Typography>
          </Box>
        </TableCell>

        {/* TVL */}
        <TableCell align="right">
          <Typography sx={{ fontWeight: 500 }}>
            ${formatNumber(pairData?.liquidity?.usd || tokenInfo?.liquidity || pair?.totalLiquidity || 0)}
          </Typography>
        </TableCell>

        {/* APR 24H */}
        <TableCell align="right">
          <Typography sx={{ 
            fontWeight: 500,
            color: 'success.main'
          }}>
            {Number(finalApr).toLocaleString()}%
          </Typography>
        </TableCell>

        {/* Transaction Counts with Buy/Sell bars */}
        {Object.entries(timeframes).map(([period, data]) => {
          const { total, buyPercent, sellPercent } = calculateTxnStats(data.txns);
          return (
            <TableCell key={`${period}-txns`} align="right">
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {/* Total transactions */}
                <Typography sx={{ 
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  color: 'text.primary'
                }}>
                  {total}
                </Typography>
                
                {/* Buy/Sell bar */}
                <Box sx={{ 
                  width: '100%',
                  height: '4px',
                  borderRadius: 1,
                  display: 'flex',
                  overflow: 'hidden',
                  bgcolor: 'background.paper'
                }}>
                  <Box sx={{ 
                    width: `${buyPercent}%`,
                    bgcolor: 'success.main',
                    transition: 'width 0.3s ease'
                  }} />
                  <Box sx={{ 
                    width: `${sellPercent}%`,
                    bgcolor: 'error.main',
                    transition: 'width 0.3s ease'
                  }} />
                </Box>

                {/* Buy/Sell percentages */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '0.75rem'
                }}>
                  <Typography 
                    variant="caption" 
                    sx={{ color: 'success.main' }}
                  >
                    {buyPercent.toFixed(0)}%
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ color: 'error.main' }}
                  >
                    {sellPercent.toFixed(0)}%
                  </Typography>
                </Box>
              </Box>
            </TableCell>
          );
        })}

        {/* Price Changes */}
        {Object.entries(timeframes).map(([period, data]) => (
          <TableCell key={`${period}-price`} align="right">
            <Typography sx={{ 
              color: (data.priceChange || 0) >= 0 ? 'success.main' : 'error.main',
              fontWeight: 500
            }}>
              {(data.priceChange || 0) > 0 ? '+' : ''}
              {(data.priceChange || 0)?.toFixed(2)}%
            </Typography>
          </TableCell>
        ))}

        {/* Volume */}
        {Object.entries(timeframes).map(([period, data]) => (
          <TableCell key={`${period}-volume`} align="right">
            <Typography sx={{ fontWeight: 500 }}>
              ${formatNumber(data.volume || 0)}
            </Typography>
          </TableCell>
        ))}

        {/* DEX */}
        <TableCell align="right">
          <Avatar 
            src={pair.dexLogo} 
            alt={pair.dex}
            sx={{ width: 16, height: 16, ml: 'auto' }}
          />
        </TableCell>
      </TableRow>

      {/* Expanded Row */}
      <TableRow>
        <TableCell colSpan={20} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <ExpandedRow pair={pair} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const PairsTable = ({ pairs = [], orderBy, order, page, rowsPerPage, handleSort, handleChangePage, handleChangeRowsPerPage, totalCount, paginationLoading }) => {
  // Calculate the current page's data - since backend handles pagination, just use all pairs
  const displayedPairs = pairs;

  console.log('PairsTable received pairs:', pairs.length);
  console.log('Total count from backend:', totalCount);
  console.log('Current page:', page);
  console.log('Rows per page:', rowsPerPage);
  console.log('Pairs being displayed:', displayedPairs.length);

  return (
    <Box sx={{ position: 'relative' }}>
      <TableContainer
        sx={{
          bgcolor: '#0A1929',
          borderRadius: 2,
          minHeight: '500px',
          '& .MuiTableCell-root': {
            color: 'text.secondary',
          },
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 30 }}></TableCell>
              <TableCell>PAIR</TableCell>
              <TableCell align="right">PRICE $</TableCell>
              <TableCell align="right">TODAY FEES ↗</TableCell>
              <TableCell align="right">TVL</TableCell>
              <TableCell align="right">APR 24H</TableCell>
              <TableCell align="right">5M TX</TableCell>
              <TableCell align="right">1H TX</TableCell>
              <TableCell align="right">6H TX</TableCell>
              <TableCell align="right">24H TX</TableCell>
              <TableCell align="right">5M %</TableCell>
              <TableCell align="right">1H %</TableCell>
              <TableCell align="right">6H %</TableCell>
              <TableCell align="right">24H %</TableCell>
              <TableCell align="right">5M VOL</TableCell>
              <TableCell align="right">1H VOL</TableCell>
              <TableCell align="right">6H VOL</TableCell>
              <TableCell align="right">24H VOL</TableCell>
              <TableCell align="right">DEX</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedPairs.map((pair, index) => (
              <Row 
                key={pair.id || `${page}-${index}`} 
                pair={pair}
                periodData={{
                  '5m': {
                    transactions: pair.transactions5min,
                    priceChange: pair.priceChange5min,
                    volume: pair.volume5min
                  },
                  '1h': {
                    transactions: pair.transactions1h,
                    priceChange: pair.priceChange1h,
                    volume: pair.volume1h
                  },
                  '6h': {
                    transactions: pair.transactions6h,
                    priceChange: pair.priceChange6h,
                    volume: pair.volume6h
                  },
                  '24h': {
                    transactions: pair.transactions24h,
                    priceChange: pair.priceChange24h,
                    volume: pair.volume24h
                  }
                }}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Pagination Loading Overlay */}
      {paginationLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 2,
            zIndex: 1
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={40} sx={{ color: 'primary.main' }} />
            <Typography variant="body2" sx={{ color: 'white' }}>
              Loading page {page + 1}...
            </Typography>
          </Box>
        </Box>
      )}
      
      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        disabled={paginationLoading} // Disable during loading
        sx={{
          color: 'text.secondary',
          '.MuiTablePagination-select': {
            color: 'text.secondary',
          },
          '.MuiTablePagination-selectIcon': {
            color: 'text.secondary',
          },
          '.MuiTablePagination-actions button': {
            opacity: paginationLoading ? 0.5 : 1,
            pointerEvents: paginationLoading ? 'none' : 'auto',
          },
        }}
      />
    </Box>
  );
};

export default PairsTable; 