import logger from '../utils/logger.js';
import database from '../models/database.js';

/**
 * Health Check Service
 * Monitors bot health and detects failures
 */
class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.lastCheckTime = null;
    this.healthHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Register a health check
   */
  registerCheck(name, checkFunction, config = {}) {
    this.checks.set(name, {
      name,
      checkFunction,
      interval: config.interval || 60000, // Default: 1 minute
      timeout: config.timeout || 5000, // Default: 5 seconds
      critical: config.critical || false, // If true, failure triggers alerts
      lastCheck: null,
      lastResult: null,
      failureCount: 0,
    });

    logger.info(`Registered health check: ${name}`);
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {
      timestamp: new Date().toISOString(),
      overall: 'HEALTHY',
      checks: {},
      summary: {
        total: this.checks.size,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
      },
    };

    for (const [name, check] of this.checks.entries()) {
      try {
        const result = await this.runCheck(name);
        results.checks[name] = result;

        // Update summary
        if (result.status === 'HEALTHY') results.summary.healthy++;
        else if (result.status === 'DEGRADED') results.summary.degraded++;
        else results.summary.unhealthy++;

        // Update overall status
        if (result.status === 'UNHEALTHY' && check.critical) {
          results.overall = 'CRITICAL';
        } else if (result.status === 'UNHEALTHY' && results.overall !== 'CRITICAL') {
          results.overall = 'UNHEALTHY';
        } else if (result.status === 'DEGRADED' && results.overall === 'HEALTHY') {
          results.overall = 'DEGRADED';
        }
      } catch (error) {
        logger.error(`Error running health check ${name}:`, error);
        results.checks[name] = {
          status: 'UNHEALTHY',
          error: error.message,
        };
        results.summary.unhealthy++;
        results.overall = 'UNHEALTHY';
      }
    }

    this.lastCheckTime = Date.now();

    // Save to history
    this.healthHistory.push(results);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }

    return results;
  }

  /**
   * Run a single health check
   */
  async runCheck(name) {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check not found: ${name}`);
    }

    const startTime = Date.now();

    try {
      // Run check with timeout
      const result = await Promise.race([
        check.checkFunction(),
        this.timeout(check.timeout),
      ]);

      const duration = Date.now() - startTime;

      check.lastCheck = Date.now();
      check.lastResult = {
        status: result.status || 'HEALTHY',
        duration,
        ...result,
      };
      check.failureCount = result.status === 'HEALTHY' ? 0 : check.failureCount + 1;

      return check.lastResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      check.lastCheck = Date.now();
      check.lastResult = {
        status: 'UNHEALTHY',
        error: error.message,
        duration,
      };
      check.failureCount++;

      return check.lastResult;
    }
  }

  /**
   * Timeout helper
   */
  timeout(ms) {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Health check timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const checks = {};
    for (const [name, check] of this.checks.entries()) {
      checks[name] = {
        status: check.lastResult?.status || 'UNKNOWN',
        lastCheck: check.lastCheck ? new Date(check.lastCheck).toISOString() : null,
        failureCount: check.failureCount,
        critical: check.critical,
      };
    }

    return {
      lastCheckTime: this.lastCheckTime ? new Date(this.lastCheckTime).toISOString() : null,
      checks,
    };
  }

  /**
   * Get health history
   */
  getHealthHistory(limit = 10) {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Check if system is healthy
   */
  isHealthy() {
    for (const check of this.checks.values()) {
      if (check.critical && check.lastResult?.status !== 'HEALTHY') {
        return false;
      }
    }
    return true;
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

/**
 * Register default health checks
 */

// Database connectivity
healthCheckService.registerCheck('database', async () => {
  try {
    const result = await database.query('SELECT 1');
    return {
      status: 'HEALTHY',
      message: 'Database connected',
    };
  } catch (error) {
    return {
      status: 'UNHEALTHY',
      message: 'Database connection failed',
      error: error.message,
    };
  }
}, { critical: true });

// Solana RPC connectivity
healthCheckService.registerCheck('solana-rpc', async () => {
  try {
    const solanaService = (await import('./solana.service.js')).default;
    const slot = await solanaService.connection.getSlot();

    return {
      status: 'HEALTHY',
      message: 'Solana RPC connected',
      currentSlot: slot,
    };
  } catch (error) {
    return {
      status: 'UNHEALTHY',
      message: 'Solana RPC connection failed',
      error: error.message,
    };
  }
}, { critical: true });

// Price feed freshness
healthCheckService.registerCheck('price-feed', async () => {
  try {
    const priceFeed = (await import('./price-feed.service.js')).default;
    const health = priceFeed.getHealthStatus();

    if (health.status === 'HEALTHY') {
      return {
        status: 'HEALTHY',
        message: `SOL price: $${health.price?.toFixed(2)}`,
        price: health.price,
        ageSeconds: health.ageSeconds,
      };
    } else if (health.status === 'AGING') {
      return {
        status: 'DEGRADED',
        message: 'Price feed aging',
        price: health.price,
        ageSeconds: health.ageSeconds,
      };
    } else {
      return {
        status: 'UNHEALTHY',
        message: 'Price feed stale or unavailable',
        ageSeconds: health.ageSeconds,
      };
    }
  } catch (error) {
    return {
      status: 'UNHEALTHY',
      message: 'Price feed check failed',
      error: error.message,
    };
  }
}, { critical: false });

// Data aggregator freshness
healthCheckService.registerCheck('data-aggregator', async () => {
  try {
    const dataAggregator = (await import('./data-aggregator.service.js')).default;
    const lastUpdate = dataAggregator.getLastUpdateTime();

    if (!lastUpdate) {
      return {
        status: 'UNHEALTHY',
        message: 'No pool data available',
      };
    }

    const ageMinutes = (Date.now() - lastUpdate) / (1000 * 60);

    if (ageMinutes < 5) {
      return {
        status: 'HEALTHY',
        message: 'Pool data fresh',
        ageMinutes: ageMinutes.toFixed(1),
      };
    } else if (ageMinutes < 15) {
      return {
        status: 'DEGRADED',
        message: 'Pool data aging',
        ageMinutes: ageMinutes.toFixed(1),
      };
    } else {
      return {
        status: 'UNHEALTHY',
        message: 'Pool data stale',
        ageMinutes: ageMinutes.toFixed(1),
      };
    }
  } catch (error) {
    return {
      status: 'UNHEALTHY',
      message: 'Data aggregator check failed',
      error: error.message,
    };
  }
}, { critical: false });

export default healthCheckService;
