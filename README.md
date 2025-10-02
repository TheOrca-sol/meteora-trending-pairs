# Meteora Trending Pairs Analytics

A comprehensive real-time analytics dashboard for tracking trending liquidity pools on Meteora's Dynamic Liquidity Market Maker (DLMM) protocol on Solana.

## 🚀 Overview

This project provides a powerful analytics platform for monitoring and analyzing Meteora DLMM liquidity pools in real-time. It helps traders, liquidity providers, and DeFi enthusiasts identify trending pairs, track performance metrics, and make informed investment decisions.

## ✨ Features

### 📊 Real-Time Analytics
- **Live Data**: Fetches real-time data from Meteora's DLMM API
- **Auto-refresh**: Configurable automatic data refresh (every 60 seconds)
- **Manual Refresh**: Instant data updates with manual refresh button

### 🔍 Advanced Filtering & Search
- **Pair Search**: Search by pair name or token address
- **Volume Filters**: Filter by minimum 30-minute and 24-hour volume
- **Fee Filters**: Filter by minimum 30-minute and 24-hour fees
- **APR Filters**: Filter by minimum Annual Percentage Rate
- **Liquidity Filters**: Filter by minimum Total Value Locked (TVL)
- **Pool Parameters**: Filter by bin step and base fee percentage
- **Blacklist Toggle**: Option to hide blacklisted pairs

### 📈 Comprehensive Metrics
- **Price Information**: Current price with precision formatting from multiple sources
- **Fee Analytics**: 30-minute and 24-hour fee generation
- **TVL Tracking**: Total Value Locked in USD
- **APR Calculation**: Annual Percentage Rate based on daily fees
- **Transaction Analysis**: Buy/sell transaction counts with visual percentage bars
- **Volume Tracking**: Trading volume across multiple timeframes (5m, 1h, 6h, 24h)
- **Price Changes**: Percentage changes across different time periods with trend indicators
- **Token Security**: Comprehensive security analysis with RugCheck integration
- **Holder Analysis**: Top token holders and distribution data
- **Distribution Maps**: Interactive BubbleMaps visualization

### 🎨 User Experience
- **Dark/Light Theme**: Toggle between dark and light themes
- **Responsive Design**: Optimized for desktop and mobile devices
- **Interactive Tables**: Expandable rows with detailed pair information
- **Sorting**: Sort by any metric in ascending or descending order
- **Server-Side Pagination**: Efficient navigation through large datasets
- **Loading States**: Visual feedback during data fetching and pagination
- **Copy to Clipboard**: Easy copying of addresses and contract details
- **External Links**: Quick access to Solscan, Meteora app, and social media

### 🔗 External Integrations
- **DexScreener API**: Enhanced market data and transaction analytics
- **Jupiter API**: Token information and metadata
- **RugCheck API**: Comprehensive token security analysis
- **Helius RPC**: On-chain token holder data
- **BubbleMaps**: Interactive token distribution visualization
- **Meteora App**: Direct links to trade on Meteora platform
- **Solscan Explorer**: Blockchain transaction and account explorer

## 🏗️ Architecture

### Backend (Flask)
- **API Endpoints**: RESTful API for fetching and filtering pair data
- **Data Processing**: Server-side pagination, filtering, and sorting
- **CORS Support**: Cross-origin resource sharing for frontend integration
- **Error Handling**: Comprehensive error handling and logging
- **Memory Management**: Efficient garbage collection for large datasets

### Frontend (React)
- **Component Architecture**: Modular, reusable components
- **State Management**: React hooks for efficient state management
- **Material-UI**: Professional UI components and theming
- **Analytics Integration**: Google Analytics and Vercel Analytics
- **Real-time Updates**: Automatic data refresh with configurable intervals
- **Multi-Source Data Aggregation**: Combines data from 6+ APIs for comprehensive analytics

## 🛠️ Technology Stack

### Backend
- **Python 3.x**
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **Requests**: HTTP library for API calls

### Frontend
- **React 18**: UI library
- **Material-UI (MUI)**: Component library
- **Axios**: HTTP client
- **Vercel Analytics**: Performance monitoring

### Data Sources & APIs
- **Meteora DLMM API**: Primary liquidity pool data
- **DexScreener API**: Real-time market data and trading activity
- **Jupiter API**: Token metadata and information
- **RugCheck API**: Token security analysis and risk assessment
- **Helius RPC**: Solana blockchain data and token holders
- **BubbleMaps**: Token distribution visualization
- **Solscan**: Blockchain explorer integration

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+
- Git

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the backend directory:
```env
FLASK_ENV=development
FLASK_DEBUG=True
```

### API Endpoints
- `GET /api/pairs`: Fetch paginated pairs data with filtering and sorting
  - Query params: `page`, `limit`, `search`, `min_liquidity`, `sort_by`
