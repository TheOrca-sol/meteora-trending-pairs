import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class SolanaService {
  constructor() {
    this.connection = null;
    this.wallet = null;
  }

  /**
   * Initialize Solana connection and wallet
   */
  async initialize() {
    try {
      // Create connection
      this.connection = new Connection(
        config.solana.rpcUrl,
        {
          commitment: config.solana.commitment,
          confirmTransactionInitialTimeout: 60000,
        }
      );

      // Initialize wallet from private key
      if (config.wallet.privateKey) {
        const privateKeyBytes = bs58.decode(config.wallet.privateKey);
        this.wallet = Keypair.fromSecretKey(privateKeyBytes);
        logger.info(`Wallet initialized: ${this.wallet.publicKey.toBase58()}`);
      } else {
        throw new Error('Private key not configured');
      }

      // Verify connection
      const version = await this.connection.getVersion();
      logger.info(`Connected to Solana RPC: ${config.solana.rpcUrl}`);
      logger.info(`Solana version: ${version['solana-core']}`);

      // Check wallet balance
      const balance = await this.getBalance();
      logger.info(`Wallet balance: ${balance} SOL`);

      if (balance < 0.1) {
        logger.warn('Wallet balance is low! Consider adding more SOL for transactions.');
      }

      return true;
    } catch (error) {
      logger.error('Failed to initialize Solana service:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance in SOL
   */
  async getBalance() {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
      logger.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * Get token account balance
   */
  async getTokenBalance(tokenMint) {
    try {
      const mintPubkey = new PublicKey(tokenMint);
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        this.wallet.publicKey,
        { mint: mintPubkey }
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance;
    } catch (error) {
      logger.error(`Failed to get token balance for ${tokenMint}:`, error);
      return 0;
    }
  }

  /**
   * Get connection instance
   */
  getConnection() {
    if (!this.connection) {
      throw new Error('Solana connection not initialized');
    }
    return this.connection;
  }

  /**
   * Get wallet keypair
   */
  getWallet() {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet;
  }

  /**
   * Get wallet public key
   */
  getPublicKey() {
    return this.wallet.publicKey;
  }

  /**
   * Check if transaction is confirmed
   */
  async confirmTransaction(signature, commitment = 'confirmed') {
    try {
      const confirmation = await this.connection.confirmTransaction(signature, commitment);
      return !confirmation.value.err;
    } catch (error) {
      logger.error('Failed to confirm transaction:', error);
      return false;
    }
  }

  /**
   * Get recent blockhash
   */
  async getRecentBlockhash() {
    try {
      const { blockhash } = await this.connection.getLatestBlockhash();
      return blockhash;
    } catch (error) {
      logger.error('Failed to get recent blockhash:', error);
      throw error;
    }
  }

  /**
   * Simulate transaction
   */
  async simulateTransaction(transaction) {
    try {
      const simulation = await this.connection.simulateTransaction(transaction);
      return simulation;
    } catch (error) {
      logger.error('Failed to simulate transaction:', error);
      throw error;
    }
  }

  /**
   * Close connection
   */
  async close() {
    // Connection doesn't need explicit closing
    logger.info('Solana service closed');
  }
}

export default new SolanaService();
