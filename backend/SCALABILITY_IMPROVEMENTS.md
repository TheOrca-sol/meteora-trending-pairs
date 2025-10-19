# Scalability Improvements for 1000+ Users

## Current Bottlenecks

### 1. Meteora API Calls
- **Problem**: Each user fetches all pools independently
- **Impact**: 1000 users = 4,000 API calls/hour
- **Solution**: Shared cache

### 2. Redundant Processing
- **Problem**: Same pools analyzed 1000 times
- **Impact**: High CPU usage, slow responses
- **Solution**: Batch processing

### 3. Database Growth
- **Problem**: 96,000 snapshots/day at 1000 users
- **Impact**: Storage costs, slow queries
- **Solution**: Cleanup old snapshots

## Proposed Architecture

### Phase 1: Shared Cache (Immediate - Critical)

```python
class PoolCache:
    """Global pool cache - fetch once, share with all users"""

    def __init__(self):
        self.pools_data = None
        self.last_fetch = None
        self.cache_duration = 300  # 5 minutes
        self.lock = threading.Lock()

    def get_pools(self):
        """Get pools from cache or fetch if stale"""
        with self.lock:
            now = datetime.now()

            # Return cached if fresh
            if (self.pools_data and self.last_fetch and
                (now - self.last_fetch).seconds < self.cache_duration):
                logger.info(f"Returning cached pools ({len(self.pools_data)} pools)")
                return self.pools_data

            # Fetch fresh data
            logger.info("Fetching fresh pool data from Meteora...")
            response = requests.get('https://dlmm-api.meteora.ag/pair/all')
            self.pools_data = response.json()
            self.last_fetch = now

            return self.pools_data

# Global instance
pool_cache = PoolCache()
```

**Benefits:**
- 1000 users → 1 API call per 5 minutes (instead of 1000)
- 99.9% reduction in API calls
- Much faster (cache hit vs network call)

### Phase 2: Batch Check Processing

Instead of individual checks, batch users with similar settings:

```python
def batch_check_opportunities():
    """Check opportunities for all users in batches"""

    # Fetch pools ONCE for all users
    all_pools = pool_cache.get_pools()

    # Group users by similar whitelists
    user_groups = group_users_by_whitelist()

    for group in user_groups:
        # Filter pools once for the whole group
        relevant_pools = filter_pools(all_pools, group['tokens'])

        # Process each user in the group
        for user in group['users']:
            analyze_for_user(user, relevant_pools)
```

**Benefits:**
- Filter pools once per group instead of per user
- Reduce redundant calculations
- Better CPU utilization

### Phase 3: Smart Scheduling

Stagger checks across the interval:

```python
def schedule_user_checks():
    """Distribute checks evenly across the interval"""

    interval = 15  # minutes
    total_users = len(active_users)

    # Stagger checks
    delay_per_user = (interval * 60) / total_users

    for i, user in enumerate(active_users):
        # Each user offset by few seconds
        offset_seconds = int(i * delay_per_user)

        scheduler.add_job(
            func=check_opportunities,
            trigger='interval',
            minutes=interval,
            args=[user],
            next_run_time=datetime.now() + timedelta(seconds=offset_seconds)
        )
```

**Benefits:**
- Smooth out load (not all 1000 at once)
- Better resource utilization
- Avoid rate limits

### Phase 4: Database Optimization

**1. Cleanup Old Snapshots**
```python
def cleanup_old_snapshots():
    """Keep only recent snapshots"""
    # Keep last 10 snapshots per user (2.5 hours at 15min intervals)
    db.execute("""
        DELETE FROM opportunity_snapshots
        WHERE id NOT IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY wallet_address
                    ORDER BY created_at DESC
                ) as rn
                FROM opportunity_snapshots
            ) t WHERE rn <= 10
        )
    """)
```

**2. Index Optimization**
```sql
-- Add composite index for faster queries
CREATE INDEX idx_snapshots_wallet_created
ON opportunity_snapshots(wallet_address, created_at DESC);

-- Add partial index for active users
CREATE INDEX idx_active_monitors
ON monitoring_configs(wallet_address)
WHERE enabled = TRUE;
```

**3. Archive Strategy**
```python
# Move old snapshots to archive table
CREATE TABLE opportunity_snapshots_archive (
    LIKE opportunity_snapshots
);

# Monthly job to archive old data
INSERT INTO opportunity_snapshots_archive
SELECT * FROM opportunity_snapshots
WHERE created_at < NOW() - INTERVAL '7 days';

DELETE FROM opportunity_snapshots
WHERE created_at < NOW() - INTERVAL '7 days';
```

### Phase 5: Rate Limiting & Throttling

```python
from ratelimit import limits, sleep_and_retry

@sleep_and_retry
@limits(calls=100, period=60)  # Max 100 checks per minute
def check_opportunities(wallet_address):
    """Rate-limited opportunity check"""
    # ... existing logic
```

## Implementation Priority

### Immediate (Must Do for >100 users):
1. ✅ **Shared Pool Cache** - Reduces API calls by 99%
2. ✅ **Staggered Scheduling** - Prevents all users checking at once
3. ✅ **Snapshot Cleanup** - Prevents database bloat

### Short Term (Before 500 users):
4. **Batch Processing** - Group similar users
5. **Database Indexes** - Optimize queries
6. **Connection Pooling** - Already have with Supabase

### Long Term (Before 1000+ users):
7. **Background Workers** - Separate process pool for checks
8. **Redis Cache** - Faster than in-memory for multiple servers
9. **CDN for Static Data** - Cache pool metadata
10. **Horizontal Scaling** - Multiple backend servers

## Estimated Performance

### Current Architecture:
- Max users: ~50 before slowdown
- API calls: 4,000/hour at 1000 users
- Check time: ~5-10 seconds per user

### With Phase 1-3 Improvements:
- Max users: ~5,000 before slowdown
- API calls: ~12/hour (shared cache)
- Check time: ~1-2 seconds per user
- Database: Auto-cleanup old data

### With All Improvements:
- Max users: 50,000+
- API calls: ~12/hour (99.97% reduction)
- Check time: <1 second per user
- Scalable architecture

## Monitoring Metrics

Track these to know when to scale:

```python
# Add to monitoring
metrics = {
    'active_users': len(active_monitors),
    'checks_per_minute': counter,
    'avg_check_duration': avg_time,
    'cache_hit_rate': hits / total,
    'db_snapshot_count': snapshot_count,
    'api_calls_saved': saved_calls
}
```

## Quick Win Implementation

The EASIEST and MOST EFFECTIVE improvement:

```python
# monitoring_service.py - Add this
class PoolDataCache:
    _instance = None
    _pools = None
    _last_fetch = None

    @classmethod
    def get_pools(cls):
        now = datetime.utcnow()

        # Cache for 5 minutes
        if cls._pools and cls._last_fetch:
            if (now - cls._last_fetch).seconds < 300:
                return cls._pools

        # Fetch fresh
        response = requests.get('https://dlmm-api.meteora.ag/pair/all')
        cls._pools = response.json()
        cls._last_fetch = now
        return cls._pools

# In _fetch_opportunities, use cache instead of direct call
pools = PoolDataCache.get_pools()
```

This ONE change reduces API load by 99% immediately.
