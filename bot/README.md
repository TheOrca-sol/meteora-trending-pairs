# Meteora DLMM Automation Bot

Automated liquidity provider bot for Meteora DLMM pools on Solana.

## Features

- **Automated Pool Selection**: Scores and ranks pools based on profitability, risk, liquidity health, and market conditions
- **Adaptive Strategies**: Automatically selects Spot, Curve, or Bid-Ask strategies based on market volatility
- **Risk Management**: Comprehensive safety checks including IL monitoring, security analysis, and stop-loss mechanisms
- **Multi-Source Data**: Aggregates data from Meteora, DexScreener, Jupiter, RugCheck, and Helius
- **Autonomous Operation**: Monitors positions, claims rewards, and rebalances automatically
- **Emergency Controls**: Quick stop and emergency exit capabilities

## Architecture

### Services

1. **Data Aggregator** - Fetches and enriches pool data from multiple sources
2. **Scoring Service** - Calculates pool scores based on multiple factors
3. **Strategy Service** - Determines optimal liquidity strategies
4. **Risk Manager** - Monitors positions and enforces safety rules
5. **Execution Service** - Executes transactions through Meteora SDK
6. **Solana Service** - Manages blockchain connection and wallet
7. **DLMM Service** - Interfaces with Meteora DLMM protocol

### Database Schema

- **pools** - Pool metadata
- **pool_metrics** - Time-series metrics data
- **positions** - Active and historical positions
- **rewards** - Claimed rewards history
- **events** - Bot activity log
- **bot_state** - Bot configuration and state

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Solana wallet with SOL for transactions

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration

Edit `.env` file:

```env
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PRIVATE_KEY=your_base58_private_key

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meteora_bot
DB_USER=postgres
DB_PASSWORD=your_password

# Backend API
BACKEND_API_URL=http://localhost:5000

# External APIs
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Bot Parameters
MIN_TVL=100000
MIN_APR=50
MAX_POSITIONS=10
REBALANCE_INTERVAL_MINUTES=5
```

### Database Setup

```bash
# Create database
createdb meteora_bot

# Tables will be auto-created on first run
```

## Usage

### Start Bot

```bash
npm start
```

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Monitor Logs

```bash
tail -f logs/combined.log
```

## Bot Logic

### Position Entry Flow

1. **Data Update** (Every 1 minute)
   - Fetch pools from backend API
   - Enrich with DexScreener, Jupiter, RugCheck, Helius data
   - Save metrics to database

2. **Opportunity Scan** (Every 10 minutes)
   - Filter eligible pools (min TVL, min APR, security checks)
   - Score all pools (profitability, risk, liquidity, market conditions)
   - Select top-scored pool
   - Check position limits and capital availability
   - Determine optimal strategy (Spot/Curve/BidAsk)
   - Calculate bin range and token amounts
   - Execute position entry

3. **Position Monitoring** (Every 5 minutes)
   - Check all active positions
   - Monitor for exit conditions:
     - Impermanent loss > 10%
     - APR decline > 50%
     - Security alerts (rug pull indicators)
     - Liquidity drain > 30%
     - Price dump > 30% in 1h
     - Pool blacklisted
   - Check if rewards should be claimed
   - Check if rebalancing needed

### Scoring Algorithm

**Profitability Score (40%)**
- APR (40 pts): Higher APR = higher score
- Fee velocity (30 pts): Daily fees / TVL ratio
- Volume (20 pts): 24h volume / TVL ratio
- LM rewards (10 pts): Farming rewards availability

**Risk Score (30%)**
- Security rating (40 pts): RugCheck score
- Token authority (20 pts): Mint/freeze authority checks
- Holder concentration (20 pts): Top 10 holders distribution
- Volatility (10 pts): 24h price change
- Blacklist status (10 pts): Meteora blacklist

**Liquidity Health (20%)**
- TVL size (40 pts): Larger TVL = higher score
- Volume/TVL ratio (30 pts): Trading activity
- Transaction count (30 pts): Number of trades

**Market Conditions (10%)**
- Price trend (50 pts): Positive trends favored
- Buy/sell balance (50 pts): 40-60% buy ratio optimal

### Strategy Selection

**Curve Strategy**
- Conditions: Price change < 5%, buy ratio 40-60%
- Use case: Stable pairs, low volatility
- Liquidity: Concentrated in middle 80% within ±10%

**Spot Strategy**
- Conditions: Price change 5-20%, balanced volume
- Use case: Most pairs, moderate volatility
- Liquidity: Uniform distribution across ±20%

**Bid-Ask Strategy**
- Conditions: Price change > 20%
- Use case: High volatility, trending markets
- Liquidity: 70% at extremes, 30% middle

### Risk Management

**Position Limits**
- Max per pool: 20% of capital
- Max positions: 10
- Min reserve: 10% of capital

**Stop-Loss Triggers**
- IL > 10%: Exit immediately
- APR decline > 50%: Exit
- Security alert: Exit immediately
- TVL drop > 30%: Exit
- Price dump > 30%/1h: Exit
- Blacklisted: Exit immediately

**Reward Claiming**
- Claim when value > $10
- Auto-claim on position exit
- Track claimed amounts in database

## Safety Features

- **Pre-flight Security Checks**: Verify pool safety before every transaction
- **Transaction Validation**: Simulate transactions before execution
- **Graceful Shutdown**: Handle SIGINT/SIGTERM gracefully
- **Emergency Stop**: Command to exit all positions immediately
- **Error Logging**: Comprehensive error tracking and reporting
- **Position Limits**: Enforce maximum exposure and position counts

## Monitoring

### Bot Status

Check bot status from logs:
- Position entries/exits
- Reward claims
- Risk alerts
- Errors and warnings

### Database Queries

```sql
-- Active positions
SELECT * FROM positions WHERE status = 'active';

-- Recent events
SELECT * FROM events ORDER BY timestamp DESC LIMIT 20;

-- Pool metrics
SELECT * FROM pool_metrics WHERE pool_address = 'ADDRESS' ORDER BY timestamp DESC LIMIT 100;

-- Reward history
SELECT * FROM rewards ORDER BY claimed_at DESC;
```

### Performance Tracking

The bot logs statistics every 30 minutes:
- Total positions entered
- Total positions exited
- Total rewards claimed
- Error count

## Troubleshooting

### Bot won't start

1. Check `.env` configuration
2. Verify database connection
3. Check wallet balance (> 0.1 SOL recommended)
4. Check RPC endpoint accessibility

### No positions being entered

1. Check if pools meet criteria (min TVL, min APR)
2. Verify security checks are passing
3. Check available capital
4. Review pool scores in logs

### Position exited unexpectedly

Check logs for exit reason:
- Risk trigger (IL, APR decline, etc.)
- Security alert
- Rebalancing
- Better opportunity found

### Transaction failures

1. Check wallet SOL balance
2. Verify RPC endpoint is working
3. Check Solana network status
4. Review transaction simulation errors

## Development

### Project Structure

```
bot/
├── config/           # Configuration
├── models/           # Database models
├── services/         # Core services
├── utils/            # Helper functions
├── logs/             # Log files
├── index.js          # Main entry point
└── package.json      # Dependencies
```

### Adding New Features

1. Create service in `services/`
2. Import in `index.js`
3. Integrate into monitoring loop
4. Add tests
5. Update documentation

## Disclaimer

This bot is for educational purposes. Use at your own risk. Cryptocurrency trading and liquidity provision carry significant financial risk. Always test with small amounts first.

## License

MIT
