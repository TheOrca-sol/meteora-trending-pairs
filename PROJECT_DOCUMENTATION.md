# Meteora Trending Pairs Application - Comprehensive Documentation

## Overview

The Meteora Trending Pairs Application is a comprehensive real-time analytics dashboard and monitoring platform for tracking trending liquidity pools on Meteora's Dynamic Liquidity Market Maker (DLMM) protocol on the Solana blockchain. It provides traders, liquidity providers, and DeFi researchers with advanced analytics, security analysis, and capital rotation monitoring capabilities.

---

## 1. Application Purpose & Features

### Primary Purpose
Monitor and analyze Meteora DLMM liquidity pools in real-time to identify trading opportunities, track performance metrics, and facilitate data-driven investment decisions.

### Core Features

#### Analytics Dashboard
- **Real-Time Pool Data**: Live metrics from Meteora's DLMM API with configurable auto-refresh (60 seconds default)
- **Comprehensive Filtering**: Advanced filters for volume, fees, APR, liquidity, and pool parameters
- **Pair Search**: Search functionality by pair name or token address
- **Sorting & Pagination**: Server-side processing for efficient data navigation
- **Multi-Timeframe Analysis**: Volume and price changes across 5m, 1h, 6h, and 24h periods

#### Advanced Metrics
- **Fee Analytics**: 30-minute and 24-hour fee generation tracking
- **APR Calculation**: Annual Percentage Rate based on daily fees
- **TVL Tracking**: Total Value Locked in USD
- **Transaction Analysis**: Buy/sell transaction counts with visual percentage indicators
- **Price Analytics**: Current price with precision formatting and multi-source aggregation

#### Security & Analysis Features
- **RugCheck Integration**: Comprehensive token security analysis and risk assessment
- **Holder Distribution**: Top token holders and concentration analysis
- **BubbleMaps Integration**: Interactive token distribution visualization
- **Blacklist Detection**: Identifies and flags blacklisted pairs from Meteora
- **Authority Status**: Displays mint and freeze authority information

#### User Experience
- **Dark/Light Theme Toggle**: Theme persistence via localStorage
- **Responsive Design**: Optimized for desktop and mobile devices
- **Expandable Rows**: Detailed pair information with tabbed sections
- **Copy to Clipboard**: Quick address copying
- **External Links**: Direct integration with Solscan, Meteora app, and DexScreener

#### Capital Rotation Monitoring (Database Feature)
- **Wallet Integration**: Connect wallet for personalized monitoring
- **Automated Monitoring**: Track capital rotation opportunities at configurable intervals
- **Telegram Notifications**: Real-time alerts for monitored opportunities
- **Custom Thresholds**: Configure fee thresholds and monitoring preferences

#### Degen Mode (High-Frequency Monitoring)
- **Fee Rate Monitoring**: Monitor high 30-minute fee rate pools
- **Configurable Intervals**: Check every 1-60 minutes
- **Telegram Alerts**: Instant notifications for high-fee pools
- **Smart Filtering**: Avoid duplicate notifications with tracking

---

## 2. Project Structure

