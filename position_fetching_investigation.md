# Meteora Position Fetching Investigation

## Problem
Unable to fetch user positions directly from Solana RPC using `getProgramAccounts` with memcmp filters.

## Approaches Tried

### 1. Direct RPC Query (Failed)
- Tried querying DLMM Program ID: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
- Tested multiple offsets: 0, 8, 16, 32, 40
- Result: Empty arrays for all queries
- Wallet tested: `AQ3teERPvrhw3A54BNM2j9G1oKP6SJsJSrnm6SqXpV8U`

### 2. Research Findings
- Direct RPC `getProgramAccounts` is considered "a headache" for Meteora positions
- Position accounts have complex structures (Position and PositionV2)
- Recommended approaches:
  - **GraphQL APIs** (Shyft, Bitquery) - most reliable
  - **Meteora SDK** - `getAllLbPairPositionsByUser()` method
  - **Transaction parsing** - fetch wallet transactions and parse for position creation

### 3. Resources for Future Implementation
- GitHub repo with position tracking: https://github.com/GeekLad/meteora-profit-analysis
- Shyft GraphQL docs: https://docs.shyft.to/solana-indexers/case-studies/meteora/get-position-of-a-user-wallet
- Meteora SDK: `@meteora-ag/dlmm` package

## Implemented Approach ✅
Smart filtering based on whitelist and quote preferences:
1. User adds tokens to their whitelist
2. User selects quote token preferences (SOL and/or USDC)
3. Backend fetches all pools from Meteora API
4. Filter pools that:
   - Contain at least one whitelisted token
   - Have a preferred quote token (SOL/USDC)
5. Display these candidate pools as "potential" positions
6. Future: Add RPC check to verify actual position ownership per pool

This approach is efficient because:
- Narrows down search space significantly
- Avoids complex RPC queries for all positions
- User-driven filtering ensures relevance
- Can show pools user likely has positions in

## Code Location
- Backend: `/home/ayman/meteora-trending-pairs/backend/app.py` (lines 188-308)
- Frontend service: `/home/ayman/meteora-trending-pairs/frontend/src/services/capitalRotationService.js`
- Components: `/home/ayman/meteora-trending-pairs/frontend/src/components/CapitalRotation/`

## Next Steps
1. Implement pool-based position tracking (user specifies pool addresses)
2. Later: Integrate with GraphQL API (Shyft) or implement SDK-based fetching
3. Or: Clone and study the meteora-profit-analysis repo implementation
