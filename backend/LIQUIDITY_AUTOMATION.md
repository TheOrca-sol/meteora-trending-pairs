# Liquidity Position Automation System

## Overview

The liquidity position automation system enables automated management of Meteora DLMM positions with:
- **Take Profit / Stop Loss**: Automatically close positions when profit/loss targets are reached
- **Auto-Compound**: Claim and reinvest trading fees at scheduled intervals
- **Rebalancing**: Adjust liquidity ranges based on market conditions
- **Telegram Notifications**: Real-time alerts for all automation actions

## Architecture

### Components

1. **Frontend (React)**
   - `AddLiquidityModal.js` - User creates positions with automation rules
   - `AutomationSettings.js` - Configure global automation defaults
   - `meteoraLiquidityService.js` - Meteora SDK integration

2. **Backend Services (Python)**
   - `liquidity_monitoring_service.py` - Monitors positions every 5 minutes
   - `liquidity_execution_service.py` - Executes queued actions every 2 minutes
   - `liquidity_routes.py` - REST API endpoints

3. **Database (Supabase PostgreSQL)**
   - `liquidity_positions` - Position tracking
   - `position_automation_rules` - Per-position automation config
   - `automation_configs` - Global wallet defaults
   - `position_monitoring_queue` - Action execution queue
   - `liquidity_transactions` - Transaction history

## Setup

### 1. Database Migration

Already completed - migration creates all necessary tables.

### 2. Configure Degen Wallet

The degen wallet is used to execute automation actions (TP/SL, compound, rebalance).

**Generate a new Solana wallet:**
```bash
solana-keygen new --outfile ~/degen-wallet.json
```

**Add to environment variables:**
```bash
# Option 1: Base58 encoded private key (recommended)
DEGEN_WALLET_PRIVATE_KEY="<base58_private_key>"

# Option 2: JSON array format
DEGEN_WALLET_PRIVATE_KEY="[123,45,67,...]"
```

**Fund the wallet:**
```bash
# Get wallet address
solana address -k ~/degen-wallet.json

# Send SOL for transaction fees
solana transfer <DEGEN_WALLET_ADDRESS> 0.1 --allow-unfunded-recipient
```

**Security Notes:**
- Keep private key secure - it executes automated trades
- Only fund with enough SOL for transaction fees (~0.1 SOL)
- Monitor wallet balance and refill as needed

### 3. Install Dependencies

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

### 4. Environment Variables

Add to `backend/.env`:
```env
# Required
DATABASE_URL=postgresql://...  # Supabase connection string
DEGEN_WALLET_PRIVATE_KEY=...   # Degen wallet private key

# Optional
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

Add to `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

## How It Works

### 1. User Creates Position

1. User connects wallet in frontend
2. Selects a liquidity strategy from suggested ranges
3. Configures automation rules:
   - Take Profit: 10-200% gain
   - Stop Loss: 5-75% loss
   - Auto-Compound: Every 6h-1w
   - Rebalancing: Price drift / imbalance triggers
4. Transaction is signed with **user's wallet** (not degen wallet)
5. Position is recorded in database with automation rules

### 2. Monitoring Service (Runs Every 5 Minutes)

The `liquidity_monitoring_service.py`:

1. **Queries all active positions** from database
2. **Fetches current data** from blockchain (value, fees, profit %)
3. **Checks automation triggers**:
   - Is profit >= take profit target?
   - Is loss <= stop loss threshold?
   - Have fees accumulated above threshold?
   - Has price drifted out of range?
4. **Queues actions** if triggers are met
5. **Sends Telegram notifications** to users

### 3. Execution Service (Runs Every 2 Minutes)

The `liquidity_execution_service.py`:

1. **Reads pending actions** from queue
2. **Executes blockchain transactions** using degen wallet:
   - Take Profit/Stop Loss → Remove 100% liquidity
   - Compound → Claim fees + Add to position
   - Rebalance → Remove + Add at new range
3. **Updates position status** in database
4. **Records transactions** for history
5. **Sends completion notifications** via Telegram

### 4. Global Automation Config

Users can set wallet-wide defaults in Settings → Automation:
- Preferred strategy for new positions
- Max position size (% of wallet)
- Min RugCheck security score
- Default TP/SL percentages
- Default compound frequency
- Telegram notification preferences

## Monitoring & Debugging

### Check Service Status

```bash
# Check if services are running
curl http://localhost:5000/api/admin/dashboard

# View scheduled jobs
# Both liquidity services should show active jobs
```

### View Logs

```bash
# Backend logs show monitoring activity
tail -f backend/logs/app.log | grep -i liquidity

# Look for:
# - "Liquidity Monitoring Service initialized"
# - "Monitoring X active positions"
# - "Take profit triggered for..."
# - "✅ Successfully closed position..."
```

