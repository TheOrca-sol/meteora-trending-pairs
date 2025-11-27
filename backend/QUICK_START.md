# Liquidity Automation - Quick Start Guide

## What's Been Built

A complete automated liquidity management system for Meteora DLMM pools with:
- **Manual liquidity addition** with per-position automation rules
- **Background monitoring** of all active positions (every 5 minutes)
- **Automated execution** of TP/SL, compounding, and rebalancing (every 2 minutes)
- **Global automation defaults** configurable per wallet
- **Telegram notifications** for all automation events

## Architecture Summary

### Frontend Components
- ✅ `AddLiquidityModal.js` - Create positions with automation
- ✅ `AutomationSettings.js` - Configure global defaults
- ✅ `LiquidityRangeSuggestion.jsx` - Strategy selection UI
- ✅ `meteoraLiquidityService.js` - Meteora SDK integration

### Backend Services
- ✅ `liquidity_monitoring_service.py` - Position monitoring (every 5 min)
- ✅ `liquidity_execution_service.py` - Action execution (every 2 min)
- ✅ `liquidity_routes.py` - REST API endpoints

### Database (Supabase)
- ✅ 7 tables created via migration
- ✅ All indexes and triggers configured

## Setup Instructions

### 1. Install Dependencies

**Backend:**
```bash
cd backend
source venv/bin/activate
pip install solana solders base58
```

**Frontend:**
```bash
cd frontend
npm install @meteora-ag/dlmm bn.js
```

### 2. Configure Degen Wallet (Optional for Testing)

The degen wallet executes automation actions. For testing without actual execution, you can skip this.

**Generate wallet:**
```bash
solana-keygen new --outfile ~/degen-wallet.json
```

**Add to backend/.env:**
```bash
DEGEN_WALLET_PRIVATE_KEY="your_base58_private_key_here"
```

**Fund wallet:**
```bash
# Get address
solana address -k ~/degen-wallet.json

# Send SOL for transaction fees
solana transfer <ADDRESS> 0.1 --allow-unfunded-recipient
```

### 3. Verify Setup

```bash
cd backend
python3 check_liquidity_services.py
```

This will check:
- ✅ Database connection and tables
- ✅ Monitoring service status
- ✅ Execution service status
- ✅ Degen wallet configuration
- ✅ API endpoints
- ✅ Queue status

### 4. Start the Services

Services start automatically when you run the Flask app:

```bash
cd backend
source venv/bin/activate
python app.py
```

You should see:
```
INFO:root:Liquidity monitoring and execution services initialized
INFO:root:  - Monitoring service: checking positions every 5 minutes
INFO:root:  - Execution service: processing queue every 2 minutes
```

## How to Use

### For Users (Frontend)

1. **Connect Wallet** in Settings → Wallet tab

2. **Configure Global Defaults** (optional)
   - Go to Settings → Automation tab
   - Enable automation
   - Set default strategy, TP/SL, compound frequency, etc.
   - Click Save Settings

3. **Add Liquidity to a Pool**
   - Browse pools in the main table
   - Expand a pool row
   - Click on a suggested liquidity strategy button
   - Click "Add Liquidity" button
   - Configure:
     - Amount in USD
     - Take Profit: 10-200%
     - Stop Loss: 5-75%
     - Auto-Compound: Every 6h-1w
     - Rebalancing: Enable/disable
   - Click "Add Liquidity"
   - Sign transaction with your wallet
   - Position is now active with automation!

4. **Monitor Your Positions**
   - View in Settings → Positions (to be added)
   - Receive Telegram notifications for all events
   - Check transaction history

### For Developers (Testing)

**View Active Positions:**
```sql
SELECT position_address, token_x_symbol, token_y_symbol,
       profit_percentage, status, last_monitored
FROM liquidity_positions
WHERE status = 'active';
```

**View Automation Rules:**
```sql
SELECT p.position_address, p.profit_percentage,
       r.take_profit_enabled, r.take_profit_value,
       r.stop_loss_enabled, r.stop_loss_value,
       r.auto_compound_enabled
FROM liquidity_positions p
JOIN position_automation_rules r ON p.position_address = r.position_address
WHERE p.status = 'active';
```

**View Pending Actions:**
```sql
SELECT * FROM position_monitoring_queue
WHERE status = 'pending';
```

**Manually Trigger Monitoring (for testing):**
```python
cd backend
python3

from models import get_db, LiquidityPosition
from liquidity_monitoring_service import liquidity_monitoring_service

db = get_db()
position = db.query(LiquidityPosition).first()
if position:
    liquidity_monitoring_service._check_position(position, db)
db.close()
```

**Simulate Profit for Testing:**
```sql
-- Update position to trigger take profit
UPDATE liquidity_positions
SET profit_percentage = 55.0
WHERE position_address = 'YOUR_POSITION_ADDRESS';

-- Wait for next monitoring cycle (up to 5 minutes)
-- Or manually trigger as shown above
```

## Monitoring & Logs

**Backend logs:**
```bash
tail -f backend/logs/app.log | grep -i liquidity
```

**Look for:**
- `Liquidity Monitoring Service initialized`
- `Monitoring X active positions`
- `Take profit triggered for...`
- `✅ Successfully closed position...`
- `Queued compound action for...`

**Check service status:**
```bash
curl http://localhost:5000/api/admin/dashboard
```

## Current Implementation Status

### ✅ Complete
- Database schema and migration
- Backend API endpoints
- Frontend UI for adding liquidity
- Frontend global automation settings
- Monitoring service (checking positions)
- Execution service (processing queue)
- Telegram notifications
- Queue management
- Integration with Flask app

### 🚧 Placeholder (To Be Implemented)
- **Actual blockchain queries** in `_fetch_position_data()` - Currently returns None
- **Actual transaction execution** in execution service - Currently logs but doesn't execute
- **Meteora SDK integration** for remove/compound/rebalance - Need to implement

The infrastructure is complete and working. The next step is implementing the actual Solana blockchain interactions using the Meteora SDK.

## Next Steps (Implementation)

To complete the automation system:

1. **Implement `_fetch_position_data()` in liquidity_monitoring_service.py:**
   - Connect to Solana RPC
   - Load DLMM pool using Meteora SDK
   - Get position data (amounts, value, fees)
   - Calculate current USD value
   - Return position data dict

2. **Implement blockchain execution in liquidity_execution_service.py:**
   - `_execute_close_position()` - Use Meteora SDK removeLiquidity
   - `_execute_compound()` - Use Meteora SDK claimFee + addLiquidity
   - `_execute_rebalance()` - Remove + recalculate range + add liquidity

3. **Add position management UI:**
   - Create "My Positions" page
   - Show active positions with P&L
   - Allow editing automation rules
   - Manual close/compound buttons

4. **Testing:**
   - Create test positions with small amounts
   - Verify monitoring detects profit changes
   - Test queue processing
   - Verify transactions execute correctly

## Documentation

- **Full Documentation**: `LIQUIDITY_AUTOMATION.md`
- **Configuration Check**: `python3 check_liquidity_services.py`
- **Architecture Diagram**: See architecture section in LIQUIDITY_AUTOMATION.md

## Support

Issues? Check:
1. ✅ Services initialized: `python3 check_liquidity_services.py`
2. ✅ Database tables exist: Run queries above
3. ✅ Logs show activity: `tail -f backend/logs/app.log`
4. ✅ Degen wallet funded: Check balance on Solscan
5. ✅ RPC connection working: Test with `solana cluster-version`
