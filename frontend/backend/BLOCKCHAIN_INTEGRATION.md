# Blockchain Integration - Meteora DLMM

## Overview

The blockchain integration connects the automation system to Solana and Meteora DLMM pools using native Solana SDK.

## Architecture

### Components

**`meteora_sdk.py`** - Python wrapper for Meteora DLMM program
- Fetches position data from blockchain
- Creates transactions for remove/add liquidity and claim fees
- Signs transactions with degen wallet
- Sends and confirms transactions on Solana

**`liquidity_monitoring_service.py`** - Uses SDK to fetch live position data
**`liquidity_execution_service.py`** - Uses SDK to execute automation actions

## Implementation Details

### 1. Position Data Fetching

```python
from meteora_sdk import meteora_sdk

position_data = meteora_sdk.get_position_data(
    position_address="...",
    pool_address="..."
)
# Returns: {
#     'amountX': float,
#     'amountY': float,
#     'valueUSD': float,
#     'feesX': float,
#     'feesY': float,
#     'feesUSD': float,
#     'profitUSD': float,
#     'inRange': bool,
#     'activeBinId': int,
#     'lowerBinId': int,
#     'upperBinId': int
# }
```

**How it works:**
1. Fetches position and pool accounts from Solana RPC
2. Parses account data (position amounts, fees, bin IDs)
3. Fetches token prices from Jupiter API
4. Calculates USD values
5. Checks if position is in range

### 2. Remove Liquidity (Close Position)

```python
transaction = meteora_sdk.create_remove_liquidity_transaction(
    position_address="...",
    pool_address="...",
    owner=degen_wallet,
    bps_to_remove=10000  # 100%
)

signature = meteora_sdk.send_and_confirm_transaction(transaction)
```

**Transaction flow:**
1. Creates remove liquidity instruction
2. Adds compute budget instructions
3. Signs with degen wallet
4. Sends to Solana RPC
5. Waits for confirmation
6. Returns transaction signature

### 3. Claim Fees (Part of Compound)

```python
claim_tx = meteora_sdk.create_claim_fees_transaction(
    position_address="...",
    pool_address="...",
    owner=degen_wallet
)

signature = meteora_sdk.send_and_confirm_transaction(claim_tx)
```

**Used for:**
- Auto-compound: Claim fees → Add back as liquidity
- Manual claiming (future feature)

### 4. Add Liquidity (Part of Compound/Rebalance)

```python
add_tx = meteora_sdk.create_add_liquidity_transaction(
    pool_address="...",
    position_address="...",
    owner=degen_wallet,
    amount_x=x_lamports,
    amount_y=y_lamports,
    lower_bin_id=100,
    upper_bin_id=200
)

signature = meteora_sdk.send_and_confirm_transaction(add_tx)
```

**Used for:**
- Compounding: Add claimed fees back
- Rebalancing: Add at new range

### 5. Rebalancing (Multi-step)

```python
# 1. Remove all liquidity
remove_tx = meteora_sdk.create_remove_liquidity_transaction(...)
remove_sig = meteora_sdk.send_and_confirm_transaction(remove_tx)

# 2. Calculate new range
active_bin_id = position_data['activeBinId']
width = old_upper - old_lower
new_lower = active_bin_id - (width // 2)
new_upper = active_bin_id + (width // 2)

# 3. Add liquidity at new range
add_tx = meteora_sdk.create_add_liquidity_transaction(
    ...,
    lower_bin_id=new_lower,
    upper_bin_id=new_upper
)
add_sig = meteora_sdk.send_and_confirm_transaction(add_tx)
```

## Account Parsing

### Position Account Structure

```
Offset | Size | Field
-------|------|-------------
0      | 8    | Discriminator
8      | 32   | LB Pair (pool)
40     | 32   | Owner
72     | 8    | Liquidity
80     | 4    | Lower Bin ID
84     | 4    | Upper Bin ID
88     | 8    | Total X Amount
96     | 8    | Total Y Amount
104    | 8    | Fee X
112    | 8    | Fee Y
```

### Pool Account Structure

```
Offset | Size | Field
-------|------|-------------
0      | 8    | Discriminator
8      | 32   | Mint X
40     | 32   | Mint Y
72     | 1    | Decimals X
73     | 1    | Decimals Y
74     | 2    | Bin Step
76     | 4    | Active Bin ID
```

**Note:** These structures are simplified approximations. Actual Meteora program account layouts may differ. For production use, refer to the official Meteora SDK or program source code.

## Instruction Data Format

### Remove Liquidity

```
[8 bytes discriminator] + [2 bytes BPS (little-endian)]
```

### Claim Fee

```
[8 bytes discriminator]
```

### Add Liquidity

```
[8 bytes discriminator]
+ [8 bytes amount_x]
+ [8 bytes amount_y]
+ [4 bytes lower_bin_id]
+ [4 bytes upper_bin_id]
```

**Note:** These are placeholder formats. Actual instruction discriminators and data structures need to match the Meteora DLMM program.

## Important Considerations

