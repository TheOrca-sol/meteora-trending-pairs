# Meteora Trending Pairs Analytics

A comprehensive real-time analytics dashboard and monitoring platform for tracking trending liquidity pools on Meteora's Dynamic Liquidity Market Maker (DLMM) protocol on Solana.

## 🚀 Overview

This project provides a powerful full-stack analytics platform for monitoring and analyzing Meteora DLMM liquidity pools in real-time. It helps traders, liquidity providers, and DeFi enthusiasts identify trending pairs, track performance metrics, automate capital rotation monitoring, and make informed investment decisions with advanced security analysis.

## ✨ Core Features

### 📊 Real-Time Analytics Dashboard
- **Live Data**: Real-time data from Meteora's DLMM API with configurable auto-refresh (60 seconds default)
- **Auto-refresh**: Configurable automatic data refresh with visual countdown
- **Manual Refresh**: Instant data updates with manual refresh button
- **Server-Side Processing**: Efficient pagination, filtering, and sorting on the backend
- **Smart Caching**: 5-minute pool cache to optimize API calls and reduce latency

### 🔍 Advanced Filtering & Search
- **Pair Search**: Search by pair name or token address
- **Volume Filters**: Filter by minimum 30-minute and 24-hour volume
- **Fee Filters**: Filter by minimum 30-minute and 24-hour fees
- **APR Filters**: Filter by minimum Annual Percentage Rate
- **Liquidity Filters**: Filter by minimum Total Value Locked (TVL)
- **Pool Parameters**: Filter by bin step and base fee percentage
- **Blacklist Toggle**: Option to hide blacklisted pairs
- **Filter Persistence**: Saves filter preferences in localStorage

### 📈 Comprehensive Metrics
- **Price Information**: Current price with precision formatting from multiple sources
- **Fee Analytics**: 30-minute and 24-hour fee generation tracking
- **TVL Tracking**: Total Value Locked in USD with real-time updates
- **APR Calculation**: Annual Percentage Rate based on daily fees
- **Transaction Analysis**: Buy/sell transaction counts with visual percentage bars
- **Volume Tracking**: Trading volume across multiple timeframes (5m, 1h, 6h, 24h)
- **Price Changes**: Percentage changes across different time periods with trend indicators
- **Token Security**: Comprehensive security analysis with RugCheck integration
- **Holder Analysis**: Top token holders and distribution data via Helius RPC
- **Distribution Maps**: Interactive BubbleMaps visualization

### 💰 Capital Rotation Monitoring (Database Feature)
- **Wallet Integration**: Connect Solana wallet for personalized monitoring
- **Automated Monitoring**: Track capital rotation opportunities at configurable intervals (5-60 minutes)
- **Telegram Notifications**: Real-time push alerts for detected opportunities
- **Custom Thresholds**: Configure fee thresholds and monitoring preferences
- **Historical Tracking**: Database storage of opportunity snapshots
- **Multi-Pool Tracking**: Monitor multiple pools simultaneously
- **Whitelist Support**: Create custom pool whitelists for focused monitoring
- **Quote Preferences**: Filter by SOL or USDC quote currencies

### 🔥 Degen Mode (High-Frequency Monitoring)
- **Fee Rate Monitoring**: Monitor high 30-minute fee rate pools across all pairs
- **Configurable Intervals**: Check every 1-60 minutes for maximum responsiveness
- **Telegram Alerts**: Instant notifications for high-fee pools
- **Smart Deduplication**: Avoid duplicate notifications with intelligent tracking
- **Wallet Management**: Import existing wallet or generate new one
- **Encrypted Storage**: Secure private key encryption using Fernet
- **Custom Thresholds**: Set minimum fee rate thresholds (e.g., 5% per 30 minutes)
- **Automation Ready**: Infrastructure for future automated trading (Phase 2)