```
meteora-trending-pairs/
├── frontend/                          # React web application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Table/
│   │   │   │   ├── PairsTable.js          # Main table component with sorting & expanding
│   │   │   │   ├── ExpandedRow.js         # Detailed row information (3-column layout)
│   │   │   │   ├── MarketStats.js         # Market statistics tab
│   │   │   │   ├── TokenInformation.js    # Token info tab
│   │   │   │   ├── TokenHolders.js        # Holder distribution tab
│   │   │   │   ├── SecurityReport.js      # RugCheck security analysis tab
│   │   │   │   ├── BubbleMaps.js          # Token distribution visualization
│   │   │   │   ├── ExternalLinks.js       # Explorer/app links
│   │   │   │   ├── columns.js             # Column definitions
│   │   │   │   └── TableSkeleton.js       # Loading skeleton
│   │   │   ├── Filters/
│   │   │   │   └── PairsFilters.js        # Advanced filtering controls
│   │   │   ├── DegenMode/
│   │   │   │   ├── DegenMode.js           # Degen mode main component
│   │   │   │   ├── WalletSetup.js         # Wallet connection/setup
│   │   │   │   └── MonitoringControls.js  # Control degen monitoring
│   │   │   ├── Navigation/
│   │   │   │   └── Navigation.js          # Top navigation with tabs
│   │   │   ├── ThemeToggle/
│   │   │   │   └── ThemeToggle.js         # Dark/light theme switcher
│   │   │   ├── Footer/
│   │   │   │   └── Footer.js              # Footer component
│   │   │   ├── CapitalRotation/           # Capital rotation components
│   │   │   ├── LiquidityDistribution/     # Liquidity visualization
│   │   │   └── ErrorBoundary.js           # Error boundary wrapper
│   │   ├── pages/
│   │   │   ├── AnalyticsPage.js           # Main analytics dashboard
│   │   │   └── CapitalRotationPage.js     # Capital rotation monitoring
│   │   ├── features/
│   │   │   └── rotation/
│   │   │       ├── api/
│   │   │       └── pages/
│   │   ├── services/
│   │   │   ├── capitalRotationService.js  # Capital rotation API calls
│   │   │   └── monitoringService.js       # Monitoring API calls
│   │   ├── utils/
│   │   │   ├── analytics.js               # Google Analytics integration
│   │   │   ├── theme.js                   # Theme definitions
│   │   │   ├── helpers.js                 # Utility functions
│   │   │   ├── cache.js                   # Client-side caching
│   │   │   └── constants.js               # Application constants
│   │   ├── contexts/
│   │   │   └── WalletContext.js           # Wallet context provider
│   │   ├── App.js                         # Main app component
│   │   └── index.js                       # React entry point
│   ├── package.json                       # Frontend dependencies
│   └── public/
├── backend/                           # Flask Python backend
│   ├── app.py                         # Main Flask application (59KB)
│   ├── models.py                      # SQLAlchemy database models
│   ├── pool_cache.py                  # Meteora pool data cache (singleton pattern)
│   ├── grouped_pool_cache.py          # Alternative cache for grouped pools
│   ├── pool_cache.py                  # Core cache logic
│   ├── monitoring_service.py          # Capital rotation monitoring scheduler
│   ├── telegram_bot.py                # Telegram bot handler (20KB)
│   ├── wallet_manager.py              # Wallet encryption/decryption
│   ├── services/
│   │   ├── monitoring/
│   │   │   ├── degen_monitoring.py    # Degen mode monitoring service
│   │   │   └── __init__.py
│   │   └── __init__.py
│   ├── requirements.txt                # Python dependencies
│   ├── .env                           # Environment configuration
│   ├── supabase_schema.sql            # Database schema
│   ├── migrate_db.py                  # Database migration script
│   └── venv/                          # Python virtual environment
├── services/
│   └── dlmm-service/                  # Node.js microservice for DLMM data
│       ├── index.js                   # Express server
│       ├── dlmmController.js          # DLMM liquidity distribution logic
│       ├── package.json               # Node dependencies
│       └── node_modules/
├── README.md                          # Main project documentation
├── TELEGRAM_MONITORING_SETUP.md       # Telegram bot setup guide
└── .git/                              # Git repository

```

---

## 3. Technology Stack

### Frontend
- **React 18**: UI framework with hooks for state management
- **Material-UI (MUI) 6.4**: Professional component library and theming
- **Axios 1.7.7**: HTTP client for API calls
- **Chart.js & react-chartjs-2**: Data visualization
- **Solana Web3.js**: Blockchain interaction
- **Wallet Adapter**: Solana wallet integration (@solana/wallet-adapter-react)
- **React Router**: Client-side routing
- **Google Analytics (react-ga4)**: Analytics tracking
- **Vercel Analytics**: Performance monitoring
- **React Virtuoso**: Virtual scrolling for large datasets

### Backend
- **Python 3.x**: Server-side language
- **Flask 2.x**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **SQLAlchemy**: ORM for database operations
- **APScheduler**: Scheduled job execution for monitoring
- **python-telegram-bot**: Telegram bot integration
- **Requests**: HTTP library for API calls
- **Cryptography**: Private key encryption/decryption
- **Solana-py**: Solana blockchain interaction
- **psycopg2**: PostgreSQL database driver
- **python-dotenv**: Environment variable management

### Database
- **PostgreSQL** (via Supabase): User data, configurations, and monitoring snapshots
- **JSONB**: Flexible data storage for complex objects

### Microservice (Node.js)
- **Express**: Web framework
- **@meteora-ag/dlmm**: Meteora SDK for liquidity calculations
- **@solana/web3.js**: Blockchain interaction
- **Axios**: HTTP requests
- **Solana SDKs**: Various Solana ecosystem libraries

