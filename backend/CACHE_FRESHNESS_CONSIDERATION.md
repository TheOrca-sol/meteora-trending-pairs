# Cache Freshness vs Scalability Trade-off

## Issue Summary

The Shared Pool Cache provides excellent scalability (99% API reduction) but creates a data freshness concern for the analytics table where LPs make real-time decisions.

## The Problem

### Current Setup:
- **Cache TTL:** 5 minutes (300 seconds)
- **All endpoints use same cache:** Analytics, Positions, Opportunities, Monitoring

### Analytics Table Concern:
- **User Expectation:** Fresh, real-time data for LP decisions
- **Current Reality:** Data can be up to 5 minutes old
- **Risk:** LPs making decisions on stale pool metrics (fees, volume, TVL, APR)
- **Impact:** Pool conditions can change significantly in 5 minutes

### Example Scenario:
```
Time 0:00 - User loads analytics page (Cache MISS - fetches fresh data)
Time 0:30 - User refreshes page (Cache HIT - sees same data from 0:00)
Time 2:00 - User refreshes again (Cache HIT - STILL seeing data from 0:00)
Time 5:01 - User refreshes (Cache expired - finally gets fresh data)
```

In high-volatility periods, 5-minute-old data could show:
- Outdated fee rates
- Incorrect volume metrics
- Stale liquidity levels
- Wrong APR calculations

## Current Implementation (Temporary Solution)

### ✅ Implemented: Force Refresh Option

**Backend:**
- Added `force_refresh` parameter to `/api/pairs` endpoint
- When `?force_refresh=true`, bypasses cache and fetches fresh data
- Manual refresh button in UI triggers force refresh

**Usage:**
```
Normal load:     GET /api/pairs?page=1&limit=50
                 → Uses cache (fast, scales well)

Manual refresh:  GET /api/pairs?page=1&limit=50&force_refresh=true
                 → Bypasses cache (fresh data, slower)
```

**Benefits:**
- ✅ Scales well for normal browsing (uses cache)
- ✅ Users can get fresh data when needed (force refresh)
- ✅ No impact on monitoring/opportunities (they continue using cache)

**Trade-offs:**
- ⚠️ Relies on users knowing to refresh for latest data
- ⚠️ Auto-refresh in UI doesn't force fresh data (would defeat scalability)

## Alternative Solutions (For Future Consideration)

### Option 2: Shorter Cache TTL for Analytics
**Implementation:**
```python
# Different cache durations for different use cases
ANALYTICS_CACHE_TTL = 60      # 1 minute
MONITORING_CACHE_TTL = 300    # 5 minutes
```

**Pros:**
- More frequent updates for analytics users
- Better data freshness balance

**Cons:**
- Increased API calls (12/hour → 60/hour per active user)
- More complex cache management
- Still not "real-time"

### Option 3: Separate Cache Instances
**Implementation:**
```python
analytics_cache = PoolDataCache(ttl=60)    # 1-min cache for analytics
monitoring_cache = PoolDataCache(ttl=300)  # 5-min cache for monitoring
```

**Pros:**
- Optimal TTL per use case
- Analytics gets fresher data
- Monitoring still highly efficient

**Cons:**
- Duplicate data in memory (2x cache size)
- More memory usage (~200MB per cache)
- More complex architecture

### Option 4: Display Cache Age + Manual Refresh
**Implementation:**
- Show "Data age: 3m 45s" in UI
- Visual indicator when data is stale (>2 min old)
- Encourage users to refresh for fresh data

**Pros:**
- Users aware of data freshness
- Informed decision making
- Maintains scalability

**Cons:**
- Requires UI changes
- Users must actively refresh
- Not truly "automatic"

### Option 5: WebSocket/SSE for Real-Time Updates
**Implementation:**
- Server pushes updates when cache refreshes
- Clients automatically get new data
- No polling needed

**Pros:**
- True real-time data
- Best user experience
- No manual refresh needed

**Cons:**
- Complex implementation
- Requires WebSocket infrastructure
- Higher server resource usage
- Not needed until 1000+ concurrent users

### Option 6: Adaptive Cache TTL
**Implementation:**
```python
# Shorter TTL during high activity periods
if active_users > 100:
    cache_ttl = 120  # 2 minutes
else:
    cache_ttl = 300  # 5 minutes
```

**Pros:**
- Smart scaling based on load
- Better balance between freshness and performance

**Cons:**
- More complex logic
- Unpredictable behavior for users
- Requires monitoring active user count

## Recommendation Priority

### Immediate (Implemented):
1. ✅ **Force Refresh** - Quick win, gives users control

### Short Term (Next 1-3 months):
2. **Display Cache Age** - Add transparency to UI
3. **Shorter Analytics Cache TTL** - Reduce to 2 minutes

### Long Term (6+ months, if needed):
4. **Separate Cache Instances** - When analytics traffic is high
5. **WebSocket Updates** - When approaching 1000+ concurrent users

## Metrics to Monitor

Track these to determine when to implement stricter freshness:

1. **User Complaints** - "Data seems stale/wrong"
2. **Cache Hit Rate** - If too high (>95%), data too stale
3. **Force Refresh Usage** - If users constantly force refresh, TTL too long
4. **Active Users** - At 500+ users, consider separate caches
5. **API Rate Limits** - Stay well below Meteora's limits

## Decision Matrix

| Active Users | Recommended Solution | Cache TTL | API Calls/Hour |
|--------------|---------------------|-----------|----------------|
| 1-100        | Force Refresh (current) | 5 min | 12-50 |
| 100-500      | Display Cache Age + 2min TTL | 2 min | 30-150 |
| 500-1000     | Separate Caches | 1-2 min analytics | 60-200 |
| 1000+        | WebSocket Updates | N/A | Minimal |

## Current Status

- **Solution:** Force Refresh (Option 1)
- **Cache TTL:** 5 minutes (300 seconds)
- **Force Refresh Param:** `?force_refresh=true`
- **Impact:** Scalable + User control
- **Next Review:** When active users > 100 or user complaints arise

## Notes

- Monitor user behavior and feedback
- Balance scalability vs data freshness based on actual usage
- Current solution (force refresh) is sufficient for MVP and early growth
- Revisit when metrics indicate freshness is a problem
