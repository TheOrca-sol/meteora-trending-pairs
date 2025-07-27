import { Box, Link } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { getMeteoraLink, formatCurrency } from '../../utils/helpers';

export const getColumns = () => [
  {
    id: 'pair',
    label: 'PAIR',
    render: (pair) => ({
      symbol: pair.symbol,
      version: pair.version,
      logoURI: pair.logoURI,
      bin: pair.bin,  // e.g., "BIN 100"
      timeSinceListing: pair.timeSinceListing, // e.g., "11h"
    })
  },
  {
    id: 'price',
    label: 'PRICE $',
    numeric: true,
  },
  {
    id: 'todayFees',
    label: 'TODAY FEES ↗',
    numeric: true,
  },
  {
    id: 'tvl',
    label: 'TVL',
    numeric: true,
  },
  {
    id: 'apr',
    label: 'APR 24h',
    numeric: true,
  },
  // Transaction counts
  {
    id: '5mTx',
    label: '5m Tx',
    numeric: true,
    transactions: true,
  },
  {
    id: '1hTx',
    label: '1h Tx',
    numeric: true,
    transactions: true,
  },
  {
    id: '6hTx',
    label: '6h Tx',
    numeric: true,
    transactions: true,
  },
  {
    id: '24hTx',
    label: '24h Tx',
    numeric: true,
    transactions: true,
  },
  // Price changes
  {
    id: '5mChange',
    label: '5m %',
    numeric: true,
    priceChange: true,
  },
  {
    id: '1hChange',
    label: '1h %',
    numeric: true,
    priceChange: true,
  },
  {
    id: '6hChange',
    label: '6h %',
    numeric: true,
    priceChange: true,
  },
  {
    id: '24hChange',
    label: '24h %',
    numeric: true,
    priceChange: true,
  },
  // Volume
  {
    id: '5mVolume',
    label: '5m Vol',
    numeric: true,
  },
  {
    id: '1hVolume',
    label: '1h Vol',
    numeric: true,
  },
  {
    id: '6hVolume',
    label: '6h Vol',
    numeric: true,
  },
  {
    id: '24hVolume',
    label: '24h Vol',
    numeric: true,
  },
  
  {
    id: 'dex',
    label: 'DEX',
    numeric: true,
    render: (pair) => ({
      logo: pair.dexLogo,
      name: pair.dex
    })
  }
]; 