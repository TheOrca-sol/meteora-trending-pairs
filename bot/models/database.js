import pg from 'pg';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const { Pool } = pg;

class Database {
  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
  }

  /**
   * Initialize database tables
   */
  async initialize() {
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS pools (
          address VARCHAR(44) PRIMARY KEY,
          name VARCHAR(100),
          mint_x VARCHAR(44),
          mint_y VARCHAR(44),
          bin_step INTEGER,
          base_fee DECIMAL(10, 4),
          is_blacklisted BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pool_metrics (
          id SERIAL PRIMARY KEY,
          pool_address VARCHAR(44) REFERENCES pools(address),
          price DECIMAL(20, 8),
          fees_24h DECIMAL(20, 8),
          apr DECIMAL(10, 2),
          tvl DECIMAL(20, 2),
          volume_24h DECIMAL(20, 2),
          txn_count_24h INTEGER,
          buy_percent DECIMAL(5, 2),
          price_change_24h DECIMAL(10, 2),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_pool_metrics_pool_address ON pool_metrics(pool_address);
        CREATE INDEX IF NOT EXISTS idx_pool_metrics_timestamp ON pool_metrics(timestamp);

        CREATE TABLE IF NOT EXISTS positions (
          id SERIAL PRIMARY KEY,
          pool_address VARCHAR(44) REFERENCES pools(address),
          position_pubkey VARCHAR(44) UNIQUE,
          strategy VARCHAR(20),
          entry_price DECIMAL(20, 8),
          entry_tvl DECIMAL(20, 2),
          entry_apr DECIMAL(10, 2),
          liquidity_amount DECIMAL(20, 8),
          lower_bin_id INTEGER,
          upper_bin_id INTEGER,
          status VARCHAR(20) DEFAULT 'active',
          entry_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          exit_timestamp TIMESTAMP,
          exit_reason VARCHAR(100),
          realized_pnl DECIMAL(20, 8)
        );

        CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
        CREATE INDEX IF NOT EXISTS idx_positions_pool_address ON positions(pool_address);

        CREATE TABLE IF NOT EXISTS rewards (
          id SERIAL PRIMARY KEY,
          position_id INTEGER REFERENCES positions(id),
          reward_type VARCHAR(20),
          amount DECIMAL(20, 8),
          token_mint VARCHAR(44),
          claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50),
          position_id INTEGER REFERENCES positions(id),
          pool_address VARCHAR(44),
          description TEXT,
          data JSONB,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

        CREATE TABLE IF NOT EXISTS bot_state (
          key VARCHAR(50) PRIMARY KEY,
          value JSONB,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      logger.info('Database tables initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Executed query in ${duration}ms`);
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  /**
   * Get active positions
   */
  async getActivePositions() {
    const result = await this.query(`
      SELECT p.*, po.name as pool_name
      FROM positions p
      JOIN pools po ON p.pool_address = po.address
      WHERE p.status = 'active'
      ORDER BY p.entry_timestamp DESC
    `);
    return result.rows;
  }

  /**
   * Save pool metrics
   */
  async savePoolMetrics(poolAddress, metrics) {
    await this.query(`
      INSERT INTO pool_metrics (
        pool_address, price, fees_24h, apr, tvl, volume_24h,
        txn_count_24h, buy_percent, price_change_24h
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      poolAddress,
      metrics.price,
      metrics.fees24h,
      metrics.apr,
      metrics.tvl,
      metrics.volume24h,
      metrics.txnCount24h,
      metrics.buyPercent,
      metrics.priceChange24h,
    ]);
  }

  /**
   * Get pool metrics history
   */
  async getPoolMetricsHistory(poolAddress, hoursBack = 24) {
    const result = await this.query(`
      SELECT *
      FROM pool_metrics
      WHERE pool_address = $1
        AND timestamp > NOW() - INTERVAL '${hoursBack} hours'
      ORDER BY timestamp DESC
    `, [poolAddress]);
    return result.rows;
  }

  /**
   * Create position record
   */
  async createPosition(positionData) {
    const result = await this.query(`
      INSERT INTO positions (
        pool_address, position_pubkey, strategy, entry_price,
        entry_tvl, entry_apr, liquidity_amount, lower_bin_id, upper_bin_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      positionData.poolAddress,
      positionData.positionPubkey,
      positionData.strategy,
      positionData.entryPrice,
      positionData.entryTvl,
      positionData.entryApr,
      positionData.liquidityAmount,
      positionData.lowerBinId,
      positionData.upperBinId,
    ]);
    return result.rows[0].id;
  }

  /**
   * Update position status
   */
  async updatePositionStatus(positionId, status, exitReason = null, pnl = null) {
    await this.query(`
      UPDATE positions
      SET status = $1,
          exit_timestamp = CASE WHEN $1 = 'closed' THEN NOW() ELSE exit_timestamp END,
          exit_reason = $2,
          realized_pnl = $3
      WHERE id = $4
    `, [status, exitReason, pnl, positionId]);
  }

  /**
   * Log event
   */
  async logEvent(eventType, positionId, poolAddress, description, data = {}) {
    await this.query(`
      INSERT INTO events (event_type, position_id, pool_address, description, data)
      VALUES ($1, $2, $3, $4, $5)
    `, [eventType, positionId, poolAddress, description, JSON.stringify(data)]);
  }

  /**
   * Get bot state
   */
  async getBotState(key) {
    const result = await this.query(`
      SELECT value FROM bot_state WHERE key = $1
    `, [key]);
    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  /**
   * Set bot state
   */
  async setBotState(key, value) {
    await this.query(`
      INSERT INTO bot_state (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = $2, updated_at = NOW()
    `, [key, JSON.stringify(value)]);
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
    logger.info('Database connection closed');
  }
}

export default new Database();