### 🤖 Telegram Bot Integration
- **Easy Authentication**: Generate auth codes in web app, verify via Telegram
- **Real-Time Alerts**: Instant notifications for opportunities and high-fee pools
- **Interactive Commands**:
  - `/start [AUTH_CODE]` - Link wallet to Telegram
  - `/status` - Show monitoring status
  - `/stop` - Unlink wallet and stop monitoring
  - `/help` - Show available commands
  - `/degen_status` - Show degen mode status
  - `/degen_stop` - Stop degen mode monitoring
  - `/degen_threshold NUMBER` - Set fee rate threshold
- **Multi-User Support**: Handle multiple users with separate configurations
- **Secure Linking**: Time-limited auth codes with database verification

### 📊 DLMM Liquidity Distribution Analysis
- **Bin Visualization**: Interactive charts showing liquidity distribution across price bins
- **Buy/Sell Wall Analysis**: Identify support and resistance levels
- **Aggregated Liquidity**: Combine liquidity from multiple pools for the same token pair
- **Jupiter API Integration**: Accurate USD pricing for all token pairs (SOL, USDC, any token)
- **Market Price Comparison**: Compare pool prices with Jupiter market prices
- **Real-Time Updates**: Live on-chain data from Meteora SDK
- **Smart Price Selection**: Use Jupiter when available, fallback to pool average

### 🎨 User Experience
- **Dark/Light Theme**: Toggle between dark and light themes with persistence
- **Responsive Design**: Optimized for desktop and mobile devices
- **Interactive Tables**: Expandable rows with detailed pair information in 3-column layout
- **Sorting**: Sort by any metric in ascending or descending order
- **Server-Side Pagination**: Efficient navigation through large datasets
- **Loading States**: Visual feedback with skeletons during data fetching
- **Copy to Clipboard**: Easy copying of addresses and contract details
- **External Links**: Quick access to Solscan, Meteora app, DexScreener, and BubbleMaps

### 🔗 External Integrations
- **DexScreener API**: Enhanced market data and transaction analytics
- **Jupiter API**: Token information, metadata, and accurate USD pricing
- **RugCheck API**: Comprehensive token security analysis and risk assessment
- **Helius RPC**: On-chain token holder data and distribution
- **BubbleMaps**: Interactive token distribution visualization
- **Meteora App**: Direct links to trade on Meteora platform
- **Solscan Explorer**: Blockchain transaction and account explorer
- **Telegram Bot API**: Push notifications for monitoring alerts

## 🏗️ Architecture

### Multi-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                      │
│  Material-UI • State Management • Real-time Updates         │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼────────┐ ┌───▼────────┐ ┌───▼──────────────┐
│ Backend (Flask)│ │ DLMM Service│ │ External APIs    │
│ • REST API     │ │ (Node.js)   │ │ • DexScreener   │
│ • Monitoring   │ │ • Liquidity │ │ • Jupiter       │
│ • Telegram Bot │ │ • Meteora SDK│ │ • RugCheck      │
└───────┬────────┘ └─────────────┘ │ • Helius        │
        │                           │ • BubbleMaps    │