### Database Queries

```sql
-- View active positions
SELECT position_address, token_x_symbol, token_y_symbol,
       profit_percentage, status, last_monitored
FROM liquidity_positions
WHERE status = 'active';

-- View automation rules
SELECT p.position_address, p.profit_percentage,
       r.take_profit_enabled, r.take_profit_value,
       r.stop_loss_enabled, r.stop_loss_value
FROM liquidity_positions p
JOIN position_automation_rules r ON p.position_address = r.position_address
WHERE p.status = 'active';

-- View pending actions
SELECT * FROM position_monitoring_queue
WHERE status = 'pending';

-- View transaction history
SELECT transaction_type, value_usd, created_at, transaction_signature
FROM liquidity_transactions
WHERE wallet_address = 'YOUR_WALLET'
ORDER BY created_at DESC
LIMIT 10;
```

## Testing

### Test Monitoring Without Execution

To test monitoring without actually executing trades:

1. Create a position with automation enabled
2. Monitor logs: `tail -f backend/logs/app.log`
3. Wait for monitoring cycle (every 5 minutes)
4. Check that position is being monitored
5. Manually update profit_percentage in database to trigger action
6. Verify action is queued (but not executed if degen wallet not configured)

### Manual Trigger

```python
# In backend directory
python3

from models import get_db, LiquidityPosition
from liquidity_monitoring_service import liquidity_monitoring_service

db = get_db()
position = db.query(LiquidityPosition).filter(
    LiquidityPosition.position_address == 'YOUR_POSITION_ADDRESS'
).first()

liquidity_monitoring_service._check_position(position, db)
db.close()
```

## Telegram Notifications

Users receive notifications for:
- ✅ Position opened successfully
- 🎯 Take profit triggered
- 🛑 Stop loss triggered
- 💰 Auto-compound executed
- ⚖️ Position rebalanced
- ❌ Automation errors

## Security Considerations

1. **Degen Wallet Security**
   - Store private key securely (environment variable, not in code)
   - Only fund with minimal SOL for transaction fees
   - Monitor wallet activity regularly
   - Rotate keys periodically

2. **User Wallet Separation**
   - Users sign initial position creation with their own wallet
   - Degen wallet only executes automation actions
   - User maintains custody of funds at all times

3. **Access Control**
   - Each user can only view/modify their own positions
   - Admin endpoints protected by wallet verification
   - Database queries filtered by wallet_address

## Troubleshooting

### Services Not Starting

**Error:** "Liquidity Monitoring Service" not in logs
- Check `backend/app.py` imports succeeded
- Verify DATABASE_ENABLED is True
- Check for Python syntax errors in service files

### Actions Not Executing

**Issue:** Positions queued but not executed
- Check degen wallet is configured: `DEGEN_WALLET_PRIVATE_KEY`
- Verify wallet has SOL balance for transaction fees
- Check execution service logs for errors
- Verify RPC URL is accessible

### False Triggers

**Issue:** Actions triggering unexpectedly
- Check profit calculation logic in monitoring service
- Verify position data is being fetched correctly from blockchain
- Review automation rules in database
- Adjust trigger thresholds if too sensitive

## Future Enhancements

- [ ] Implement actual Meteora SDK blockchain queries (currently placeholder)
- [ ] Add position performance analytics dashboard
- [ ] Support partial position closures (e.g., close 50%)
- [ ] Advanced rebalancing strategies (Fibonacci, Bollinger Bands)
- [ ] Gas optimization (batch multiple actions)
- [ ] Multi-signature support for high-value positions
- [ ] Machine learning for optimal TP/SL levels
- [ ] Integration with trading bots (Jupiter swaps)

## API Reference

### Create Position
```
POST /api/liquidity/positions
Body: {
  walletAddress, positionAddress, poolAddress,
  tokenXMint, tokenYMint, liquidityUsd,
  lowerPrice, upperPrice, strategyName,
  automationRules: { takeProfitEnabled, takeProfitValue, ... }
}
```

### Get Positions
```
GET /api/liquidity/positions?walletAddress=<address>
Returns: { positions: [...] }
```

### Update Automation Rules
```
PUT /api/liquidity/positions/<address>/automation
Body: { takeProfitEnabled, takeProfitValue, ... }
```

### Get Automation Config
```
GET /api/liquidity/automation/config?walletAddress=<address>
Returns: { config: { automationEnabled, defaultStrategy, ... } }
```

### Update Automation Config
```
PUT /api/liquidity/automation/config
Body: { walletAddress, automationEnabled, defaultStrategy, ... }
```

## Support

For issues or questions:
1. Check logs: `backend/logs/app.log`
2. Review database state (queries above)
3. Check Telegram bot connection
4. Verify degen wallet configuration
5. Open GitHub issue with logs and error messages
