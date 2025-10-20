# Pool Filtering Implementation

## Overview

Added client-side filtering to the `PoolDataCache` to remove trash/unwanted pools from Meteora's `/pair/all` endpoint, significantly reducing memory usage and improving data quality for analytics.

## Problem

The deprecated `/pair/all` endpoint returns **116,600+ pools**, including:
- Low TVL pools (dust/abandoned pools)
- Hidden pools marked by Meteora
- Blacklisted pools (scams/malicious)

This results in:
- High memory usage (~200MB cached data)
- Slow processing (sorting/filtering 116K items)
- Poor UX (trash pools mixed with quality pools)
- Wasted bandwidth

## Solution

### Implemented Filters

Three filters applied after fetching from Meteora API:

1. **Hide Filter**: Remove pools with `hide=True`
   - Pools marked by Meteora as low activity/TVL
   - Filtered out: ~101 pools

2. **Blacklist Filter**: Remove pools with `is_blacklisted=True`
   - Scam pools, malicious tokens
   - Filtered out: ~103 pools

3. **Minimum TVL Filter**: Remove pools with TVL < $100
   - Dust pools, abandoned pools, test pools
   - Filtered out: ~112,026 pools
   - **Configurable**: `pool_cache.min_tvl` (default: $100)

### Results

**Before Filtering:**
- Total pools: 116,600
- Memory: ~200MB
- Processing time: High

**After Filtering:**
- Active pools: 4,370
- Filtered out: 112,230 (96.2% reduction!)
- Memory: ~7.5MB (96% reduction)
- Processing time: Fast

### Filter Configuration

Filters are configurable in `pool_cache.py`:

```python
# In PoolDataCache._initialize()
self.min_tvl = 100  # Minimum TVL in USD
self.filter_hidden = True  # Filter hide=True pools
self.filter_blacklisted = True  # Filter is_blacklisted=True pools
```

## Implementation Details

### Code Changes

**File**: `backend/pool_cache.py`

1. **Added filter configuration** in `_initialize()`:
   - `min_tvl`: Minimum TVL threshold ($100)
   - `filter_hidden`: Toggle for hide filter
   - `filter_blacklisted`: Toggle for blacklist filter

2. **Added `_filter_pools()` method**:
   - Applies all three filters
   - Returns filtered pools + statistics
   - Logs filtering summary

3. **Updated `_fetch_fresh_data()`**:
   - Calls `_filter_pools()` after API fetch
   - Stores filtered pools in cache
   - Updates filter statistics

4. **Enhanced statistics tracking**:
   - `total_pools_raw`: Before filtering
   - `total_pools_filtered`: After filtering
   - `pools_filtered_out`: Total removed
   - `hidden_filtered`: Count of hidden pools
   - `blacklisted_filtered`: Count of blacklisted
   - `low_tvl_filtered`: Count of low TVL pools

### API Endpoints

**Get Filter Statistics:**
```bash
GET /api/cache/stats
```

**Response:**
```json
{
  "status": "success",
  "cache": {
    "total_pools_raw": 116600,
    "total_pools_filtered": 4370,
    "pools_filtered_out": 112230,
    "hidden_filtered": 101,
    "blacklisted_filtered": 103,
    "low_tvl_filtered": 112026,
    "cache_hits": 10,
    "cache_misses": 1,
    "hit_rate_percent": 90.91
  }
}
```

## Benefits

1. **96.2% Data Reduction**
   - 116,600 → 4,370 pools
   - Faster sorting, filtering, pagination

2. **96% Memory Savings**
   - ~200MB → ~7.5MB cached data
   - Better scalability

3. **Improved Data Quality**
   - Only active, legitimate pools
   - Better LP decision-making

4. **Same API Interface**
   - No frontend changes required
   - Existing cache logic still works
   - Filter stats available via `/api/cache/stats`

## Future Improvements

### Short Term
- Add min TVL as query parameter (user-configurable)
- Add filter toggle API endpoints

### Long Term (if needed)
- Migrate to `/pair/groups` API for server-side filtering
- Implement two-level caching (groups + pools)
- Add lazy loading for popular pairs only

See [CACHE_FRESHNESS_CONSIDERATION.md](./CACHE_FRESHNESS_CONSIDERATION.md) for full migration plan.

## Monitoring

Track these metrics to tune filtering:

1. **Filter Stats** (`/api/cache/stats`):
   - `pools_filtered_out`: Should be stable ~96%
   - `low_tvl_filtered`: Majority of filters

2. **User Feedback**:
   - "Missing pools" → Lower min_tvl
   - "Too many trash pools" → Raise min_tvl

3. **Memory Usage**:
   - Should stay < 10MB per cache instance

## Testing

**Test filtering is working:**
```bash
# Force fresh fetch
curl 'http://localhost:5000/api/pairs?force_refresh=true&limit=5'

# Check filter stats
curl 'http://localhost:5000/api/cache/stats'

# Verify logs
tail -f /tmp/flask.log | grep "Filtered pools"
```

**Expected log output:**
```
INFO:pool_cache:Filtered pools: 116600 → 4370 (removed 112230: 101 hidden, 103 blacklisted, 112026 low TVL < $100)
```

## Rollback

To disable filtering (if needed):

```python
# In pool_cache.py _initialize()
self.min_tvl = 0  # Disable TVL filter
self.filter_hidden = False  # Disable hide filter
self.filter_blacklisted = False  # Disable blacklist filter
```

Or comment out the `_filter_pools()` call in `_fetch_fresh_data()`.
