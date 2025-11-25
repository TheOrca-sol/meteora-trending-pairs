import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Collapse,
  IconButton,
  Box,
  Avatar,
  Typography,
  StepIcon,
  CircularProgress,
  Backdrop,
  Card,
  CardContent,
  Chip,
  useMediaQuery
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { getColumns } from './columns';
import { trackUserInteraction } from '../../utils/analytics';
import ExpandedRow from './ExpandedRow';
import { TrendingUp as TrendingUpIcon, TrendingDown as TrendingDownIcon, AttachMoney as AttachMoneyIcon, CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getPairXToken, formatNumber, formatPrice } from '../../utils/helpers';
import axios from 'axios';

const Row = ({ pair, periodData }) => {
  const [open, setOpen] = useState(false);
  const [pairData, setPairData] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const pairXToken = React.useMemo(() => getPairXToken(pair), [pair.mint_x, pair.mint_y]);

  // Only fetch data when row is expanded for the first time
  useEffect(() => {
    if (!open || hasFetched || !pair.address || !pairXToken?.address) {
      return;
    }

    const abortController = new AbortController();
    const fetchPairData = async () => {
      setIsLoading(true);
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('Fetching pair data for:', pair.address, 'pairXToken:', pairXToken);
        }

        const [dexScreenerResponse, jupiterResponse] = await Promise.all([
          axios.get(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair.address}`, {
            signal: abortController.signal
          }),
          axios.get(`https://lite-api.jup.ag/tokens/v2/search?query=${pairXToken?.address}`, {
            signal: abortController.signal
          })
        ]);

        if (process.env.NODE_ENV === 'development') {
          console.log('DexScreener response:', dexScreenerResponse.data);
          console.log('Jupiter response:', jupiterResponse.data);
        }

        const dexScreenerData = dexScreenerResponse.data.pairs?.[0];
        const jupiterData = jupiterResponse.data?.[0]; // v2 returns an array

        if (dexScreenerData) {
          setPairData(dexScreenerData);
        }
        if (jupiterData) {
          setTokenInfo(jupiterData);
        }
        setHasFetched(true);
      } catch (err) {
        if (err.name !== 'CanceledError') {
          console.error('Error fetching data for pair:', pair.address, 'Error:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPairData();

    return () => {
      abortController.abort();
    };
  }, [open, hasFetched, pair.address, pairXToken?.address]);

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
  const volume30m = pairData?.volume?.m30 || pair.volume30min || 0;
  const feePercentage = pair.baseFee || 0.3; // Use backend baseFee
  // Always use Meteora's actual 24h fees from backend (more accurate than calculated)
  const dailyFees = pair.fees24h || 0;
  // Use backend 30min fees if available, otherwise calculate from volume
  const thirtyMinFees = pair.fees30min || (volume30m * (feePercentage / 100));

  // Calculate 30min fee rate (30min fees / TVL as percentage)
  const tvl = pairData?.liquidity?.usd || tokenInfo?.liquidity || pair.totalLiquidity || 0;
  const feeRate30min = tvl > 0 ? ((thirtyMinFees / tvl) * 100) : 0;

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

  // Add debug logging (development only)
  if (process.env.NODE_ENV === 'development') {
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
  }

  // Don't return null - always show the row, even if DexScreener data is loading
  // if (!pairData) return null;

  // Mobile Card View
  if (isMobile) {
    return (
      <Box sx={{ mb: 2 }}>
        <Card
          sx={{
            bgcolor: pair.is_blacklisted ? 'error.lighter' : 'background.paper',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
            }
          }}
          onClick={handleRowClick}
        >
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {/* Header with Pair Name and Expand Button */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar
                    src={pairData?.baseToken?.logoURI || tokenInfo?.logoURI}
                    alt={pairData?.baseToken?.symbol || tokenInfo?.symbol}
                    sx={{ width: 32, height: 32 }}
                  />
                  <Avatar
                    src={pairData?.quoteToken?.logoURI}
                    alt={pairData?.quoteToken?.symbol}
                    sx={{
                      width: 32,
                      height: 32,
                      ml: -1
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {pairData?.baseToken?.symbol || pair.pairName?.split('-')[0] || 'Unknown'}-{pairData?.quoteToken?.symbol || pair.pairName?.split('-')[1] || 'SOL'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.25 }}>
                    Created {formatTimeAgo(pairData?.pairCreatedAt)} ago
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    <Chip label="DLMM" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                    <Chip label={`${pair.binStep} Bin`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                    <Chip label={`${Number(pair.baseFee || 0).toFixed(2)}% Fee`} size="small" color="info" sx={{ height: 20, fontSize: '0.7rem' }} />
                  </Box>
                </Box>
              </Box>
              <IconButton
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <KeyboardArrowDownIcon
                  sx={{
                    transform: open ? 'rotate(180deg)' : 'none',
                    transition: '0.2s'
                  }}
                />
              </IconButton>
            </Box>

            {/* Stats Grid */}
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
            }}>
              {/* Price */}
              <Box>
                <Typography variant="caption" color="text.secondary">Price</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                  ${formatPrice(pairData?.priceUsd || tokenInfo?.usdPrice || pair?.price || 0)}
                </Typography>
              </Box>

              {/* 24h Fees */}
              <Box>
                <Typography variant="caption" color="text.secondary">24h Fees</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                  ${formatNumber(dailyFees || pair?.fees24h || 0)}
                </Typography>
              </Box>

              {/* TVL */}
              <Box>
                <Typography variant="caption" color="text.secondary">TVL</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  ${formatNumber(pairData?.liquidity?.usd || tokenInfo?.liquidity || pair?.totalLiquidity || 0)}
                </Typography>
              </Box>

              {/* Fee Rate */}
              <Box>
                <Typography variant="caption" color="text.secondary">30m Fee Rate</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                  {feeRate30min.toFixed(4)}%
                </Typography>
              </Box>
            </Box>
          </CardContent>

          {/* Expanded Content */}
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
              <ExpandedRow pair={pair} timeframes={timeframes} calculateTxnStats={calculateTxnStats} />
            </Box>
          </Collapse>
        </Card>
      </Box>
    );
  }

  // Desktop Table View
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

        {/* 30min Fee Rate */}
        <TableCell align="right">
          <Typography sx={{
            fontWeight: 500,
            color: 'success.main'
          }}>
            {feeRate30min.toFixed(4)}%
          </Typography>
        </TableCell>
      </TableRow>

      {/* Expanded Row */}
      <TableRow>
        <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <ExpandedRow pair={pair} timeframes={timeframes} calculateTxnStats={calculateTxnStats} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const PairsTable = ({ pairs = [], orderBy, order, handleSort }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (process.env.NODE_ENV === 'development') {
    console.log('PairsTable received pairs:', pairs.length);
  }

  // Empty state
  if (pairs.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          p: 4,
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
          No pairs found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Try adjusting your filters to see more results
        </Typography>
      </Box>
    );
  }

  // Mobile Card Layout
  if (isMobile) {
    return (
      <Box sx={{ px: 1 }}>
        {pairs.map((pair, index) => (
          <Row
            key={pair.id || `pair-${index}`}
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
      </Box>
    );
  }

  // Desktop Table Layout
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
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'fees_24h'}
                  direction={orderBy === 'fees_24h' ? order : 'desc'}
                  onClick={() => handleSort('fees_24h')}
                >
                  TODAY FEES
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'liquidity'}
                  direction={orderBy === 'liquidity' ? order : 'desc'}
                  onClick={() => handleSort('liquidity')}
                >
                  TVL
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={orderBy === 'fee_rate_30min'}
                  direction={orderBy === 'fee_rate_30min' ? order : 'desc'}
                  onClick={() => handleSort('fee_rate_30min')}
                >
                  30M FEE RATE
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pairs.map((pair, index) => (
              <Row
                key={pair.id || `pair-${index}`}
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
    </Box>
  );
};

// PropTypes for Row component
Row.propTypes = {
  pair: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    address: PropTypes.string,
    pairName: PropTypes.string,
    mint_x: PropTypes.string,
    mint_y: PropTypes.string,
    binStep: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    baseFee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fees24h: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    fees30min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    totalLiquidity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    volume30min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    is_blacklisted: PropTypes.bool,
  }).isRequired,
  periodData: PropTypes.object,
};

// PropTypes for PairsTable component
PairsTable.propTypes = {
  pairs: PropTypes.arrayOf(PropTypes.object),
  orderBy: PropTypes.string,
  order: PropTypes.oneOf(['asc', 'desc']),
  handleSort: PropTypes.func.isRequired,
};

PairsTable.defaultProps = {
  pairs: [],
  orderBy: 'fee_rate_30min',
  order: 'desc',
};

export default PairsTable; 