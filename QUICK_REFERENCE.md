# Meteora Trending Pairs - Quick Reference Guide

## What Does This Application Do?

A comprehensive real-time analytics dashboard for Meteora DLMM liquidity pools on Solana, featuring:
- Live pool data with advanced filtering and sorting
- Capital rotation opportunity monitoring with Telegram alerts
- Degen mode for high-frequency fee rate monitoring
- Security analysis with RugCheck integration
- Token holder distribution analysis

---

## Key Components At a Glance

### Frontend (React) - `/frontend/src/`
| Component | Purpose |
|-----------|---------|
| `AnalyticsPage.js` | Main dashboard with pool data, filters, sorting |
| `PairsTable.js` | Sortable table with expandable rows |
| `ExpandedRow.js` | Detailed pool information in 3-column layout |
| `PairsFilters.js` | Advanced filtering controls (volume, fees, APR, etc.) |
| `CapitalRotationPage.js` | Wallet monitoring and alerts |
| `DegenMode/` | High-frequency fee monitoring component |

### Backend (Flask) - `/backend/`
| Module | Purpose |
|--------|---------|
| `app.py` | Main API server (pairs, health, auth endpoints) |
| `pool_cache.py` | 5-min cache for Meteora pool data (singleton) |
| `models.py` | SQLAlchemy database models |
| `monitoring_service.py` | Capital rotation monitoring scheduler |
| `telegram_bot.py` | Telegram bot commands and notifications |
| `degen_monitoring.py` | High-frequency fee rate monitoring |
| `wallet_manager.py` | Encrypted wallet storage |

### Microservice (Node.js) - `/services/dlmm-service/`
| Module | Purpose |
|--------|---------|
| `index.js` | Express server for liquidity endpoints |
| `dlmmController.js` | DLMM liquidity distribution calculations |

---

## API Endpoints Quick List

### Analytics Endpoints
```
GET /api/pairs?page=1&limit=50&search=SOL&min_liquidity=10000&sort_by=fees_24h
→ Returns: Paginated pairs data with filters and sorting

GET /api/health
→ Returns: Service health status
```

### Capital Rotation Endpoints (if DATABASE_ENABLED)
```
POST /api/auth/generate-code
→ Returns: {code: "ABC123", expires_at: timestamp}

POST /api/monitoring/config
→ Configure monitoring interval and thresholds

GET /api/monitoring/opportunities
→ Returns: Historical detected opportunities
```

### Degen Mode Endpoints (if DATABASE_ENABLED)
```
POST /api/degen/setup
→ Setup wallet and fee rate thresholds

POST /api/degen/config
→ Update monitoring settings
```

### DLMM Service Endpoints (Port 3001)
```
GET /api/liquidity-distribution/:pairAddress
→ Returns: Liquidity distribution bins for a pool

GET /api/aggregated-liquidity?mint_x=X&mint_y=Y
→ Returns: Aggregated liquidity across all pools
```

---

## Data Sources (External APIs)

| Source | Data | Used For |
|--------|------|----------|
| **Meteora API** | Pool addresses, prices, volumes, fees, APR, TVL | Core pool data |
| **DexScreener** | Real-time prices, charts, transaction data | Market statistics |
| **Jupiter API** | Token metadata, logos, symbols | Token information |
| **RugCheck** | Security scores, vulnerability detection | Security analysis |
| **Helius RPC** | Top token holders, distribution | Holder analysis |
| **BubbleMaps** | Token distribution visualization | Distribution maps |
| **Solscan** | Blockchain explorer links | Transaction details |

---

## Database Models

### Core Tables
- **users**: Wallet address → Telegram chat ID mapping
- **monitoring_configs**: User monitoring preferences and thresholds
- **degen_configs**: Degen mode settings with encrypted private keys
- **telegram_auth_codes**: Temporary codes for Telegram authentication
- **opportunity_snapshots**: Historical records of detected opportunities

### Key Relationships
```
User (wallet_address)
├── MonitoringConfig (1:1)
├── DegenConfig (1:1)
└── OpportunitySnapshots (1:many)
```

---

## Running the Application

### Development Setup
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py  # Runs on http://localhost:5000

# Frontend (in new terminal)
cd frontend
npm install
npm start  # Runs on http://localhost:3000

