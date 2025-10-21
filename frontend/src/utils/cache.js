// Simple cache utility with stale-while-revalidate pattern
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Generate a cache key based on request parameters
 */
export const generateCacheKey = (params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  return `pairs_cache_${JSON.stringify(sortedParams)}`;
};

/**
 * Get cached data if available and not expired
 * Returns { data, isStale } where isStale indicates if data should be refreshed
 */
export const getCachedData = (cacheKey) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) {
      return { data: null, isStale: false };
    }

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    const isStale = age > CACHE_DURATION;

    return { data, isStale };
  } catch (error) {
    console.error('Error reading from cache:', error);
    return { data: null, isStale: false };
  }
};

/**
 * Store data in cache with current timestamp
 */
export const setCachedData = (cacheKey, data) => {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.error('Error writing to cache:', error);
    // If localStorage is full, try to clear old cache entries
    clearOldCache();
  }
};

/**
 * Clear cache entries older than CACHE_DURATION
 */
export const clearOldCache = () => {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach((key) => {
      if (key.startsWith('pairs_cache_')) {
        try {
          const cached = JSON.parse(localStorage.getItem(key));
          if (cached && now - cached.timestamp > CACHE_DURATION) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid cache entry, remove it
          localStorage.removeItem(key);
        }
      }
    });
  } catch (error) {
    console.error('Error clearing old cache:', error);
  }
};

/**
 * Clear all cache entries
 */
export const clearAllCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith('pairs_cache_')) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
};
