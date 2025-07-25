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
- **Price Information**: Current price with precision formatting
- **Fee Analytics**: 30-minute and 24-hour fee generation
- **TVL Tracking**: Total Value Locked in USD
- **APR Calculation**: Annual Percentage Rate based on daily fees
- **Transaction Analysis**: Buy/sell transaction counts with visual indicators
- **Volume Tracking**: Trading volume across multiple timeframes (5m, 1h, 6h, 24h)
- **Price Changes**: Percentage changes across different time periods

### 🎨 User Experience
- **Dark/Light Theme**: Toggle between dark and light themes
- **Responsive Design**: Optimized for desktop and mobile devices
- **Interactive Tables**: Expandable rows with detailed pair information
- **Sorting**: Sort by any metric in ascending or descending order
- **Pagination**: Navigate through large datasets efficiently

### 🔗 External Integrations
- **DexScreener API**: Enhanced market data and transaction analytics
- **Jupiter API**: Token information and metadata
- **Meteora App**: Direct links to trade on Meteora platform

## 🏗️ Architecture

### Backend (Flask)
- **API Endpoints**: RESTful API for fetching and filtering pair data
- **Data Processing**: Pandas-based data transformation and aggregation
- **CORS Support**: Cross-origin resource sharing for frontend integration
- **Error Handling**: Comprehensive error handling and logging

### Frontend (React)
- **Component Architecture**: Modular, reusable components
- **State Management**: React hooks for efficient state management
- **Material-UI**: Professional UI components and theming
- **Analytics Integration**: Google Analytics and Vercel Analytics
- **Real-time Updates**: WebSocket-like experience with polling

## 🛠️ Technology Stack

### Backend
- **Python 3.x**
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **Pandas**: Data manipulation and analysis
- **Requests**: HTTP library for API calls

### Frontend
- **React 18**: UI library
- **Material-UI (MUI)**: Component library
- **Axios**: HTTP client
- **React Virtuoso**: Virtual scrolling for large datasets
- **Vercel Analytics**: Performance monitoring

### APIs
- **Meteora DLMM API**: Primary data source
- **DexScreener API**: Market data enrichment
- **Jupiter API**: Token information

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
- `GET /api/pairs`: Fetch all pairs data
- `GET /api/pairs/search`: Search and filter pairs
- `GET /api/health`: Health check endpoint

## 📊 Data Sources

### Meteora DLMM API
- **Endpoint**: `https://dlmm-api.meteora.ag/pair/all`
- **Data**: Pair addresses, names, prices, volumes, fees, APR, liquidity

### DexScreener API
- **Endpoint**: `https://api.dexscreener.com/latest/dex/pairs/solana/{address}`
- **Data**: Transaction counts, price changes, volume breakdowns

### Jupiter API
- **Endpoint**: `https://api.jup.ag/tokens/v1/token/{address}`
- **Data**: Token metadata, logos, symbols

## 🎯 Use Cases

### For Traders
- Identify trending pairs with high volume
- Track price movements across timeframes
- Monitor fee generation for arbitrage opportunities
- Analyze buy/sell transaction ratios

### For Liquidity Providers
- Find high-APR pools for yield farming
- Monitor TVL changes and liquidity depth
- Track fee generation relative to liquidity
- Identify pools with optimal bin steps

### For Researchers
- Analyze market trends and patterns
- Study liquidity pool performance metrics
- Monitor blacklisted pairs and security concerns
- Track cumulative trading volumes

## 🔒 Security Features

- **Blacklist Detection**: Identifies and flags blacklisted pairs
- **Data Validation**: Comprehensive input validation and sanitization
- **Error Handling**: Graceful error handling without exposing sensitive data
- **CORS Protection**: Proper CORS configuration for security

## 📈 Performance Optimizations

- **Data Caching**: Efficient data processing and caching strategies
- **Virtual Scrolling**: Handles large datasets without performance degradation
- **Lazy Loading**: Components load data on-demand
- **Debounced Search**: Optimized search with debouncing

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
- **DexScreener**: For comprehensive market data
- **Jupiter**: For token information and metadata
- **Material-UI**: For the excellent component library

## 📞 Support

For support, questions, or feature requests, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for the Solana DeFi community**