┌───────▼────────┐                  └─────────────────┘
│ PostgreSQL DB  │
│ • Supabase     │
│ • User Data    │
│ • Monitoring   │
└────────────────┘
```

### Backend (Flask + Python)
- **API Endpoints**: RESTful API for analytics, monitoring, and configuration
- **Data Processing**: Server-side pagination, filtering, and sorting
- **Background Monitoring**: APScheduler for automated opportunity detection
- **Telegram Bot**: python-telegram-bot for push notifications
- **Wallet Manager**: Encrypted private key storage and management
- **Pool Cache**: Singleton pattern cache for efficient API usage
- **Database ORM**: SQLAlchemy for PostgreSQL/Supabase integration
- **Error Handling**: Comprehensive error handling and logging
- **Memory Management**: Efficient garbage collection for large datasets

### Frontend (React 18)
- **Component Architecture**: Modular, reusable components with hooks
- **State Management**: React hooks for efficient state management
- **Material-UI 6.4**: Professional UI components and theming
- **Wallet Integration**: Solana wallet adapter for Web3 connectivity
- **Analytics Integration**: Google Analytics and Vercel Analytics
- **Real-time Updates**: Automatic data refresh with configurable intervals
- **Multi-Source Data Aggregation**: Combines data from 7+ APIs for comprehensive analytics
- **Code Splitting**: React Router for optimized loading

### Microservice (Node.js + Express)
- **DLMM Service**: Dedicated service for liquidity distribution calculations
- **Meteora SDK**: Official @meteora-ag/dlmm SDK integration
- **Solana Web3.js**: On-chain data fetching from Solana
- **Jupiter API**: Token price fetching for accurate USD valuations
- **REST API**: Express endpoints for liquidity data
- **Error Handling**: Robust error handling for on-chain operations

### Database (PostgreSQL/Supabase)
- **Users Table**: Wallet addresses and Telegram chat IDs
- **Monitoring Configs**: User monitoring preferences and schedules
- **Degen Configs**: Degen mode settings and encrypted wallets
- **Opportunity Snapshots**: Historical records of detected opportunities
- **Auth Codes**: Time-limited Telegram authentication codes
- **Connection Pooling**: Optimized with pool_size=10, max_overflow=20
- **JSONB Support**: Flexible storage for complex objects

## 🛠️ Technology Stack

### Backend Technologies
- **Python 3.x**: Server-side language
- **Flask 2.x**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **SQLAlchemy**: ORM for database operations
- **APScheduler**: Scheduled job execution for monitoring (ThreadPoolExecutor with 10 workers)
- **python-telegram-bot**: Telegram bot integration
- **Requests**: HTTP library for API calls
- **Cryptography (Fernet)**: Private key encryption/decryption
- **Solana-py**: Solana blockchain interaction
- **psycopg2**: PostgreSQL database driver
- **python-dotenv**: Environment variable management

### Frontend Technologies
- **React 18**: UI library with hooks
- **Material-UI (MUI) 6.4**: Component library and theming
- **Axios 1.7.7**: HTTP client for API calls
- **Chart.js & react-chartjs-2**: Data visualization for liquidity charts
- **Solana Web3.js**: Blockchain interaction
- **Wallet Adapter**: Solana wallet integration (@solana/wallet-adapter-react)
- **React Router**: Client-side routing for multi-page navigation
- **Google Analytics (react-ga4)**: Analytics tracking
- **Vercel Analytics**: Performance monitoring
- **React Virtuoso**: Virtual scrolling for large datasets

### Microservice Technologies
- **Node.js**: JavaScript runtime
- **Express**: Web framework for REST API
- **@meteora-ag/dlmm**: Official Meteora SDK for liquidity calculations
- **@solana/web3.js**: Solana blockchain interaction
- **Axios**: HTTP requests to Jupiter API
- **BN.js**: Big number arithmetic for on-chain calculations

### Database
- **PostgreSQL** (via Supabase): Production database
- **SQLAlchemy ORM**: Database abstraction layer
- **JSONB**: Flexible data storage for complex objects
- **Connection Pooling**: Optimized connection management

### External APIs & Services
- **Meteora DLMM API**: Primary pool data source (`https://dlmm-api.meteora.ag/pair/all`)
- **DexScreener API**: Real-time market data and trading activity
- **Jupiter API**: Token metadata, information, and USD pricing
- **RugCheck API**: Token security analysis and risk assessment
- **Helius RPC**: Solana blockchain data (token holders)
- **BubbleMaps**: Token distribution visualization
- **Solscan**: Blockchain explorer integration
- **Telegram Bot API**: Push notifications

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- PostgreSQL or Supabase account (for database features)
- Telegram Bot Token (for notifications)
- Git

### 1. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (see Configuration section)
cp .env.example .env
# Edit .env with your configuration

# Run database migrations (if using database features)
python migrate_db.py

