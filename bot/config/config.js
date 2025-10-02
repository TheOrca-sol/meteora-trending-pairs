import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';

dotenv.config();

export const config = {
  // Solana Configuration
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    cluster: process.env.SOLANA_CLUSTER || 'mainnet-beta',
    commitment: 'confirmed',
  },

  // Wallet Configuration
  wallet: {
    privateKey: process.env.PRIVATE_KEY,
    publicKey: process.env.WALLET_PUBLIC_KEY,
  },

  // API Endpoints
  apis: {
    backend: process.env.BACKEND_API_URL || 'http://localhost:5000',
    dexscreener: process.env.DEXSCREENER_API_URL || 'https://api.dexscreener.com/latest/dex',
    jupiter: process.env.JUPITER_API_URL || 'https://lite-api.jup.ag',
    rugcheck: process.env.RUGCHECK_API_URL || 'https://api.rugcheck.xyz/v1',
    helius: process.env.HELIUS_RPC_URL,
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'meteora_bot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },

  // Bot Configuration
  bot: {
    minTvl: parseFloat(process.env.MIN_TVL || '100000'),
    minApr: parseFloat(process.env.MIN_APR || '50'),
    maxPositionPercent: parseFloat(process.env.MAX_POSITION_PERCENT || '20'),
    maxPositions: parseInt(process.env.MAX_POSITIONS || '10'),
    minReservePercent: parseFloat(process.env.MIN_RESERVE_PERCENT || '10'),
    rebalanceIntervalMinutes: parseInt(process.env.REBALANCE_INTERVAL_MINUTES || '5'),
    claimThresholdUsd: parseFloat(process.env.CLAIM_THRESHOLD_USD || '10'),
  },

  // Risk Management
  risk: {
    maxImpermanentLossPercent: parseFloat(process.env.MAX_IMPERMANENT_LOSS_PERCENT || '10'),
    maxAprDeclinePercent: parseFloat(process.env.MAX_APR_DECLINE_PERCENT || '50'),
    maxPriceDropPercent: parseFloat(process.env.MAX_PRICE_DROP_PERCENT || '30'),
    maxTvlDropPercent: parseFloat(process.env.MAX_TVL_DROP_PERCENT || '30'),
  },

  // Scoring Weights
  scoring: {
    profitabilityWeight: 0.4,
    riskWeight: 0.3,
    liquidityHealthWeight: 0.2,
    marketConditionsWeight: 0.1,
  },

  // Strategy Thresholds
  strategy: {
    // Curve strategy: low volatility
    curveMaxPriceChange24h: 5,
    curveBuyRatioMin: 40,
    curveBuyRatioMax: 60,

    // Spot strategy: moderate volatility
    spotMinPriceChange24h: 5,
    spotMaxPriceChange24h: 20,

    // Bid-Ask strategy: high volatility
    bidAskMinPriceChange24h: 20,
  },

  // Notifications
  notifications: {
    telegram: {
      enabled: process.env.ENABLE_NOTIFICATIONS === 'true',
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Validate required configuration
export function validateConfig() {
  const errors = [];

  if (!config.wallet.privateKey) {
    errors.push('PRIVATE_KEY is required');
  }

  if (!config.wallet.publicKey) {
    errors.push('WALLET_PUBLIC_KEY is required');
  }

  if (!config.database.password) {
    errors.push('DB_PASSWORD is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}

export default config;