### 🚨 Current Implementation Status

The blockchain integration is **structurally complete** but uses **placeholder instruction formats**:

✅ **Working:**
- RPC connection to Solana
- Account data fetching
- Account parsing logic
- Transaction creation flow
- Transaction signing
- Transaction sending

⚠️ **Needs Verification:**
- Instruction discriminators (currently placeholders)
- Account lists (simplified, may need additional accounts)
- Instruction data format (needs to match Meteora program)
- Token account derivations (not implemented)

### 🔧 To Make Fully Functional

1. **Get actual instruction discriminators:**
   - Option A: Use official Meteora JavaScript SDK as reference
   - Option B: Reverse engineer from existing transactions
   - Option C: Use anchor IDL if available

2. **Complete account lists:**
   - Each instruction needs correct account list
   - Include: token accounts, mint accounts, program accounts
   - Derive PDAs (Program Derived Addresses) correctly

3. **Token account handling:**
   - Find or create associated token accounts
   - Add ATA (Associated Token Account) instructions if needed

4. **Testing approach:**
   ```bash
   # 1. Test on devnet first
   SOLANA_RPC_URL=https://api.devnet.solana.com

   # 2. Create test position with minimal amount
   # 3. Monitor position in database
   # 4. Manually update profit_percentage to trigger action
   # 5. Check execution logs for errors
   # 6. Verify transaction on Solscan
   ```

## Alternative: Use Meteora JavaScript SDK via Node.js

If the Python implementation is complex, consider:

1. **Create Node.js microservice** that wraps Meteora SDK
2. **Expose HTTP API** for position data and transactions
3. **Call from Python** via HTTP requests

**Pros:**
- Uses official, tested Meteora SDK
- Guaranteed correct instruction format
- Easier to maintain

**Cons:**
- Additional service to manage
- HTTP overhead for each call
- Node.js dependency

## Example Node.js Service

```javascript
// meteora-service/index.js
const express = require('express');
const DLMM = require('@meteora-ag/dlmm');
const { Connection, Keypair } = require('@solana/web3.js');

const app = express();
const connection = new Connection(process.env.RPC_URL);
const degenWallet = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(process.env.DEGEN_WALLET_PRIVATE_KEY))
);

app.post('/position/data', async (req, res) => {
    const { positionAddress, poolAddress } = req.body;

    const pool = await DLMM.create(connection, poolAddress);
    const position = await pool.getPosition(positionAddress);

    res.json({
        amountX: position.positionData.totalXAmount,
        amountY: position.positionData.totalYAmount,
        feesX: position.positionData.feeX,
        feesY: position.positionData.feeY,
        // ... more data
    });
});

app.post('/position/close', async (req, res) => {
    const { positionAddress, poolAddress } = req.body;

    const pool = await DLMM.create(connection, poolAddress);
    const tx = await pool.removeLiquidity({
        position: positionAddress,
        user: degenWallet.publicKey,
        bps: new BN(10000)
    });

    tx.sign([degenWallet]);
    const signature = await connection.sendTransaction(tx);

    res.json({ signature });
});

app.listen(3002);
```

**Python calls it:**
```python
import requests

response = requests.post('http://localhost:3002/position/data', json={
    'positionAddress': '...',
    'poolAddress': '...'
})
position_data = response.json()
```

## Recommended Path Forward

### Phase 1: Test with Mock Data
- ✅ Already implemented
- System works with placeholder blockchain calls
- Test automation logic, database, notifications

### Phase 2: Implement Node.js Service (RECOMMENDED)
- Create separate Node.js service with Meteora SDK
- Expose HTTP API for Python to call
- Test on devnet with real positions
- **Fastest path to working implementation**

### Phase 3: Complete Python Implementation (ALTERNATIVE)
- Reverse engineer Meteora instruction formats
- Complete account derivations
- Test thoroughly on devnet
- **More work but no additional dependencies**

## Current Status

✅ **Infrastructure complete:**
- Database schema
- Monitoring service
- Execution service
- SDK wrapper structure
- Position data fetching

⚠️ **Needs completion:**
- Verify instruction formats against actual Meteora program
- Complete account lists
- Add token account handling
- Test on devnet

🎯 **Recommended:** Implement Node.js microservice for fastest, most reliable path to production.

## Testing Checklist

Before production use:

- [ ] Test position data fetching on real position
- [ ] Verify account parsing returns correct values
- [ ] Test remove liquidity on devnet with test position
- [ ] Verify transaction appears on Solscan
- [ ] Test claim fees functionality
- [ ] Test add liquidity (compound)
- [ ] Test full rebalance flow
- [ ] Monitor degen wallet balance
- [ ] Test error handling (insufficient funds, etc.)
- [ ] Load test: multiple positions executing simultaneously

## Support Resources

- **Meteora Docs:** https://docs.meteora.ag/
- **Meteora SDK:** https://github.com/meteora-ag/dlmm-sdk
- **Solana RPC Docs:** https://docs.solana.com/api/http
- **Program Explorer:** https://solscan.io/