# Start the Flask backend
python app.py
```

Backend will run on http://localhost:5000

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start React development server
npm start
```

Frontend will run on http://localhost:3000

### 3. DLMM Microservice Setup
```bash
cd services/dlmm-service

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env

# Start the microservice
npm start
```

DLMM service will run on http://localhost:3001

### 4. Telegram Bot Setup (Optional)

For Telegram notifications, follow the detailed setup guide in `TELEGRAM_MONITORING_SETUP.md`:

1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Add token to backend `.env` file
4. Start the bot with the backend
5. Link your wallet using auth codes

## 🔧 Configuration

### Backend Environment Variables
Create a `.env` file in the `backend/` directory:

```env
# Database Configuration (Required for monitoring features)
DATABASE_URL=postgresql://user:password@host:5432/database

# Telegram Bot Configuration (Required for notifications)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_BOT_USERNAME=your_bot_username

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=your-secret-key-here

# Encryption (Required for wallet management)
ENCRYPTION_KEY=base64-encoded-32-byte-key

# Cache Configuration
USE_GROUPED_CACHE=false  # false = Use PoolDataCache (recommended)

# Optional: Custom RPC endpoints
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/
```

### DLMM Service Environment Variables
Create a `.env` file in the `services/dlmm-service/` directory:

```env
# Solana RPC Configuration
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/

# Backend API URL
BACKEND_API_URL=http://localhost:5000

# Node Environment
NODE_ENV=production
PORT=3001
```

### Frontend Configuration
Update API endpoints in `frontend/src/utils/constants.js` if needed:
```javascript
export const API_BASE_URL = 'http://localhost:5000';
export const DLMM_SERVICE_URL = 'http://localhost:3001';
```

## 📡 API Endpoints

### Analytics Endpoints

#### GET /api/pairs
Fetch paginated pairs data with filtering and sorting
```
Query Parameters:
  - page (int): Page number for pagination (default: 1)
  - limit (int): Items per page, max 100 (default: 50)
  - search (string): Search by pair name or address
  - min_liquidity (float): Minimum TVL filter
  - min_volume_24h (float): Minimum 24h volume filter
  - min_fees_30min (float): Minimum 30-minute fees filter
  - min_apr (float): Minimum APR percentage
  - sort_by (string): Sort field (fee_rate_30min, fees_24h, liquidity, name)
  - sort_order (string): asc or desc
  - force_refresh (bool): Bypass cache

Response:
  {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 500,
      "total_pages": 10,
      "has_next": true,
      "has_prev": false
    },
    "timestamp": "2025-01-01T00:00:00Z"
  }
```

#### GET /api/health
Health check endpoint
```
Response:
  {
    "status": "healthy",
    "timestamp": "2025-01-01T00:00:00Z"
  }
```

### Capital Rotation Endpoints

#### GET /api/auth/generate-code
Generate authentication code for Telegram linking
```
Response:
  {
    "code": "ABC123",
    "expires_at": "2025-01-01T00:05:00Z"
  }
```

#### POST /api/auth/verify-code
Verify authentication code (called by Telegram bot)
```
Body:
  {
    "code": "ABC123",
    "wallet_address": "..."
  }

Response:
  {
    "success": true,
    "message": "Wallet linked successfully"
  }
```

#### GET /api/monitoring/status
Get monitoring status for authenticated user
```
Headers:
  Authorization: Bearer <wallet_address>

Response:
  {
    "enabled": true,
    "config": {
      "interval_minutes": 15,
      "threshold_multiplier": 1.3,
      "min_fees_30min": 100.0
    },
    "next_check": "2025-01-01T00:15:00Z",
    "last_check": "2025-01-01T00:00:00Z"
  }
```

#### POST /api/monitoring/config
Update monitoring configuration
```
Headers:
  Authorization: Bearer <wallet_address>

Body:
  {
    "enabled": true,
    "interval_minutes": 15,
    "threshold_multiplier": 1.3,
    "min_fees_30min": 100.0
  }

Response:
  {
    "success": true,
    "config": {...}
  }
```