- `GET /api/health`: Health check endpoint

## 📊 Data Sources

### 1. Meteora DLMM API (Backend - Primary Data)
- **Endpoint**: `https://dlmm-api.meteora.ag/pair/all`
- **Data Provided**:
  - Pool addresses and names
  - Current prices
  - 24h fees and APR
  - Total liquidity (TVL)
  - Bin step and base fee percentage
  - Blacklist status
  - Token mint addresses (mint_x, mint_y)

### 2. DexScreener API (Frontend - Real-time Market Data)
- **Endpoint**: `https://api.dexscreener.com/latest/dex/pairs/solana/{address}`
- **Data Provided**:
  - Real-time price and USD value
  - Price changes (5m, 1h, 6h, 24h)
  - Trading volume across timeframes
  - Buy/sell transaction counts
  - Liquidity in USD
  - Token logos and symbols
  - Pair creation timestamp

### 3. Jupiter API (Frontend - Token Information)
- **Endpoint**: `https://lite-api.jup.ag/tokens/v2/search?query={address}`
- **Data Provided**:
  - Token metadata (name, symbol, logo)
  - Decimals and creation date
  - Security info (mint/freeze authority)
  - Trading statistics by timeframe
  - Token tags and categories
  - USD price (fallback)

### 4. RugCheck API (Security Analysis)
- **Endpoint**: `https://api.rugcheck.xyz/v1/tokens/{address}/report/summary`
- **Data Provided**:
  - Comprehensive security risk scores
  - Vulnerability detection
  - Risk severity levels
  - Security recommendations
  - Rug pull indicators

### 5. Helius RPC (Blockchain Data)
- **Endpoint**: `https://mainnet.helius-rpc.com/`
- **Method**: `getTokenLargestAccounts`
- **Data Provided**:
  - Largest token holder addresses
  - Token balance distribution
  - Holder account information
  - On-chain ownership data

### 6. BubbleMaps (Visualization)
- **Endpoint**: `https://app.bubblemaps.io/sol/token/{address}`
- **Data Provided**:
  - Interactive token distribution map
  - Whale and cluster visualization
  - Holder relationship network
  - Concentration analysis

### 7. Solscan Explorer (Integration)
- **Endpoint**: `https://solscan.io/`
- **Usage**: Direct links to blockchain explorer for detailed transaction and account information

## 🎯 Use Cases

### For Traders
- Identify trending pairs with high volume and activity
- Track price movements across multiple timeframes (5m, 1h, 6h, 24h)
- Monitor fee generation for arbitrage opportunities
- Analyze buy/sell transaction ratios with visual indicators
- Assess token security before trading with RugCheck integration

### For Liquidity Providers
- Find high-APR pools for yield farming
- Monitor TVL changes and liquidity depth in real-time
- Track fee generation relative to liquidity
- Identify pools with optimal bin steps and fee structures
- Analyze holder concentration to assess risk

### For Security-Conscious Investors
- Comprehensive token security analysis with RugCheck
- View mint and freeze authority status
- Check top holder distribution and concentration
- Visualize token distribution with BubbleMaps
- Identify blacklisted or risky pairs

### For Researchers & Analysts
- Analyze market trends and trading patterns
- Study liquidity pool performance metrics
- Track cumulative trading volumes across timeframes
- Research token holder behavior and distribution
- Export data for further analysis

## 🔒 Security Features

- **Blacklist Detection**: Identifies and flags blacklisted pairs from Meteora
- **Token Security Analysis**: Integration with RugCheck for comprehensive risk assessment
- **Authority Checks**: Displays mint and freeze authority status for tokens
- **Holder Transparency**: Shows token holder distribution to identify concentration risks
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Graceful error handling without exposing sensitive data
- **CORS Protection**: Proper CORS configuration for security

## 📈 Performance Optimizations

- **Server-Side Processing**: Backend handles pagination, filtering, and sorting
- **Memory Management**: Garbage collection strategies for handling large datasets
- **Lazy Data Loading**: Frontend components fetch additional data on-demand (DexScreener, Jupiter, etc.)
- **Parallel API Calls**: Multiple data sources fetched concurrently using Promise.all
- **Optimized Rendering**: Only displays current page data to minimize DOM operations
- **Smart Fallbacks**: Uses Jupiter data when DexScreener is unavailable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Meteora Team**: For providing the DLMM API and protocol
- **DexScreener**: For comprehensive real-time market data
- **Jupiter Aggregator**: For token information and metadata
- **RugCheck**: For token security analysis
- **Helius**: For Solana RPC infrastructure
- **BubbleMaps**: For token distribution visualization
- **Solscan**: For blockchain explorer integration
- **Material-UI**: For the excellent component library
- **Solana Foundation**: For the blockchain infrastructure

## 📞 Support

For support, questions, or feature requests, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for the Solana DeFi community**
