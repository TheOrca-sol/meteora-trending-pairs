import { COMMON_TOKENS } from './constants';

export const getMeteoraLink = (pair) => {
  return `https://app.meteora.ag/dlmm/${pair.address}`;
};

export const formatCurrency = (value) => {
  return `$${Number(value).toLocaleString()}`;
};

export const getPairXToken = (pair) => {
  // Use mint_x and mint_y from backend instead of tokenX and tokenY
  if (!pair.mint_x || !pair.mint_y) return null;

  // If mint_x is not SOL or USDC, it's the pairX token
  if (![COMMON_TOKENS.SOL, COMMON_TOKENS.USDC].includes(pair.mint_x)) {
    return {
      address: pair.mint_x,
      isTokenX: true
    };
  }
  
  // If mint_y is not SOL or USDC, it's the pairX token
  if (![COMMON_TOKENS.SOL, COMMON_TOKENS.USDC].includes(pair.mint_y)) {
    return {
      address: pair.mint_y,
      isTokenX: false
    };
  }

  // If both are common tokens (shouldn't happen), return null
  return null;
}; 