#### GET /api/monitoring/opportunities
Get detected opportunities
```
Headers:
  Authorization: Bearer <wallet_address>

Response:
  {
    "opportunities": [
      {
        "pair_name": "SOL/USDC",
        "address": "...",
        "fee_rate_30min": 2.5,
        "fees_30min": 150.0,
        "liquidity": 50000.0,
        "apr": 730.0
      }
    ],
    "last_check": "2025-01-01T00:00:00Z"
  }
```

### Degen Mode Endpoints

#### POST /api/degen/setup
Setup degen mode with wallet
```
Body:
  {
    "degen_wallet_address": "...",
    "private_key": "...",
    "min_fee_rate_threshold": 5.0
  }

Response:
  {
    "success": true,
    "config": {...}
  }
```

#### GET /api/degen/status
Get degen mode status
```
Headers:
  Authorization: Bearer <wallet_address>

Response:
  {
    "enabled": true,
    "config": {
      "min_fee_rate_threshold": 5.0,
      "check_interval_minutes": 1
    },
    "next_check": "2025-01-01T00:01:00Z"
  }
```

#### POST /api/degen/config
Update degen mode configuration
```
Headers:
  Authorization: Bearer <wallet_address>

Body:
  {
    "enabled": true,
    "check_interval_minutes": 1,
    "min_fee_rate_threshold": 5.0
  }

Response:
  {
    "success": true,
    "config": {...}
  }
```

### DLMM Microservice Endpoints

#### GET /api/liquidity-distribution/:pairAddress
Get liquidity distribution for a specific pair
```
Response:
  {
    "success": true,
    "data": {
      "bins": [
        {
          "binId": 8388608,
          "price": 1.0,
          "liquidityX": 1000.0,
          "liquidityY": 1000.0,
          "liquidityUsd": 2000.0,
          "isActive": false
        }
      ],
      "activeBin": 8388608,
      "currentPrice": 1.0,
      "stats": {
        "totalBins": 200,
        "totalLiquidityUsd": 100000.0,
        "activeBinId": 8388608,
        "currentPrice": 1.0,
        "largestBuyWall": 5000.0,
        "largestSellWall": 4500.0,
        "buyWallsCount": 100,
        "sellWallsCount": 100,
        "totalBuyLiquidity": 50000.0,
        "totalSellLiquidity": 50000.0
      }
    }
  }
```

#### GET /api/aggregated-liquidity
Get aggregated liquidity across multiple pools for a token pair
```
Query Parameters:
  - mint_x (string): Base token mint address
  - mint_y (string): Quote token mint address

Response:
  {
    "success": true,
    "data": {
      "bins": [...],
      "currentPrice": 1.0,
      "stats": {...},
      "pools": [
        {
          "address": "...",
          "pairName": "SOL/USDC",
          "binStep": 25,
          "liquidity": 50000.0
        }
      ]
    }
  }
```

#### GET /health
DLMM service health check
```
Response:
  {
    "status": "healthy",
    "timestamp": "2025-01-01T00:00:00Z"
  }
```

## 📊 Data Sources & Flow

### Primary Data Sources

#### 1. Meteora DLMM API (Backend - Primary Data)
- **Endpoint**: `https://dlmm-api.meteora.ag/pair/all`
- **Update Frequency**: 5-minute cache
- **Data Provided**:
  - Pool addresses and names
  - Current prices
  - 30-minute and 24-hour fees
  - APR calculations
  - Total liquidity (TVL)
  - Bin step and base fee percentage
  - Blacklist status
  - Token mint addresses (mint_x, mint_y)

