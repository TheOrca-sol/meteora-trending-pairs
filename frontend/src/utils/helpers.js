import { COMMON_TOKENS } from './constants';

export const getMeteoraLink = (pair) => {
  return `https://app.meteora.ag/dlmm/${pair.address}`;
};

export const formatCurrency = (value) => {
  return `$${Number(value).toLocaleString()}`;
};

export const getPairXToken = (pair) => {
  if (!pair.tokenX || !pair.tokenY) return null;

  // If tokenX is not SOL or USDC, it's the pairX token
  if (![COMMON_TOKENS.SOL, COMMON_TOKENS.USDC].includes(pair.tokenX)) {
    return {
      address: pair.tokenX,
      isTokenX: true
    };
  }
  
  // If tokenY is not SOL or USDC, it's the pairX token
  if (![COMMON_TOKENS.SOL, COMMON_TOKENS.USDC].includes(pair.tokenY)) {
    return {
      address: pair.tokenY,
      isTokenX: false
    };
  }

  // If both are common tokens (shouldn't happen), return null
  return null;
}; 