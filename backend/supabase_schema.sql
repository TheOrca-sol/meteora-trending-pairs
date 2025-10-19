-- Supabase PostgreSQL Schema for Meteora Capital Rotation Monitoring
-- Run this in your Supabase SQL Editor

-- Users table: Links wallet addresses to Telegram chat IDs
CREATE TABLE IF NOT EXISTS users (
    wallet_address VARCHAR(44) PRIMARY KEY,
    telegram_chat_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monitoring configurations table
CREATE TABLE IF NOT EXISTS monitoring_configs (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) UNIQUE NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    interval_minutes INTEGER DEFAULT 15,
    threshold_multiplier DECIMAL(4,2) DEFAULT 1.3,
    whitelist JSONB DEFAULT '[]'::jsonb,
    quote_preferences JSONB DEFAULT '{"sol": true, "usdc": true}'::jsonb,
    min_fees_30min DECIMAL(10,2) DEFAULT 100.0,
    last_check TIMESTAMP WITH TIME ZONE,
    next_check TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temporary auth codes for Telegram linking
CREATE TABLE IF NOT EXISTS telegram_auth_codes (
    code VARCHAR(6) PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Previous opportunities cache (for comparison)
CREATE TABLE IF NOT EXISTS opportunity_snapshots (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(44) NOT NULL REFERENCES users(wallet_address) ON DELETE CASCADE,
    opportunities JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_telegram_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_enabled ON monitoring_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_auth_code_expires ON telegram_auth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_code_wallet ON telegram_auth_codes(wallet_address);
CREATE INDEX IF NOT EXISTS idx_opportunity_wallet ON opportunity_snapshots(wallet_address);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monitoring_configs_updated_at BEFORE UPDATE ON monitoring_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired auth codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_auth_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telegram_auth_codes
    WHERE expires_at < NOW() OR used = TRUE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores wallet addresses linked to Telegram chat IDs';
COMMENT ON TABLE monitoring_configs IS 'User-specific monitoring configurations';
COMMENT ON TABLE telegram_auth_codes IS 'Temporary 6-digit codes for linking Telegram accounts (5 min expiry)';
COMMENT ON TABLE opportunity_snapshots IS 'Cached opportunity data for comparison to detect new opportunities';