### External APIs & Services
- **Meteora DLMM API**: Primary pool data source (`https://dlmm-api.meteora.ag/pair/all`)
- **DexScreener API**: Real-time market data and trading activity
- **Jupiter API**: Token metadata and information
- **RugCheck API**: Token security analysis
- **Helius RPC**: Solana blockchain data (token holders)
- **BubbleMaps**: Token distribution visualization
- **Solscan**: Blockchain explorer integration

---

## 4. API Endpoints & Data Flow

### Backend Flask Endpoints

#### Analytics Endpoints
```
GET /api/pairs
├── Query Parameters:
│   ├── page (int): Page number for pagination (default: 1)
│   ├── limit (int): Items per page, max 100 (default: 50)
│   ├── search (string): Search by pair name or address
│   ├── min_liquidity (float): Minimum TVL filter
│   ├── min_volume_24h (float): Minimum 24h volume filter
│   ├── sort_by (string): Sort field (fee_rate_30min, fees_24h, liquidity, name)
│   └── force_refresh (bool): Bypass cache
└── Response:
    ├── data: Array of pair objects
    ├── pagination: {page, limit, total, total_pages, has_next, has_prev}
    └── timestamp: Last update

GET /api/health
└── Response: {status: "healthy", timestamp: ISO string}
```

#### Capital Rotation Endpoints
```
GET /api/auth/generate-code
└── Response: {code: "ABC123", expires_at: timestamp}

POST /api/auth/verify-code
├── Body: {code: "ABC123", wallet_address: "..."}
└── Response: {success: bool, message: string}

GET /api/monitoring/status
├── Headers: Authorization: Bearer token
└── Response: {enabled, config, next_check, last_check}

POST /api/monitoring/config
├── Headers: Authorization: Bearer token
├── Body: {enabled, interval_minutes, threshold_multiplier, min_fees_30min}
└── Response: {success, config}

GET /api/monitoring/opportunities
├── Headers: Authorization: Bearer token
└── Response: {opportunities: Array, last_check: timestamp}
```

#### Degen Mode Endpoints
```
POST /api/degen/setup
├── Body: {degen_wallet_address, private_key, min_fee_rate_threshold}
└── Response: {success, config}

GET /api/degen/status
├── Headers: Authorization: Bearer token
└── Response: {enabled, config, next_check}

POST /api/degen/config
├── Headers: Authorization: Bearer token
├── Body: {enabled, check_interval_minutes, min_fee_rate_threshold}
└── Response: {success, config}
```

### DLMM Microservice Endpoints

```
GET /api/liquidity-distribution/:pairAddress
├── Response:
│   └── {success, data: {bins: [], totalLiquidity, activeLength}}

GET /api/aggregated-liquidity
├── Query: mint_x, mint_y
└── Response: {success, data: {pools: [], bins: [], total}}

GET /health
└── Response: {status: "healthy", timestamp}
```

### Data Flow Diagram

```
Frontend (React)
    ↓
    ├→ GET /api/pairs → Backend (Flask) → Cache → Meteora API
    ├→ GET /api/liquidity-distribution → DLMM Service → Meteora SDK
    ├→ DexScreener API (browser) → Market data
    ├→ Jupiter API (browser) → Token metadata
    ├→ RugCheck API (browser) → Security analysis
    ├→ Helius RPC (browser) → Token holders
    └→ BubbleMaps (browser) → Token visualization

Capital Rotation Flow:
Frontend → Backend → Database → Telegram Bot → User

Degen Mode Flow:
Backend Scheduler → Pool Cache → Telegram Bot → User
```

---

## 5. Frontend Pages & Components

### AnalyticsPage.js (Main Dashboard)
**Purpose**: Display real-time DLMM pool analytics with advanced filtering

**Key Features**:
- Data fetching with caching and auto-refresh
- Advanced filtering system (liquidity, volume, fees, APR)
- Sorting by multiple criteria (fee rate, fees, liquidity, name)
- Pagination with lazy loading
- Live data updates with visual indicators
- Filter persistence in localStorage
- Error handling and loading states

**State Management**:
- `allPairs`: Complete fetched dataset
- `displayedPairs`: Currently visible pairs after filtering
- `filters`: Active filter values
- `autoRefresh`: Auto-refresh toggle
- `loading/refreshing/loadingMore`: Loading states
- `lastUpdated`: Timestamp of last update

**Auto-Refresh Mechanism**:
- Configurable interval (default 60 seconds)
- Visual countdown indicator
- Manual refresh button
- Smart data caching to reduce API calls

