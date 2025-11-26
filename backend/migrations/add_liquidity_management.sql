-- Liquidity Management System - Database Schema
-- Supports both manual and automated liquidity positions
-- Includes TP/SL, auto-compound, rebalancing, and risk management

-- ============================================
-- LIQUIDITY POSITIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS liquidity_positions (
    id SERIAL PRIMARY KEY,
    position_address VARCHAR(44) UNIQUE NOT NULL, -- Solana position account address (NFT)
    wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    pool_address VARCHAR(44) NOT NULL,

    -- Token information
    token_x_mint VARCHAR(44) NOT NULL,
    token_y_mint VARCHAR(44) NOT NULL,
    token_x_symbol VARCHAR(20),
    token_y_symbol VARCHAR(20),

    -- Initial liquidity amounts
    initial_amount_x DECIMAL(30, 10) NOT NULL,
    initial_amount_y DECIMAL(30, 10) NOT NULL,
    initial_liquidity_usd DECIMAL(20, 2),

    -- Current liquidity amounts (updated periodically)
    current_amount_x DECIMAL(30, 10),
    current_amount_y DECIMAL(30, 10),
    current_liquidity_usd DECIMAL(20, 2),

    -- Price range
    lower_price DECIMAL(30, 10) NOT NULL,
    upper_price DECIMAL(30, 10) NOT NULL,

    -- Bin information
    lower_bin_id INTEGER NOT NULL,
    upper_bin_id INTEGER NOT NULL,
    active_bin_id_at_creation INTEGER, -- Active bin when position was created

    -- Strategy used
    strategy_name VARCHAR(50), -- e.g., 'Follow the Herd', 'Peak Liquidity'

    -- Transaction details
    creation_tx_signature VARCHAR(88) NOT NULL,

    -- Position type and status
    position_type VARCHAR(20) DEFAULT 'manual' CHECK (position_type IN ('manual', 'automated')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'failed')),

    -- Fees earned
    fees_earned_x DECIMAL(30, 10) DEFAULT 0,
    fees_earned_y DECIMAL(30, 10) DEFAULT 0,
    fees_earned_usd DECIMAL(20, 2) DEFAULT 0,
    last_fee_update TIMESTAMP WITH TIME ZONE,

    -- Performance tracking
    total_profit_usd DECIMAL(20, 2) DEFAULT 0, -- Total profit/loss (includes fees + IL)
    unrealized_pnl_usd DECIMAL(20, 2) DEFAULT 0, -- Current unrealized P&L

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- POSITION AUTOMATION RULES TABLE
-- ============================================
-- Per-position automation settings (TP/SL, compound, rebalance)
CREATE TABLE IF NOT EXISTS position_automation_rules (
    id SERIAL PRIMARY KEY,
    position_address VARCHAR(44) UNIQUE NOT NULL REFERENCES liquidity_positions(position_address) ON DELETE CASCADE,
    wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,

    -- Take Profit settings
    take_profit_enabled BOOLEAN DEFAULT FALSE,
    take_profit_type VARCHAR(20) CHECK (take_profit_type IN ('percentage', 'usd_amount', NULL)),
    take_profit_value DECIMAL(20, 2), -- % or USD amount
    take_profit_triggered BOOLEAN DEFAULT FALSE,

    -- Stop Loss settings
    stop_loss_enabled BOOLEAN DEFAULT FALSE,
    stop_loss_type VARCHAR(20) CHECK (stop_loss_type IN ('percentage', 'usd_amount', NULL)),
    stop_loss_value DECIMAL(20, 2), -- % or USD amount (negative)
    stop_loss_triggered BOOLEAN DEFAULT FALSE,

    -- Auto-Compound settings
    auto_compound_enabled BOOLEAN DEFAULT FALSE,
    compound_frequency_hours INTEGER DEFAULT 24, -- How often to check for compounding
    compound_min_threshold_usd DECIMAL(20, 2) DEFAULT 10.0, -- Min fees to justify gas
    last_compound_at TIMESTAMP WITH TIME ZONE,

    -- Rebalancing settings
    rebalancing_enabled BOOLEAN DEFAULT FALSE,
    rebalance_triggers JSONB DEFAULT '[]'::jsonb, -- Array of trigger objects
    -- Example: [{"type": "price_drift", "value": 10}, {"type": "imbalance_change", "value": 2.0}]
    last_rebalance_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- GLOBAL AUTOMATION CONFIGS TABLE
-- ============================================
-- Wallet-level automation defaults
CREATE TABLE IF NOT EXISTS automation_configs (
    wallet_address VARCHAR(44) PRIMARY KEY REFERENCES users(wallet_address) ON DELETE CASCADE,

    -- Automation enabled
    automation_enabled BOOLEAN DEFAULT FALSE,

    -- Default strategy
    default_strategy VARCHAR(50) DEFAULT 'Follow the Herd',

    -- Risk management
    max_position_size_percentage DECIMAL(5, 2) DEFAULT 10.0, -- Max % of wallet balance per position
    min_rugcheck_score INTEGER DEFAULT 50, -- Min security score (0-100)
    auto_close_on_security_drop BOOLEAN DEFAULT TRUE,
    security_drop_threshold INTEGER DEFAULT 30, -- Close if score drops below this

    -- Default TP/SL settings
    default_take_profit_percentage DECIMAL(5, 2) DEFAULT 50.0,
    default_stop_loss_percentage DECIMAL(5, 2) DEFAULT -25.0,

    -- Default compounding settings
    default_auto_compound BOOLEAN DEFAULT TRUE,
    default_compound_frequency_hours INTEGER DEFAULT 24,
    default_compound_threshold_usd DECIMAL(20, 2) DEFAULT 10.0,

    -- Default rebalancing settings
    default_rebalancing_enabled BOOLEAN DEFAULT TRUE,
    default_rebalance_triggers JSONB DEFAULT '[{"type": "price_drift", "value": 10}]'::jsonb,

    -- Notification preferences
    notify_on_open BOOLEAN DEFAULT TRUE,
    notify_on_close BOOLEAN DEFAULT TRUE,
    notify_on_take_profit BOOLEAN DEFAULT TRUE,
    notify_on_stop_loss BOOLEAN DEFAULT TRUE,
    notify_on_compound BOOLEAN DEFAULT FALSE,
    notify_on_rebalance BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- POOL AUTOMATION OVERRIDES TABLE
-- ============================================
-- Per-pool automation overrides (optional)
CREATE TABLE IF NOT EXISTS pool_automation_overrides (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    pool_address VARCHAR(44) NOT NULL,

    -- Override settings (NULL means use global default)
    strategy_override VARCHAR(50),
    max_position_size_override DECIMAL(5, 2),
    take_profit_override DECIMAL(5, 2),
    stop_loss_override DECIMAL(5, 2),
    auto_compound_override BOOLEAN,
    rebalancing_override BOOLEAN,
    rebalance_triggers_override JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(wallet_address, pool_address)
);

-- ============================================
-- LIQUIDITY TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS liquidity_transactions (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    pool_address VARCHAR(44) NOT NULL,
    position_address VARCHAR(44), -- NULL for failed transactions

    -- Transaction type
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'add_liquidity',
        'remove_liquidity',
        'claim_fees',
        'compound',
        'rebalance',
        'take_profit_close',
        'stop_loss_close'
    )),

    -- Amounts
    amount_x DECIMAL(30, 10),
    amount_y DECIMAL(30, 10),
    amount_usd DECIMAL(20, 2),

    -- Fees (for compound transactions)
    fees_claimed_x DECIMAL(30, 10),
    fees_claimed_y DECIMAL(30, 10),
    fees_claimed_usd DECIMAL(20, 2),

    -- Transaction details
    transaction_signature VARCHAR(88) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    error_message TEXT,

    -- Execution context
    execution_mode VARCHAR(20) DEFAULT 'manual' CHECK (execution_mode IN ('manual', 'automated')),
    triggered_by VARCHAR(50), -- e.g., 'user', 'take_profit', 'stop_loss', 'rebalance_price_drift'

    -- Gas costs (for profitability calculation)
    gas_cost_sol DECIMAL(20, 10),
    gas_cost_usd DECIMAL(10, 2),

    -- Metadata
    metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- POOL FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pool_favorites (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    pool_address VARCHAR(44) NOT NULL,

    -- Pool info (cached for quick display)
    pair_name VARCHAR(50),
    token_x_mint VARCHAR(44),
    token_y_mint VARCHAR(44),
    token_x_symbol VARCHAR(20),
    token_y_symbol VARCHAR(20),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(wallet_address, pool_address)
);

-- ============================================
-- MONITORING QUEUE TABLE
-- ============================================
-- Track positions that need monitoring checks
CREATE TABLE IF NOT EXISTS position_monitoring_queue (
    id SERIAL PRIMARY KEY,
    position_address VARCHAR(44) NOT NULL REFERENCES liquidity_positions(position_address) ON DELETE CASCADE,
    check_type VARCHAR(50) NOT NULL, -- 'take_profit', 'stop_loss', 'compound', 'rebalance'
    next_check_at TIMESTAMP WITH TIME ZONE NOT NULL,
    check_interval_minutes INTEGER DEFAULT 15,
    last_checked_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(position_address, check_type)
);

-- ============================================
-- INDEXES
-- ============================================

-- liquidity_positions indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_wallet ON liquidity_positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_pool ON liquidity_positions(pool_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_status ON liquidity_positions(status);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_type ON liquidity_positions(position_type);
CREATE INDEX IF NOT EXISTS idx_liquidity_positions_created ON liquidity_positions(created_at DESC);

-- position_automation_rules indexes
CREATE INDEX IF NOT EXISTS idx_position_automation_wallet ON position_automation_rules(wallet_address);
CREATE INDEX IF NOT EXISTS idx_position_automation_tp_enabled ON position_automation_rules(take_profit_enabled) WHERE take_profit_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_position_automation_sl_enabled ON position_automation_rules(stop_loss_enabled) WHERE stop_loss_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_position_automation_compound_enabled ON position_automation_rules(auto_compound_enabled) WHERE auto_compound_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_position_automation_rebalance_enabled ON position_automation_rules(rebalancing_enabled) WHERE rebalancing_enabled = TRUE;

-- liquidity_transactions indexes
CREATE INDEX IF NOT EXISTS idx_liquidity_transactions_wallet ON liquidity_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_transactions_pool ON liquidity_transactions(pool_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_transactions_position ON liquidity_transactions(position_address);
CREATE INDEX IF NOT EXISTS idx_liquidity_transactions_status ON liquidity_transactions(status);
CREATE INDEX IF NOT EXISTS idx_liquidity_transactions_type ON liquidity_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_liquidity_transactions_created ON liquidity_transactions(created_at DESC);

-- pool_favorites indexes
CREATE INDEX IF NOT EXISTS idx_pool_favorites_wallet ON pool_favorites(wallet_address);
CREATE INDEX IF NOT EXISTS idx_pool_favorites_pool ON pool_favorites(pool_address);

-- position_monitoring_queue indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_queue_next_check ON position_monitoring_queue(next_check_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_queue_position ON position_monitoring_queue(position_address);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_liquidity_positions_updated_at
    BEFORE UPDATE ON liquidity_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_position_automation_rules_updated_at
    BEFORE UPDATE ON position_automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_configs_updated_at
    BEFORE UPDATE ON automation_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pool_automation_overrides_updated_at
    BEFORE UPDATE ON pool_automation_overrides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_liquidity_transactions_updated_at
    BEFORE UPDATE ON liquidity_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get active positions that need monitoring
CREATE OR REPLACE FUNCTION get_positions_needing_monitoring()
RETURNS TABLE (
    position_address VARCHAR(44),
    wallet_address VARCHAR(44),
    pool_address VARCHAR(44),
    current_liquidity_usd DECIMAL(20, 2),
    total_profit_usd DECIMAL(20, 2),
    rules JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.position_address,
        p.wallet_address,
        p.pool_address,
        p.current_liquidity_usd,
        p.total_profit_usd,
        jsonb_build_object(
            'take_profit_enabled', r.take_profit_enabled,
            'take_profit_value', r.take_profit_value,
            'stop_loss_enabled', r.stop_loss_enabled,
            'stop_loss_value', r.stop_loss_value,
            'auto_compound_enabled', r.auto_compound_enabled,
            'compound_min_threshold_usd', r.compound_min_threshold_usd,
            'rebalancing_enabled', r.rebalancing_enabled,
            'rebalance_triggers', r.rebalance_triggers
        ) as rules
    FROM liquidity_positions p
    INNER JOIN position_automation_rules r ON p.position_address = r.position_address
    WHERE p.status = 'active'
    AND (
        r.take_profit_enabled = TRUE
        OR r.stop_loss_enabled = TRUE
        OR r.auto_compound_enabled = TRUE
        OR r.rebalancing_enabled = TRUE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE liquidity_positions IS 'Tracks all liquidity positions (manual and automated)';
COMMENT ON TABLE position_automation_rules IS 'Per-position automation settings (TP/SL, compound, rebalance)';
COMMENT ON TABLE automation_configs IS 'Wallet-level global automation defaults';
COMMENT ON TABLE pool_automation_overrides IS 'Per-pool automation overrides (optional customization)';
COMMENT ON TABLE liquidity_transactions IS 'Records all liquidity-related transactions';
COMMENT ON TABLE pool_favorites IS 'User-favorited pools for quick access';
COMMENT ON TABLE position_monitoring_queue IS 'Tracks when positions need next monitoring check';

COMMENT ON COLUMN position_automation_rules.rebalance_triggers IS 'JSON array of trigger objects. Example: [{"type": "price_drift", "value": 10}, {"type": "imbalance_change", "value": 2.0}, {"type": "fee_threshold", "value": 50}]';
COMMENT ON COLUMN automation_configs.max_position_size_percentage IS 'Maximum % of wallet balance to allocate per automated position';
COMMENT ON COLUMN automation_configs.min_rugcheck_score IS 'Minimum RugCheck security score required to auto-open positions';
