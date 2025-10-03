# 🚀 Live Deployment Guide

This guide will walk you through deploying the Meteora DLMM bot to live trading mode safely and methodically.

## ⚠️ Before You Begin

**IMPORTANT WARNINGS:**
- Start with small capital (0.5-1 SOL recommended for first deployment)
- Never deploy your entire wallet balance
- Always keep emergency SOL reserves for gas
- Monitor closely for the first 24-48 hours
- Be ready to use `/pause` or `/emergency` commands

## 📋 Pre-Flight Checklist

### 1. System Requirements
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running and accessible
- [ ] Stable internet connection
- [ ] Server/machine with 24/7 uptime (or use screen/tmux)

### 2. Wallet Setup
- [ ] **Create a dedicated trading wallet** (DO NOT use your main wallet)
- [ ] Fund wallet with 0.5-1 SOL for initial testing
- [ ] Backup private key securely (encrypted, offline storage)
- [ ] Verify public key in environment variables
- [ ] Test wallet access (check balance via Solana CLI or explorer)

### 3. Configuration Review

Review and update `.env` file:

```bash
# Trading Mode
PAPER_TRADING=false  # ⚠️ SET TO false FOR LIVE TRADING

# Wallet (use dedicated trading wallet!)
PRIVATE_KEY=your_wallet_private_key_base58
WALLET_PUBLIC_KEY=your_wallet_public_key

# Conservative Starting Limits (adjust after validation)
MAX_POSITIONS=3
MAX_POSITION_PERCENT=15
MIN_RESERVE_PERCENT=20

# Safety Limits (CRITICAL - DO NOT SKIP)
MAX_DAILY_CAPITAL_DEPLOYMENT=50
MAX_WEEKLY_CAPITAL_DEPLOYMENT=200
MAX_SINGLE_POSITION_SIZE=30
MAX_DAILY_LOSS_USD=20
MAX_WEEKLY_LOSS_USD=50
MIN_WALLET_RESERVE_SOL=0.1
MAX_WALLET_USAGE_PERCENT=80

# Risk Management
MAX_DRAWDOWN_PERCENT=15
CIRCUIT_BREAKER_ENABLED=true

# Notifications (REQUIRED for live trading)
ENABLE_NOTIFICATIONS=true
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 4. Database Preparation
```bash
# Backup existing database
pg_dump meteora_bot > meteora_bot_backup_$(date +%Y%m%d).sql

# Verify database connection
psql -h localhost -U postgres -d meteora_bot -c "SELECT 1"
```

### 5. Run Pre-Flight Checks
```bash
# Run automated pre-flight validation
node -e "
import preFlightCheck from './services/pre-flight-check.service.js';
preFlightCheck.runAllChecks().then(result => {
  if (!result.passed) {
    console.error('Pre-flight checks failed! Fix issues before deploying.');
    process.exit(1);
  }
  console.log('✅ All pre-flight checks passed!');
  process.exit(0);
});
"
```

**Required Checks:**
- [ ] ✅ Wallet configuration valid
- [ ] ✅ Wallet has sufficient balance (0.5+ SOL)
- [ ] ✅ Database connected
- [ ] ✅ Solana RPC responding
- [ ] ✅ Telegram notifications working
- [ ] ✅ Configuration parameters reasonable
- [ ] ✅ Strategies loaded correctly
- [ ] ✅ Price feed service working

## 🎯 Deployment Steps

### Phase 1: Initial Deployment (Day 1)

**1. Start with Conservative Settings**
```bash
# Verify .env settings are conservative
cat .env | grep -E "(PAPER_TRADING|MAX_POSITIONS|MAX_.*_DEPLOYMENT)"
```

**2. Start the Bot**
```bash
# Use screen or tmux for persistence
screen -S meteora-bot

# Start bot
cd /home/ayman/meteora-trending-pairs/bot
node index.js

# Detach from screen: Ctrl+A, then D
# Reattach later: screen -r meteora-bot
```

**3. Initial Monitoring (First 2 Hours)**

Watch for:
- [ ] Bot started successfully
- [ ] Telegram startup notification received
- [ ] No immediate errors in logs
- [ ] First pool scan completed
- [ ] Strategies evaluated correctly

**Monitor continuously:**
```bash
# View logs (if using screen)
screen -r meteora-bot

# Or tail logs if redirecting
tail -f bot.log
```

**4. First Position Entry**

When first position is entered:
- [ ] Receive Telegram notification
- [ ] Verify transaction on Solscan
- [ ] Check position recorded in database
- [ ] Confirm wallet balance decreased appropriately
- [ ] Review position details via `/positions` command

**Telegram Commands to Use:**
```
/status     - Check bot status
/positions  - View active positions
/stats      - See performance stats
/health     - System health check
/risk       - Portfolio risk assessment
```

**5. Position Monitoring**

For the first 24 hours:
- [ ] Check Telegram notifications every 1-2 hours
- [ ] Review logs for any warnings/errors
- [ ] Monitor wallet balance
- [ ] Check `/stats` and `/fees` every 6 hours
- [ ] Verify positions are being monitored correctly

### Phase 2: Validation Period (Days 2-7)

**1. Daily Checks**
- [ ] Morning: Review `/stats`, `/fees`, `/risk`
- [ ] Midday: Check for any alerts or warnings
- [ ] Evening: Review daily performance

**2. Performance Validation**

After 3-7 days, evaluate:
- Are positions being entered at good opportunities?
- Are fees being claimed profitably?
- Are risk limits working correctly?
- Are there any recurring errors?
- Is strategy selection performing well?

**3. Gradual Scaling**

If performing well after 7 days:
```bash
# Stop bot
/pause