### CapitalRotationPage.js
**Purpose**: Capital rotation opportunity monitoring with Telegram notifications

**Features**:
- Wallet connection and authentication
- Monitoring configuration management
- Real-time opportunity tracking
- Historical opportunity snapshots
- Threshold customization
- Telegram link generation with auth codes

### Table Components

#### PairsTable.js
- Sortable table with Material-UI TableSort
- Expandable rows for detailed information
- Column definitions from `columns.js`
- Responsive design (collapsible columns on mobile)
- Selection and bulk operations
- Loading skeleton during data fetch

#### ExpandedRow.js (Three-Column Layout)
**Left Column**:
- Pool metadata
- Current prices
- Fee information
- Transaction data

**Middle Column**:
- Token information
- Security analysis
- Holder distribution
- Authority checks

**Right Column**:
- Market statistics
- Volume analysis
- Price changes
- Liquidity charts

**Tabs**:
- Market Stats
- Token Information
- Security Report
- Token Holders

#### Supporting Components:
- **MarketStats.js**: Volume, price change, liquidity data
- **TokenInformation.js**: Token details, metadata, links
- **SecurityReport.js**: RugCheck integration, risk scores
- **TokenHolders.js**: Top holders, concentration analysis
- **BubbleMaps.js**: Token distribution visualization
- **ExternalLinks.js**: Solscan, Meteora app, DexScreener links

### Filter Components

#### PairsFilters.js
**Filter Options**:
- Pair name/address search
- Minimum 30-minute fees
- Minimum 24-hour volume
- Minimum total liquidity (TVL)
- Minimum APR
- Bin step and base fee percentage
- Blacklist toggle
- Sorting preferences

**Features**:
- Real-time filtering as user types
- Preset filter templates
- Clear filters button
- Responsive mobile design

### DegenMode Component
**Subcomponents**:
- **WalletSetup.js**: Import/generate wallet, display address
- **MonitoringControls.js**: Enable/disable monitoring, configure thresholds
- **DegenMode.js**: Main component orchestrating the UI

**Features**:
- Wallet import and generation
- Fee rate threshold configuration
- Check interval customization
- Enable/disable toggle
- Status display
- Recent alerts/notifications

### Navigation & Theme
- **Navigation.js**: Tab navigation between Analytics and Capital Rotation
- **ThemeToggle.js**: Light/dark theme switcher
- **Footer.js**: Copyright and links

---

## 6. Special Features

### Telegram Bot Integration

#### Authentication Flow
1. User generates auth code in web app
2. Code sent to Telegram bot via `/start AUTH_CODE`
3. Bot verifies code against database
4. User linked to wallet
5. Monitoring config created automatically

#### Commands
```
/start [AUTH_CODE]        - Link wallet to Telegram
/status                   - Show monitoring status
/stop                     - Unlink wallet
/help                     - Show available commands
/degen_status            - Show degen mode status
/degen_stop              - Stop degen mode
/degen_threshold NUMBER  - Set fee rate threshold
```

#### Notification Types
- **Capital Rotation Alerts**: New opportunities detected
- **Degen Mode Alerts**: High 30-minute fee rate pools
- **Status Updates**: Monitoring started/stopped
- **Error Notifications**: Connection issues, configuration errors

### Wallet Manager
**Features**:
- Encrypt private keys using Fernet symmetric encryption
- Safe storage in database
- Key rotation support
- Secure deletion on user removal

**Methods**:
- `encrypt_private_key(private_key)`: Encrypt and store
- `decrypt_private_key()`: Retrieve and decrypt
- `import_wallet(private_key)`: Import existing wallet
- `generate_wallet()`: Create new wallet via Solana SDK

### Capital Rotation Monitoring Service

**Process**:
1. Load active monitoring configs from database
2. Schedule background jobs for each wallet (configurable interval 5-60 minutes)
3. Fetch pool data every interval
4. Compare against threshold multiplier
5. Detect new opportunities (fee rate > threshold)
6. Store snapshots in database
7. Send Telegram notifications

**Database Tables**:
- `users`: Wallet addresses and Telegram IDs
- `monitoring_configs`: User monitoring preferences
- `opportunity_snapshots`: Historical records of opportunities
- `telegram_auth_codes`: Temporary auth codes

### Degen Mode Monitoring Service

**Purpose**: High-frequency monitoring of all pools for high 30-minute fee rates

