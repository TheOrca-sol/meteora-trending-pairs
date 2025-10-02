import Decimal from 'decimal.js';

/**
 * Format number for display
 */
export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0.00';
  }

  const value = new Decimal(num);

  if (value.abs().gte(1000000)) {
    return value.div(1000000).toFixed(decimals) + 'M';
  } else if (value.abs().gte(1000)) {
    return value.div(1000).toFixed(decimals) + 'K';
  } else {
    return value.toFixed(decimals);
  }
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(oldValue, newValue) {
  if (!oldValue || oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate impermanent loss
 */
export function calculateImpermanentLoss(priceRatio) {
  // IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
  const ratio = new Decimal(priceRatio);
  const numerator = new Decimal(2).mul(ratio.sqrt());
  const denominator = new Decimal(1).add(ratio);
  return numerator.div(denominator).sub(1).mul(100).toNumber();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retry(fn, maxAttempts = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await sleep(delayMs * Math.pow(2, attempt - 1));
    }
  }
}

/**
 * Calculate bin range based on volatility
 */
export function calculateBinRange(binStep, volatility, strategy) {
  const baseRange = Math.ceil(volatility * 10);

  switch (strategy) {
    case 'curve':
      return Math.max(5, Math.floor(baseRange * 0.5)); // Tighter range
    case 'spot':
      return Math.max(10, baseRange); // Normal range
    case 'bidask':
      return Math.max(20, Math.floor(baseRange * 1.5)); // Wider range
    default:
      return 10;
  }
}

/**
 * Safe division
 */
export function safeDivide(numerator, denominator, defaultValue = 0) {
  if (!denominator || denominator === 0) return defaultValue;
  return new Decimal(numerator).div(denominator).toNumber();
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports) {
  return new Decimal(lamports).div(1e9).toNumber();
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol) {
  return new Decimal(sol).mul(1e9).floor().toNumber();
}

/**
 * Parse error message from various sources
 */
export function parseError(error) {
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  if (error.error?.message) return error.error.message;
  return 'Unknown error';
}

/**
 * Check if value is within percentage threshold
 */
export function isWithinThreshold(value, target, thresholdPercent) {
  const diff = Math.abs(value - target);
  const threshold = target * (thresholdPercent / 100);
  return diff <= threshold;
}

export default {
  formatNumber,
  calculatePercentChange,
  calculateImpermanentLoss,
  sleep,
  retry,
  calculateBinRange,
  safeDivide,
  clamp,
  lamportsToSol,
  solToLamports,
  parseError,
  isWithinThreshold,
};
