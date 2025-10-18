import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const capitalRotationService = {
  /**
   * Fetch wallet positions from backend
   * @param {string} walletAddress - Solana wallet address
   * @param {Array} whitelist - Array of token mint addresses
   * @param {Object} quotePreferences - Quote token preferences {sol: boolean, usdc: boolean}
   * @returns {Promise} - Array of positions
   */
  async fetchPositions(walletAddress, whitelist = [], quotePreferences = { sol: true, usdc: true }) {
    try {
      const response = await axios.post(`${API_BASE_URL}/wallet/positions`, {
        walletAddress,
        whitelist,
        quotePreferences
      });

      return {
        success: true,
        positions: response.data.positions || [],
        message: response.data.message
      };
    } catch (error) {
      console.error('Error fetching positions:', error);
      return {
        success: false,
        positions: [],
        error: error.response?.data?.message || error.message
      };
    }
  },

  /**
   * Analyze and find better pool opportunities
   * @param {string} walletAddress - Solana wallet address
   * @param {Array} whitelist - Array of token mint addresses
   * @param {Object} quotePreferences - Quote token preferences {sol: boolean, usdc: boolean}
   * @param {Array} currentPositions - Current user positions
   * @returns {Promise} - Array of opportunities
   */
  async analyzeOpportunities(walletAddress, whitelist, quotePreferences, currentPositions = []) {
    try {
      const response = await axios.post(`${API_BASE_URL}/opportunities/analyze`, {
        walletAddress,
        whitelist,
        quotePreferences,
        currentPositions
      });

      return {
        success: true,
        opportunities: response.data.opportunities || [],
        totalFound: response.data.total_found || 0,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error analyzing opportunities:', error);
      return {
        success: false,
        opportunities: [],
        totalFound: 0,
        error: error.response?.data?.message || error.message
      };
    }
  }
};

export default capitalRotationService;
