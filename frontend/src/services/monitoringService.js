import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const monitoringService = {
  /**
   * Generate Telegram auth code
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise}
   */
  async generateTelegramCode(walletAddress) {
    try {
      const response = await axios.post(`${API_BASE_URL}/telegram/generate-code`, {
        walletAddress
      });

      return {
        success: true,
        code: response.data.code,
        botLink: response.data.botLink,
        expiresIn: response.data.expiresIn
      };
    } catch (error) {
      console.error('Error generating Telegram code:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Check Telegram connection status
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise}
   */
  async checkTelegramConnection(walletAddress) {
    try {
      const response = await axios.post(`${API_BASE_URL}/telegram/connection-status`, {
        walletAddress
      });

      return {
        success: true,
        connected: response.data.connected,
        telegram_username: response.data.telegram_username,
        connected_at: response.data.connected_at
      };
    } catch (error) {
      console.error('Error checking Telegram connection:', error);
      return {
        success: false,
        connected: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Disconnect Telegram
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise}
   */
  async disconnectTelegram(walletAddress) {
    try {
      const response = await axios.post(`${API_BASE_URL}/telegram/disconnect`, {
        walletAddress
      });

      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error disconnecting Telegram:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Start monitoring for opportunities
   * @param {string} walletAddress - Solana wallet address
   * @param {object} config - Monitoring configuration
   * @returns {Promise}
   */
  async startMonitoring(walletAddress, config) {
    try {
      const response = await axios.post(`${API_BASE_URL}/monitoring/start`, {
        walletAddress,
        intervalMinutes: config.intervalMinutes,
        thresholdMultiplier: config.thresholdMultiplier,
        whitelist: config.whitelist,
        quotePreferences: config.quotePreferences,
        minFees30min: config.minFees30min
      });

      return {
        success: true,
        message: response.data.message,
        config: response.data.config
      };
    } catch (error) {
      console.error('Error starting monitoring:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Stop monitoring
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise}
   */
  async stopMonitoring(walletAddress) {
    try {
      const response = await axios.post(`${API_BASE_URL}/monitoring/stop`, {
        walletAddress
      });

      return {
        success: true,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Get monitoring status
   * @param {string} walletAddress - Solana wallet address
   * @returns {Promise}
   */
  async getStatus(walletAddress) {
    try {
      const response = await axios.post(`${API_BASE_URL}/monitoring/status`, {
        walletAddress
      });

      return {
        success: true,
        monitoring: response.data.monitoring
      };
    } catch (error) {
      console.error('Error getting monitoring status:', error);
      return {
        success: false,
        monitoring: {
          active: false,
          next_run: null,
          interval_minutes: null,
          last_check: null
        },
        error: error.response?.data?.message || error.message
      };
    }
  }
};

export default monitoringService;
