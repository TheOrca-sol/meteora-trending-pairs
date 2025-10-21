import { COMMON_TOKENS } from './constants';

export const getMeteoraLink = (pair) => {
  return `https://app.meteora.ag/dlmm/${pair.address}`;
};

export const formatCurrency = (value) => {
  return `$${Number(value).toLocaleString()}`;
};

/**
 * Format a number with K/M suffixes for large values
 * @param {number|string} num - Number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
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

/**
 * Format a price with appropriate decimal places
 * @param {number|string} price - Price to format
 * @returns {string} Formatted price string
 */
export const formatPrice = (price) => {
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