# Update .env with slightly higher limits
MAX_DAILY_CAPITAL_DEPLOYMENT=100
MAX_SINGLE_POSITION_SIZE=50
MAX_POSITIONS=5

# Restart bot
/resume
```

### Phase 3: Ongoing Operations

**1. Daily Routine**
- Check Telegram daily summary (sent at midnight)
- Review `/fees` for profitability
- Check `/health` for system status
- Monitor for any alerts

**2. Weekly Review**
- Analyze strategy performance with `/leaderboard`
- Review optimization opportunities with `/optimize`
- Check database for any anomalies
- Backup database

**3. Monthly Maintenance**
- Review and adjust configuration based on performance
- Update strategy parameters if needed
- Check for bot updates
- Rotate logs if growing large

## 🚨 Emergency Procedures

### Auto-Pause Triggered
```
Cause: Safety limit reached (daily loss, tx failures, etc.)
Action:
1. Check /stats and /risk
2. Review logs for cause
3. Fix underlying issue
4. Use /resume when ready
```

### Circuit Breaker Activated
```
Cause: High volatility, rapid drawdown, or market chaos
Action:
1. Check /risk for drawdown details
2. Review active positions
3. Consider using /emergency to exit if needed
4. Wait for cooldown period
5. Resume when markets stabilize
```

### Transaction Failures
```
Cause: RPC issues, insufficient balance, or network problems
Action:
1. Check wallet balance
2. Verify RPC is responding
3. Check Solana network status
4. Review /health
5. Bot will auto-retry with backoff
```

### High Losses
```
Cause: Market movement, poor entries, or strategy issues
Action:
1. Use /pause immediately
2. Review /fees and /stats
3. Analyze losing positions
4. Adjust strategy priorities or risk limits
5. Consider /emergency if drawdown too high
```

## 🛠️ Commands Quick Reference

### Control Commands
```
/pause      - Pause all operations (keeps positions open)
/resume     - Resume operations after pause
/stop       - Stop bot completely
/emergency  - Exit all positions immediately and stop
```

### Monitoring Commands
```
/status     - Bot status and uptime
/positions  - Active positions list
/stats      - Performance statistics
/fees       - Fee tracking and profitability
/health     - System health check
/risk       - Portfolio risk analysis
```

### Analysis Commands
```
/strategies    - List all strategies
/leaderboard   - Strategy performance ranking
/report        - Detailed performance report
/optimize      - Optimization opportunities
```

## 📊 Key Metrics to Track

### Daily
- Net fees earned (should be positive after gas costs)
- Number of positions entered/exited
- Average position hold time
- Transaction success rate
- Any errors or warnings

### Weekly
- Total PnL
- Strategy win rate
- Average ROI per position
- Capital efficiency
- Drawdown levels

### Monthly
- Overall profitability
- Best/worst performing strategies
- Market conditions impact
- Configuration optimization opportunities

## ⚙️ Configuration Tuning

Based on performance, adjust:

### If Too Conservative (missing opportunities)
- Increase `MAX_POSITIONS`
- Lower `MIN_TVL` slightly
- Lower `MIN_APR` slightly
- Increase `MAX_DAILY_CAPITAL_DEPLOYMENT`

### If Too Aggressive (too many losses)
- Decrease `MAX_POSITIONS`
- Increase `MIN_TVL`
- Increase `MIN_APR`
- Decrease `MAX_POSITION_PERCENT`
- Tighten risk limits

### If Getting Stopped Out Too Often
- Increase `MAX_DRAWDOWN_PERCENT` slightly
- Adjust `MAX_PRICE_DROP_PERCENT`
- Review strategy exit conditions

## 🔐 Security Best Practices

1. **Never share your private key**
2. **Use a dedicated trading wallet** (not your main wallet)
3. **Keep emergency SOL separate** (don't deploy 100% of wallet)
4. **Backup database regularly**
5. **Monitor Telegram notifications**
6. **Use strong passwords for database**
7. **Keep server/machine secure**
8. **Review transactions on Solscan regularly**

## 📞 Getting Help

If you encounter issues:

1. Check logs for error details
2. Review this guide
3. Check Telegram alerts
4. Use `/health` and `/risk` commands
5. Check database for position states
6. Review Solana network status

## ✅ Final Checklist Before Going Live

- [ ] I have read and understood this entire guide
- [ ] I am using a dedicated trading wallet (not my main wallet)
- [ ] I have backed up my wallet private key securely
- [ ] I have set PAPER_TRADING=false
- [ ] I have configured conservative safety limits
- [ ] I have tested Telegram notifications
- [ ] I have run and passed pre-flight checks
- [ ] I am starting with small capital (0.5-1 SOL)
- [ ] I am prepared to monitor for the first 24-48 hours
- [ ] I know how to use /pause and /emergency commands
- [ ] I understand the risks of automated trading

---

**Remember:** Automated trading carries risk. Start small, monitor closely, and scale gradually as you gain confidence in the system. Never risk more than you can afford to lose.

**Good luck! 🚀**