**Process**:
1. Load active degen configs from database
2. Schedule monitoring jobs (1-60 minute intervals)
3. Fetch all pools from cache
4. Filter by configured fee rate threshold
5. Send notifications for pools above threshold
6. Track notified pools to avoid duplicate alerts
7. Use smart deduplication based on last notification time

**Database Model**:
```
DegenConfig:
- wallet_address (FK)
- wallet_type (imported/generated)
- degen_wallet_address
- encrypted_private_key
- min_fee_rate_threshold (%)
- check_interval_minutes
- enabled (boolean)
- automation_enabled (Phase 2)
- last_notified_pools (JSONB with timestamps)
```

### Pool Cache (Singleton Pattern)

**Purpose**: Prevent redundant API calls to Meteora

**Features**:
- Single instance shared across all requests
- 5-minute cache duration (configurable)
- Thread-safe with locking mechanism
- Automatic filtering of trash pools
- Statistics tracking (cache hits, misses, filtered counts)

**Filtering Criteria**:
- Minimum TVL: $100 USD
- Filter hidden pools
- Filter blacklisted pools

**Cache Statistics**:
```
{
  cache_hits: count,
  cache_misses: count,
  total_pools_raw: count,
  total_pools_filtered: count,
  pools_filtered_out: count
}
```

### DLMM Liquidity Distribution Service

**Purpose**: Detailed liquidity visualization for individual pools

**Features**:
- Fetch DLMM pair liquidity distribution (bins)
- Calculate aggregate liquidity across pools
- Support for multiple token pairs
- Express REST API
- Error handling with detailed error messages

**Response Structure**:
```json
{
  "success": true,
  "data": {
    "bins": [
      {"price": number, "liquidity": number, "liquidityPercentage": number}
    ],
    "totalLiquidity": number,
    "activeLength": number
  }
}
```

---

## 7. Database Models

