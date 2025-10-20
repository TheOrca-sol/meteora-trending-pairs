"""
Grouped Pool Data Cache - Phase 2 Implementation
Uses /pair/groups API with two-level caching for better scalability
"""

import logging
import requests
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


class GroupedPoolCache:
    """
    Two-level cache for Meteora pool data using /pair/groups API

    Level 1: Groups cache (1-hour TTL)
    - Fetches list of token pair groups
    - Filters by minimum total TVL
    - Small, infrequent updates

    Level 2: Pools cache (5-min TTL per group)
    - Lazy-loads pools for each group
    - Filters individual pools
    - Only fetches groups that are actually requested
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
        # Level 1: Groups cache
        self.groups_data = None
        self.groups_last_fetch = None
        self.groups_cache_duration = 3600  # 1 hour

        # Level 2: Pools cache (dict of group_id -> pool data)
        self.pools_cache: Dict[str, dict] = {}  # {lexical_order_mints: {data, last_fetch}}
        self.pools_cache_duration = 300  # 5 minutes

        # Filtering configuration
        self.min_group_tvl = 10000  # Minimum total TVL for group ($10K)
        self.min_pool_tvl = 100  # Minimum TVL per pool ($100)
        self.filter_hidden = True
        self.filter_blacklisted = True

        # Threading locks
        self.groups_fetch_lock = threading.Lock()
        self.pools_fetch_locks: Dict[str, threading.Lock] = {}

        # Statistics
        self.stats = {
            'groups_cache_hits': 0,
            'groups_cache_misses': 0,
            'pools_cache_hits': 0,
            'pools_cache_misses': 0,
            'total_groups_fetched': 0,
            'total_groups_filtered': 0,
            'total_pools_fetched': 0,
            'groups_loaded': 0,  # Number of groups with pools in cache
            'last_groups_fetch_duration': 0,
            'last_pools_fetch_duration': 0
        }

        logger.info(
            "GroupedPoolCache initialized "
            f"(min_group_tvl=${self.min_group_tvl}, min_pool_tvl=${self.min_pool_tvl})"
        )

    def get_pools(self, force_refresh=False, limit=None) -> List[dict]:
        """
        Get aggregated pools from all active groups

        Args:
            force_refresh: Force refresh of groups cache
            limit: Max number of groups to load pools from (for performance)

        Returns:
            List of pool dictionaries
        """
        # Step 1: Get filtered groups
        groups = self._get_groups(force_refresh=force_refresh)

        if not groups:
            return []

        # Step 2: Limit groups if specified (for performance)
        if limit:
            groups = groups[:limit]

        # Step 3: Fetch pools for each group (lazy loading)
        all_pools = []
        for group in groups:
            group_id = group['lexical_order_mints']
            pools = self._get_group_pools(group_id, force_refresh=force_refresh)
            if pools:
                all_pools.extend(pools)

        logger.info(
            f"Aggregated {len(all_pools)} pools from {len(groups)} groups "
            f"({self.stats['groups_loaded']} groups loaded in cache)"
        )

        return all_pools

    def _get_groups(self, force_refresh=False) -> List[dict]:
        """
        Get and filter token pair groups

        Returns:
            List of group dictionaries sorted by total_tvl desc
        """
        now = datetime.utcnow()

        # Check cache freshness
        if not force_refresh and self._is_groups_cache_fresh(now):
            self.stats['groups_cache_hits'] += 1
            cache_age = (now - self.groups_last_fetch).seconds
            logger.info(f"Groups cache HIT (age: {cache_age}s, {len(self.groups_data)} groups)")
            return self.groups_data

        # Fetch fresh groups
        return self._fetch_fresh_groups(now)

    def _is_groups_cache_fresh(self, now) -> bool:
        """Check if groups cache is still fresh"""
        if self.groups_data is None or self.groups_last_fetch is None:
            return False

        age_seconds = (now - self.groups_last_fetch).total_seconds()
        return age_seconds < self.groups_cache_duration

    def _fetch_fresh_groups(self, now) -> List[dict]:
        """Fetch and filter groups from /pair/groups API"""
        with self.groups_fetch_lock:
            # Double-check after acquiring lock
            if self._is_groups_cache_fresh(now):
                self.stats['groups_cache_hits'] += 1
                return self.groups_data

            self.stats['groups_cache_misses'] += 1

            try:
                logger.info("Groups cache MISS - Fetching from /pair/groups...")
                fetch_start = datetime.utcnow()

                # Fetch all groups with pagination
                all_groups = []
                page = 1
                page_size = 100

                while True:
                    response = requests.get(
                        'https://dlmm-api.meteora.ag/pair/groups',
                        params={'page': page, 'page_size': page_size},
                        timeout=30
                    )
                    response.raise_for_status()

                    data = response.json()
                    groups = data.get('data', [])

                    if not groups:
                        break

                    all_groups.extend(groups)

                    # Check if we have more pages
                    total_pages = data.get('pages', 1)
                    if page >= total_pages:
                        break

                    page += 1
                    logger.info(f"Fetched groups page {page}/{total_pages}...")

                self.stats['total_groups_fetched'] = len(all_groups)

                # Filter groups by minimum TVL
                filtered_groups = self._filter_groups(all_groups)

                # Sort by total TVL descending (most active first)
                filtered_groups.sort(
                    key=lambda g: float(g.get('total_tvl', 0)),
                    reverse=True
                )

                self.groups_data = filtered_groups
                self.groups_last_fetch = now
                self.stats['total_groups_filtered'] = len(filtered_groups)
                self.stats['last_groups_fetch_duration'] = (
                    datetime.utcnow() - fetch_start
                ).total_seconds()

                logger.info(
                    f"✅ Fetched and filtered groups: "
                    f"{self.stats['total_groups_fetched']} → {len(filtered_groups)} groups "
                    f"(took {self.stats['last_groups_fetch_duration']:.2f}s)"
                )

                return self.groups_data

            except requests.RequestException as e:
                logger.error(f"Failed to fetch groups: {e}")

                # Return stale cache if available
                if self.groups_data:
                    logger.warning("Returning stale groups cache")
                    return self.groups_data

                raise

    def _filter_groups(self, groups: List[dict]) -> List[dict]:
        """Filter groups by minimum total TVL"""
        if not groups:
            return []

        filtered = [
            g for g in groups
            if float(g.get('total_tvl', 0)) >= self.min_group_tvl
        ]

        filtered_out = len(groups) - len(filtered)
        logger.info(
            f"Filtered groups: {len(groups)} → {len(filtered)} "
            f"(removed {filtered_out} with TVL < ${self.min_group_tvl})"
        )

        return filtered

    def _get_group_pools(self, group_id: str, force_refresh=False) -> List[dict]:
        """
        Get pools for a specific group (lazy loaded with caching)

        Args:
            group_id: lexical_order_mints identifier
            force_refresh: Force refresh of this group's pools

        Returns:
            List of pool dictionaries for this group
        """
        now = datetime.utcnow()

        # Check if pools are cached and fresh
        if not force_refresh and group_id in self.pools_cache:
            cache_entry = self.pools_cache[group_id]
            age_seconds = (now - cache_entry['last_fetch']).total_seconds()

            if age_seconds < self.pools_cache_duration:
                self.stats['pools_cache_hits'] += 1
                return cache_entry['data']

        # Fetch fresh pools for this group
        return self._fetch_group_pools(group_id, now)

    def _fetch_group_pools(self, group_id: str, now) -> List[dict]:
        """Fetch and filter pools for a specific group"""
        # Get or create lock for this group
        if group_id not in self.pools_fetch_locks:
            self.pools_fetch_locks[group_id] = threading.Lock()

        with self.pools_fetch_locks[group_id]:
            # Double-check after acquiring lock
            if group_id in self.pools_cache:
                cache_entry = self.pools_cache[group_id]
                age_seconds = (now - cache_entry['last_fetch']).total_seconds()

                if age_seconds < self.pools_cache_duration:
                    self.stats['pools_cache_hits'] += 1
                    return cache_entry['data']

            self.stats['pools_cache_misses'] += 1

            try:
                fetch_start = datetime.utcnow()

                # Fetch all pools for this group with pagination
                all_pools = []
                page = 1
                page_size = 100

                while True:
                    response = requests.get(
                        f'https://dlmm-api.meteora.ag/pair/groups/{group_id}',
                        params={'page': page, 'page_size': page_size},
                        timeout=30
                    )
                    response.raise_for_status()

                    data = response.json()
                    pools = data.get('data', [])

                    if not pools:
                        break

                    all_pools.extend(pools)

                    # Check if we have more pages
                    total_pages = data.get('pages', 1)
                    if page >= total_pages:
                        break

                    page += 1

                # Filter pools (hide, blacklisted, min TVL)
                filtered_pools = self._filter_pools(all_pools)

                # Cache the result
                self.pools_cache[group_id] = {
                    'data': filtered_pools,
                    'last_fetch': now
                }

                self.stats['total_pools_fetched'] += len(all_pools)
                self.stats['groups_loaded'] = len(self.pools_cache)
                self.stats['last_pools_fetch_duration'] = (
                    datetime.utcnow() - fetch_start
                ).total_seconds()

                logger.debug(
                    f"Fetched group {group_id}: {len(all_pools)} → {len(filtered_pools)} pools "
                    f"(took {self.stats['last_pools_fetch_duration']:.2f}s)"
                )

                return filtered_pools

            except requests.RequestException as e:
                logger.error(f"Failed to fetch pools for group {group_id}: {e}")

                # Return stale cache if available
                if group_id in self.pools_cache:
                    logger.warning(f"Returning stale cache for group {group_id}")
                    return self.pools_cache[group_id]['data']

                return []

    def _filter_pools(self, pools: List[dict]) -> List[dict]:
        """Filter pools by hide, blacklist, and min TVL"""
        if not pools:
            return []

        filtered = []
        for pool in pools:
            # Check hide flag
            if self.filter_hidden and pool.get('hide', False):
                continue

            # Check blacklist flag
            if self.filter_blacklisted and pool.get('is_blacklisted', False):
                continue

            # Check minimum TVL
            try:
                tvl = float(pool.get('liquidity', 0))
                if tvl < self.min_pool_tvl:
                    continue
            except (ValueError, TypeError):
                continue

            filtered.append(pool)

        return filtered

    def get_stats(self) -> dict:
        """Get cache statistics"""
        total_groups_requests = (
            self.stats['groups_cache_hits'] + self.stats['groups_cache_misses']
        )
        groups_hit_rate = (
            (self.stats['groups_cache_hits'] / total_groups_requests * 100)
            if total_groups_requests > 0 else 0
        )

        total_pools_requests = (
            self.stats['pools_cache_hits'] + self.stats['pools_cache_misses']
        )
        pools_hit_rate = (
            (self.stats['pools_cache_hits'] / total_pools_requests * 100)
            if total_pools_requests > 0 else 0
        )

        return {
            **self.stats,
            'total_groups_requests': total_groups_requests,
            'groups_hit_rate_percent': round(groups_hit_rate, 2),
            'total_pools_requests': total_pools_requests,
            'pools_hit_rate_percent': round(pools_hit_rate, 2),
            'groups_cache_fresh': self._is_groups_cache_fresh(datetime.utcnow()),
            'groups_cache_age_seconds': (
                (datetime.utcnow() - self.groups_last_fetch).total_seconds()
                if self.groups_last_fetch else None
            )
        }

    def invalidate_groups(self):
        """Manually invalidate groups cache"""
        logger.info("Groups cache invalidated")
        self.groups_data = None
        self.groups_last_fetch = None

    def invalidate_group_pools(self, group_id: str = None):
        """Manually invalidate pools cache for a group or all groups"""
        if group_id:
            if group_id in self.pools_cache:
                del self.pools_cache[group_id]
                logger.info(f"Pools cache invalidated for group {group_id}")
        else:
            self.pools_cache.clear()
            logger.info("All pools cache invalidated")

    def invalidate_all(self):
        """Invalidate all caches"""
        self.invalidate_groups()
        self.invalidate_group_pools()


# Global singleton instance
grouped_pool_cache = GroupedPoolCache()


# Convenience function
def get_grouped_cached_pools(force_refresh=False, limit=None) -> List[dict]:
    """
    Get pool data from grouped cache

    Args:
        force_refresh: Force refresh of groups cache
        limit: Max number of groups to load (for performance)

    Returns:
        List of pool data
    """
    return grouped_pool_cache.get_pools(force_refresh=force_refresh, limit=limit)