# DLMM Service (in new terminal)
cd services/dlmm-service
npm install
npm start  # Runs on http://localhost:3001
```

### Environment Variables Needed
**Backend (.env)**:
- `DATABASE_URL` - PostgreSQL connection (optional, app runs in analytics-only mode without it)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (required for monitoring features)
- `TELEGRAM_BOT_USERNAME` - Bot username (required for monitoring features)
- `FLASK_ENV` - Set to 'development'

**DLMM Service (.env)**:
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `PORT` - Server port (default 3001)

---

## Key Features Explained

### 1. Analytics Dashboard
- **Filter**: Volume, fees, APR, liquidity, pool parameters
- **Sort**: By fee rate, 24h fees, liquidity, or pair name
- **Expand**: Click row to see detailed metrics, security analysis, holders
- **Auto-Refresh**: Automatically updates every 60 seconds (configurable)
- **Search**: Find pairs by name or address

### 2. Capital Rotation Monitoring
- **Purpose**: Detect pools with fees above your threshold
- **Interval**: Configurable check interval (5-60 minutes)
- **Threshold**: Set multiplier for opportunity detection
- **Alerts**: Telegram notifications when opportunities found
- **History**: View past opportunities in dashboard

### 3. Degen Mode
- **Purpose**: Monitor ALL pools for high 30-minute fee rates
- **Frequency**: Check every 1-60 minutes
- **Alerts**: Instant Telegram notification when pools hit threshold
- **Smart Filtering**: Avoids duplicate notifications
- **Setup**: Import wallet or generate new one

### 4. Security Analysis
- **RugCheck**: Comprehensive security risk assessment
- **Mint/Freeze Authority**: Check if token is frozen
- **Holder Distribution**: Top holders and concentration
- **Blacklist Check**: Identifies blacklisted pools

---

## Performance Optimizations

### Backend
- **Pool Cache**: 5-minute singleton cache prevents redundant API calls
- **Server-Side Filtering**: Reduces data transmission to frontend
- **Pagination**: Load only 50 items per page (max 100)
- **Connection Pooling**: Reuse database connections
- **Garbage Collection**: Explicit memory cleanup

### Frontend
- **Client-Side Caching**: localStorage for filters and data
- **Virtual Scrolling**: Efficient rendering of large lists
- **Lazy Loading**: Fetch expanded row details on-demand
- **Parallel Requests**: Use Promise.all() for concurrent API calls
- **Code Splitting**: React Router pages split separately

---

## Important Files & Locations

### Key Frontend Files
- `src/pages/AnalyticsPage.js` - Main dashboard logic
- `src/components/Table/PairsTable.js` - Table rendering
- `src/components/Filters/PairsFilters.js` - Filter controls
- `src/utils/helpers.js` - Formatting and utility functions
- `src/utils/cache.js` - Client-side caching logic

### Key Backend Files
- `app.py` - Flask routes and data processing (59KB)
- `pool_cache.py` - Meteora API caching logic
- `monitoring_service.py` - Capital rotation scheduler
- `telegram_bot.py` - Telegram bot handlers
- `models.py` - Database models

### Configuration Files
- `frontend/package.json` - React dependencies
- `backend/requirements.txt` - Python dependencies
- `services/dlmm-service/package.json` - Node dependencies
- `backend/supabase_schema.sql` - Database schema

---

## Troubleshooting Quick Tips

### "No data showing"
- Check Meteora API status
- Verify cache is refreshing (look for logs)
- Try force refresh with `?force_refresh=true`

### "Database features not available"
- DATABASE_URL environment variable not set
- Running in analytics-only mode (normal if desired)
- Telegram features require DATABASE_URL

### "Telegram notifications not working"
- Verify TELEGRAM_BOT_TOKEN is correct
- Check bot is running (see telegram_bot.py logs)
- Verify user is authenticated with bot

### "Slow performance"
- Check network request waterfall in DevTools
- Verify cache is working (check console logs)
- Reduce page limit or number of filters

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
│  AnalyticsPage → PairsTable → ExpandedRow → APIs       │
│  PairsFilters ↓ Navigation ↓ DegenMode ↓               │
└──────────────────────┬──────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│               BACKEND (Flask) @ :5000                   │
│  /api/pairs ← PoolCache ← Meteora API                  │
│  Auth/Monitoring ← Database (PostgreSQL)               │
│  Telegram Bot ← Scheduling (APScheduler)               │
└──────────────────────┬──────────────────────────────────┘
        ↓                       ↓                    ↓
┌──────────────┐    ┌─────────────────┐    ┌────────────────┐
│ Meteora API  │    │  PostgreSQL DB  │    │ Telegram Bot   │
│ DexScreener  │    │  (Supabase)     │    │ API            │
│ Jupiter      │    └─────────────────┘    └────────────────┘
│ RugCheck     │
│ Helius RPC   │
│ BubbleMaps   │
└──────────────┘
```

---

## Next Steps for Development

1. **For Analytics Features**: Modify `AnalyticsPage.js` and `PairsTable.js`
2. **For New Filters**: Edit `PairsFilters.js` and `app.py` processing
3. **For Monitoring**: Work with `monitoring_service.py` and `DegenConfig` model
4. **For APIs**: Add routes in `app.py` or DLMM service `index.js`
5. **For Security**: Update checks in `SecurityReport.js` component

---

**Documentation created**: 2025-11-11
**For detailed information**: See `PROJECT_DOCUMENTATION.md`