#### 2. DexScreener API (Frontend - Real-time Market Data)
- **Endpoint**: `https://api.dexscreener.com/latest/dex/pairs/solana/{address}`
- **Update Frequency**: Real-time on row expansion
- **Data Provided**:
  - Real-time price and USD value
  - Price changes (5m, 1h, 6h, 24h)
  - Trading volume across timeframes
  - Buy/sell transaction counts
  - Liquidity in USD
  - Token logos and symbols
  - Pair creation timestamp

#### 3. Jupiter API (Frontend & DLMM Service - Token Information)
- **Endpoint**:
  - `https://lite-api.jup.ag/tokens/v2/search?query={address}`
  - `https://lite-api.jup.ag/price/v3?ids={mints}`
- **Update Frequency**: Real-time
- **Data Provided**:
  - Token metadata (name, symbol, logo)
  - Decimals and creation date
  - Security info (mint/freeze authority)
  - Trading statistics by timeframe
  - USD prices for all tokens
  - Token tags and categories

#### 4. RugCheck API (Frontend - Security Analysis)
- **Endpoint**: `https://api.rugcheck.xyz/v1/tokens/{address}/report/summary`
- **Data Provided**:
  - Comprehensive security risk scores
  - Vulnerability detection
  - Risk severity levels
  - Security recommendations
  - Rug pull indicators

#### 5. Helius RPC (Frontend - Blockchain Data)
- **Endpoint**: `https://mainnet.helius-rpc.com/`
- **Method**: `getTokenLargestAccounts`
- **Data Provided**:
  - Largest token holder addresses
  - Token balance distribution
  - Holder account information
  - On-chain ownership data

#### 6. BubbleMaps (Frontend - Visualization)
- **Endpoint**: `https://app.bubblemaps.io/sol/token/{address}`
- **Data Provided**:
  - Interactive token distribution map
  - Whale and cluster visualization
  - Holder relationship network
  - Concentration analysis

#### 7. Solscan Explorer (Frontend - Integration)
- **Endpoint**: `https://solscan.io/`
- **Usage**: Direct links to blockchain explorer for detailed transaction and account information

### Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ Analytics    │ │ Liquidity   │ │ Monitoring   │
│ Request      │ │ Request     │ │ Background   │
└──────┬───────┘ └──────┬──────┘ └──────┬───────┘
       │                │               │
       ▼                ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ Backend API  │ │ DLMM Service│ │ APScheduler  │
│              │ │             │ │              │
│ PoolCache ◄──┤ │ Meteora SDK │ │ Pool Monitor │
│ (5 min)      │ │ Jupiter API │ │ (1-60 min)   │
└──────┬───────┘ └──────┬──────┘ └──────┬───────┘
       │                │               │
       ▼                ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ PostgreSQL   │ │ Solana RPC  │ │ Telegram Bot │
│ Database     │ │             │ │              │
└──────────────┘ └─────────────┘ └──────────────┘
```

### Monitoring Data Pipeline

```
Active Monitoring Configs (Database)
          ↓
Background Scheduler (APScheduler)
          ↓
┌─────────┴─────────┐
│                   │
▼                   ▼
Capital Rotation    Degen Mode
Monitor             Monitor
(15-60 min)        (1-60 min)
│                   │
├→ Fetch Pool Data  ├→ Fetch All Pools
├→ Compare vs       ├→ Filter by Fee Rate
│  Threshold        ├→ Check Threshold
├→ Detect New Opps  ├→ Avoid Duplicates
├→ Store Snapshot   │
│                   │
└─────────┬─────────┘
          ↓
    Telegram Bot
          ↓
  User Notification