### Users Table
```sql
CREATE TABLE users (
  wallet_address VARCHAR(44) PRIMARY KEY,
  telegram_chat_id BIGINT UNIQUE NOT NULL,
  telegram_username VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### MonitoringConfig Table
```sql
CREATE TABLE monitoring_configs (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(44) REFERENCES users(wallet_address),
  enabled BOOLEAN DEFAULT FALSE,
  interval_minutes INTEGER DEFAULT 15,
  threshold_multiplier DECIMAL(4,2) DEFAULT 1.3,
  whitelist JSONB DEFAULT '[]',
  quote_preferences JSONB DEFAULT '{"sol": true, "usdc": true}',
  min_fees_30min DECIMAL(10,2) DEFAULT 100.0,
  last_check TIMESTAMP,
  next_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### DegenConfig Table
```sql
CREATE TABLE degen_configs (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(44) REFERENCES users(wallet_address),
  wallet_type VARCHAR(20) NOT NULL, -- 'imported' or 'generated'
  degen_wallet_address VARCHAR(44) NOT NULL,
  encrypted_private_key BYTEA NOT NULL,
  min_fee_rate_threshold DECIMAL(10,2) DEFAULT 5.0,
  check_interval_minutes INTEGER DEFAULT 1,
  enabled BOOLEAN DEFAULT FALSE,
  automation_enabled BOOLEAN DEFAULT FALSE,
  max_position_size DECIMAL(10,2),
  last_check TIMESTAMP,
  next_check TIMESTAMP,
  last_notified_pools JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### OpportunitySnapshot Table
```sql
CREATE TABLE opportunity_snapshots (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(44) REFERENCES users(wallet_address),
  opportunities JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### TelegramAuthCode Table
```sql
CREATE TABLE telegram_auth_codes (
  code VARCHAR(6) PRIMARY KEY,
  wallet_address VARCHAR(44) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Key Technologies & Integrations

### Real-Time Data Sources
- **Meteora DLMM API**: Pool addresses, prices, volumes, fees, APR, TVL
- **DexScreener**: Real-time market data, price changes, trading volume
- **Jupiter**: Token metadata, logos, decimals, trading statistics
- **Solscan**: Transaction explorer links
- **Helius RPC**: Token holder information and distribution

### Security & Analysis
- **RugCheck API**: Security risk scores, vulnerability detection, rug pull indicators
- **BubbleMaps**: Token distribution visualization
- **Mint/Freeze Authority Checks**: Token authority status

### Infrastructure
- **Supabase/PostgreSQL**: User data and monitoring configurations
- **Telegram Bot API**: Push notifications
- **Solana RPC**: Blockchain interaction
- **Google Analytics**: Usage tracking
- **Vercel Analytics**: Performance monitoring

---

## 9. Performance & Scalability

### Optimization Strategies

#### Backend
- **Server-Side Filtering & Sorting**: Reduces data transmission
- **Pagination**: Only load visible data
- **Connection Pooling**: Reuse database connections (pool_size=10, max_overflow=20)
- **Garbage Collection**: Explicit gc.collect() calls for memory management
- **Thread Pool Executor**: APScheduler with 10 worker threads
- **Caching**: 5-minute pool cache with singleton pattern
- **Index Creation**: Performance indexes on monitoring queries

#### Frontend
- **Client-Side Caching**: localStorage for filters and data
- **Virtual Scrolling**: React Virtuoso for large datasets
- **Lazy Data Loading**: Fetch expanded row details on demand
- **Parallel API Calls**: Promise.all() for concurrent requests
- **Smart Fallbacks**: Use Jupiter data when DexScreener unavailable
- **Code Splitting**: React Router for page-level code splitting

### Scalability Considerations
- **Multi-user Monitoring**: Background scheduler handles multiple concurrent monitors
- **Job Deduplication**: Prevents duplicate monitoring jobs for same wallet
- **Configurable Intervals**: Adjust monitoring frequency per wallet
- **Database Cleanup**: Hourly cleanup of expired auth codes and old snapshots
- **Connection Limits**: Max 20 concurrent connections to database

---

## 10. Project Configuration

### Environment Variables (.env)

**Backend**:
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Telegram
TELEGRAM_BOT_TOKEN=xxxxx:xxxxx
TELEGRAM_BOT_USERNAME=bot_name

# Application
FLASK_ENV=development
SECRET_KEY=random_secret_key

# Cache
USE_GROUPED_CACHE=false  # Use PoolDataCache (recommended)

# Monitoring
ENCRYPTION_KEY=base64_encoded_key
```

**Frontend**:
- API base URL configuration
- Analytics tracking IDs
- Feature flags

**DLMM Service**:
```env
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/
NODE_ENV=production
PORT=3001
```

---

## 11. Data Processing Pipeline

### Pool Data Pipeline
```
Meteora API
    ↓
PoolDataCache (5-min cache)
    ↓
Filtering (min TVL $100, hide, blacklist)
    ↓
Sorting (fee rate, fees, liquidity, name)
    ↓
Pagination (50 items default, max 100)
    ↓
Frontend Display
    ↓
On Expand:
    ├→ DexScreener API (market data)
    ├→ Jupiter API (token info)
    ├→ RugCheck API (security)
    ├→ Helius RPC (holders)
    └→ BubbleMaps (distribution)
```

### Monitoring Pipeline
```
Active Monitoring Configs
    ↓
Background Scheduler (every 15-60 min)
    ↓
Fetch Current Pool Data
    ↓
Calculate Opportunities
    ↓
Compare vs Threshold (multiplier)
    ↓
Store Snapshot (database)
    ↓
Send Telegram Notification
    ↓
Track Last Notification (avoid spam)
```

---

## 12. Error Handling & Logging

### Logging Levels
- **INFO**: Normal operation, data processed
- **WARNING**: Optional features unavailable
- **ERROR**: Operation failed, requires attention
- **DEBUG**: Detailed execution flow (APScheduler)

### Error Recovery
- **Graceful Degradation**: App runs without database
- **Fallback APIs**: Use Jupiter when DexScreener unavailable
- **Retry Logic**: Auto-retry failed API calls
- **Error Boundaries**: React error boundary for component crashes

---

## 13. Deployment & Setup

### Frontend
```bash
cd frontend
npm install
npm start              # Development
npm run build         # Production
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py         # Development
gunicorn app:app      # Production
```

### DLMM Service
```bash
cd services/dlmm-service
npm install
npm start             # Development
npm run dev          # Development with nodemon
```

---

## Summary

The Meteora Trending Pairs Application is a full-stack DeFi analytics platform combining:

1. **Real-time pool analytics** via React frontend with Material-UI
2. **Advanced filtering and sorting** with server-side processing
3. **Capital rotation monitoring** with Telegram notifications
4. **Degen mode** for high-frequency fee monitoring
5. **Security analysis** with RugCheck integration
6. **Wallet connectivity** with Solana integration
7. **Scalable architecture** using Flask, PostgreSQL, and APScheduler
8. **Microservice architecture** with Node.js for DLMM calculations

The application serves traders, liquidity providers, and researchers with data-driven insights for identifying trending Meteora DLMM pools and optimizing DeFi investment strategies.
