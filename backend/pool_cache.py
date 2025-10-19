"""
Shared Pool Data Cache
Prevents redundant API calls to Meteora by caching pool data
Critical for scalability with multiple concurrent users
"""

import logging
import requests
import threading
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class PoolDataCache:
    """
    Singleton cache for Meteora pool data
    Fetches once and shares across all monitoring checks
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize cache state"""
        self.pools_data = None
        self.last_fetch = None
        self.cache_duration_seconds = 300  # 5 minutes
        self.fetch_lock = threading.Lock()
        self.stats = {
            'cache_hits': 0,
            'cache_misses': 0,
            'total_pools': 0,
            'last_fetch_duration': 0
        }
        logger.info("PoolDataCache initialized")

    def get_pools(self, force_refresh=False):
        """
        Get pool data from cache or fetch if stale

        Args:
            force_refresh: Force a fresh fetch even if cache is valid

        Returns:
            list: Pool data from Meteora API
        """
        now = datetime.utcnow()

        # Check if cache is fresh (unless forced refresh)
        if not force_refresh and self._is_cache_fresh(now):
            self.stats['cache_hits'] += 1
            cache_age = (now - self.last_fetch).seconds
            logger.info(f"Cache HIT - Returning {len(self.pools_data)} cached pools (age: {cache_age}s)")
            return self.pools_data

        # Need to fetch fresh data
        return self._fetch_fresh_data(now)

    def _is_cache_fresh(self, now):
        """Check if cached data is still fresh"""
        if self.pools_data is None or self.last_fetch is None:
            return False

        age_seconds = (now - self.last_fetch).total_seconds()
        return age_seconds < self.cache_duration_seconds

    def _fetch_fresh_data(self, now):
        """Fetch fresh pool data from Meteora API"""
        # Use lock to prevent multiple simultaneous fetches
        with self.fetch_lock:
            # Double-check - another thread might have just fetched
            if self._is_cache_fresh(now):
                self.stats['cache_hits'] += 1
                return self.pools_data

            self.stats['cache_misses'] += 1

            try:
                logger.info("Cache MISS - Fetching fresh pool data from Meteora API...")
                fetch_start = datetime.utcnow()

                response = requests.get(
                    'https://dlmm-api.meteora.ag/pair/all',
                    timeout=30
                )
                response.raise_for_status()

                self.pools_data = response.json()
                self.last_fetch = now
                self.stats['total_pools'] = len(self.pools_data)
                self.stats['last_fetch_duration'] = (datetime.utcnow() - fetch_start).total_seconds()

                logger.info(
                    f"✅ Fetched {len(self.pools_data)} pools from Meteora "
                    f"(took {self.stats['last_fetch_duration']:.2f}s)"
                )

                return self.pools_data

            except requests.RequestException as e:
                logger.error(f"Failed to fetch pool data from Meteora: {e}")

                # Return stale cache if available (better than nothing)
                if self.pools_data:
                    logger.warning("Returning stale cache data due to fetch failure")
                    return self.pools_data

                raise

    def get_stats(self):
        """Get cache statistics"""
        total_requests = self.stats['cache_hits'] + self.stats['cache_misses']
        hit_rate = (self.stats['cache_hits'] / total_requests * 100) if total_requests > 0 else 0

        return {
            **self.stats,
            'total_requests': total_requests,
            'hit_rate_percent': round(hit_rate, 2),
            'cache_fresh': self._is_cache_fresh(datetime.utcnow()),
            'cache_age_seconds': (datetime.utcnow() - self.last_fetch).total_seconds() if self.last_fetch else None
        }

    def invalidate(self):
        """Manually invalidate the cache"""
        logger.info("Cache invalidated")
        self.pools_data = None
        self.last_fetch = None


# Global singleton instance
pool_cache = PoolDataCache()


# Convenience function
def get_cached_pools(force_refresh=False):
    """
    Get pool data from shared cache

    Args:
        force_refresh: Force a fresh fetch

    Returns:
        list: Pool data
    """
    return pool_cache.get_pools(force_refresh=force_refresh)