```

## 🎯 Use Cases

### For Active Traders
- Identify trending pairs with high volume and activity
- Track price movements across multiple timeframes (5m, 1h, 6h, 24h)
- Monitor fee generation for arbitrage opportunities
- Analyze buy/sell transaction ratios with visual indicators
- Get instant Telegram alerts for high 30-minute fee rates (Degen Mode)
- Assess token security before trading with RugCheck integration

### For Liquidity Providers
- Find high-APR pools for yield farming
- Monitor TVL changes and liquidity depth in real-time
- Track fee generation relative to liquidity
- Identify pools with optimal bin steps and fee structures
- Analyze holder concentration to assess risk
- Visualize liquidity distribution across price bins
- Set up automated capital rotation monitoring

### For Security-Conscious Investors
- Comprehensive token security analysis with RugCheck
- View mint and freeze authority status
- Check top holder distribution and concentration
- Visualize token distribution with BubbleMaps
- Identify blacklisted or risky pairs
- Analyze wallet holder relationships

### For Researchers & Analysts
- Analyze market trends and trading patterns
- Study liquidity pool performance metrics
- Track cumulative trading volumes across timeframes
- Research token holder behavior and distribution
- Monitor capital rotation patterns
- Export and analyze historical opportunity data

### For DeFi Power Users
- Automate monitoring with custom thresholds
- Receive instant Telegram notifications 24/7
- Manage multiple monitoring strategies simultaneously
- Track high-frequency opportunities (1-minute intervals)
- Use encrypted wallet storage for future automation
- Customize monitoring intervals and preferences

## 🔒 Security Features

### Application Security
- **Blacklist Detection**: Identifies and flags blacklisted pairs from Meteora
- **Token Security Analysis**: Integration with RugCheck for comprehensive risk assessment
- **Authority Checks**: Displays mint and freeze authority status for tokens
- **Holder Transparency**: Shows token holder distribution to identify concentration risks
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Graceful error handling without exposing sensitive data
- **CORS Protection**: Proper CORS configuration for security

### Wallet & Credential Security
- **Encrypted Private Keys**: Fernet symmetric encryption for wallet storage
- **Secure Key Management**: Keys encrypted at rest in PostgreSQL database
- **Time-Limited Auth Codes**: 5-minute expiry for Telegram authentication
- **One-Time Use Codes**: Auth codes invalidated after single use
- **Secure Wallet Generation**: Using official Solana SDK for wallet creation
- **No Frontend Key Exposure**: Private keys never sent to browser

### Monitoring Security
- **User Isolation**: Each user's monitoring data isolated with wallet address
- **Token-Based Auth**: Bearer token authentication for API endpoints
- **Rate Limiting**: Configurable intervals prevent API abuse
- **Database Connection Pooling**: Prevents connection exhaustion
- **Input Sanitization**: All user inputs validated before database operations

## 📈 Performance Optimizations

### Backend Optimizations
- **Server-Side Processing**: Backend handles pagination, filtering, and sorting
- **Singleton Pool Cache**: 5-minute cache reduces API calls by ~90%
- **Thread-Safe Caching**: Lock mechanism prevents race conditions
- **Memory Management**: Explicit garbage collection for large datasets
- **Connection Pooling**: Database pool (size=10, max_overflow=20)
- **APScheduler Threading**: ThreadPoolExecutor with 10 workers
- **Efficient Queries**: Indexed database queries for monitoring
- **Batch Processing**: Parallel monitoring job execution

### Frontend Optimizations
- **Lazy Data Loading**: Fetch expanded row details on-demand
- **Client-Side Caching**: localStorage for filters and preferences
- **Parallel API Calls**: Promise.all() for concurrent requests
- **Smart Fallbacks**: Use Jupiter data when DexScreener unavailable
- **Optimized Rendering**: Only display current page data
- **Code Splitting**: React Router lazy loading
- **Virtual Scrolling**: React Virtuoso for large tables
- **Memoization**: React.memo for expensive components

### Microservice Optimizations
- **On-Chain Data Caching**: Reduce redundant Solana RPC calls
- **Efficient Bin Fetching**: Fetch only necessary bins around active price
- **Parallel Pool Queries**: Fetch multiple pool data concurrently
- **Price Aggregation**: Smart averaging of multiple pool prices
- **Error Recovery**: Graceful handling of failed on-chain calls

## 🗄️ Database Schema

### Users Table
Stores user wallet addresses and Telegram information
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
Stores capital rotation monitoring configurations
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
Stores degen mode configurations with encrypted wallets
```sql
CREATE TABLE degen_configs (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(44) REFERENCES users(wallet_address),
  wallet_type VARCHAR(20) NOT NULL,
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
Stores historical opportunity detection records
```sql
CREATE TABLE opportunity_snapshots (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(44) REFERENCES users(wallet_address),
  opportunities JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### TelegramAuthCode Table
Stores temporary authentication codes for Telegram linking
```sql
CREATE TABLE telegram_auth_codes (
  code VARCHAR(6) PRIMARY KEY,
  wallet_address VARCHAR(44) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🤝 Contributing

We welcome contributions to improve the Meteora Trending Pairs Analytics platform!

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with clear commit messages
4. Add tests if applicable
5. Ensure all tests pass and code follows style guidelines
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request with a clear description

### Development Guidelines
- Follow PEP 8 style guide for Python code
- Use ESLint and Prettier for JavaScript/React code
- Write clear commit messages following conventional commits
- Add comments for complex logic
- Update documentation for new features
- Test thoroughly before submitting PR

### Areas for Contribution
- New data sources and API integrations
- Performance optimizations
- UI/UX improvements
- Additional monitoring strategies
- Documentation improvements
- Bug fixes and error handling
- Test coverage improvements

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

### Data Providers & APIs
- **Meteora Team**: For providing the DLMM API and protocol
- **DexScreener**: For comprehensive real-time market data
- **Jupiter Aggregator**: For token information, metadata, and accurate USD pricing
- **RugCheck**: For token security analysis and risk assessment
- **Helius**: For Solana RPC infrastructure and on-chain data
- **BubbleMaps**: For token distribution visualization
- **Solscan**: For blockchain explorer integration

### Technologies & Frameworks
- **Material-UI Team**: For the excellent component library
- **Solana Foundation**: For the blockchain infrastructure
- **Flask & SQLAlchemy**: For robust backend framework
- **React Team**: For the amazing UI library
- **Telegram**: For the Bot API platform

### Community
- **Solana DeFi Community**: For feedback and support
- **Open Source Contributors**: For improvements and bug fixes

## 📞 Support & Contact

### Getting Help
- **Documentation**: Read this README and `TELEGRAM_MONITORING_SETUP.md`
- **Issues**: Open an issue on GitHub for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

### Useful Links
- **GitHub Repository**: [meteora-trending-pairs](https://github.com/yourusername/meteora-trending-pairs)
- **Meteora Protocol**: [Meteora Website](https://app.meteora.ag/)
- **Solana Documentation**: [Solana Docs](https://docs.solana.com/)

### Reporting Issues
When reporting issues, please include:
- Operating system and versions
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots if applicable
- Error messages or logs

## 🚀 Roadmap

### Phase 1: Core Analytics (✅ Complete)
- Real-time pool analytics dashboard
- Advanced filtering and sorting
- Multi-source data aggregation
- Security analysis integration

### Phase 2: Monitoring & Automation (✅ Complete)
- Capital rotation monitoring
- Telegram bot integration
- Degen mode high-frequency monitoring
- Database-backed user configurations
- Encrypted wallet management

### Phase 3: DLMM Enhancements (✅ Complete)
- Liquidity distribution visualization
- Aggregated multi-pool liquidity
- Jupiter API integration for accurate pricing
- Buy/sell wall analysis

### Phase 4: Advanced Features (🚧 In Progress)
- Automated trading execution (Phase 2 of Degen Mode)
- Portfolio tracking and management
- Advanced alerting with customizable conditions
- Historical data analysis and charting
- Mobile app (React Native)

### Phase 5: Future Enhancements (📋 Planned)
- Machine learning for opportunity prediction
- Social features and community pools
- Advanced risk management tools
- Cross-DEX arbitrage detection
- API access for developers

---

**Built with ❤️ for the Solana DeFi community**

**Star ⭐ this repo if you find it useful!**
