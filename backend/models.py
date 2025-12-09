"""
Database models for Capital Rotation Monitoring
"""

from sqlalchemy import create_engine, Column, String, Integer, Boolean, DECIMAL, BigInteger, TIMESTAMP, ForeignKey, Index, text, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
import os
import logging
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Configure connection pool for Supabase Transaction mode
# MASSIVE pool for high-frequency monitoring with 5+ concurrent users
# With degen monitoring running every 1 minute, we need large pools to handle bursts
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # Verify connections before using
    pool_size=20,               # INCREASED: Base pool for concurrent monitoring jobs
    max_overflow=30,            # INCREASED: Allow burst to 50 total connections for high-frequency checks
    pool_recycle=180,           # REDUCED: Recycle faster (3 min) to prevent SSL timeout issues
    pool_timeout=45,            # INCREASED: More patience for connection availability
    pool_reset_on_return='rollback',  # Important for Transaction mode - reset state on return
    echo_pool=False,            # Set to True for connection pool debugging
    connect_args={
        'connect_timeout': 10,  # Connection establishment timeout
        'keepalives': 1,        # Enable TCP keepalives
        'keepalives_idle': 30,  # Start keepalives after 30s idle
        'keepalives_interval': 10,  # Keepalive probe interval
        'keepalives_count': 5   # Number of keepalive probes
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        return db
    except Exception as e:
        db.close()
        raise e

class User(Base):
    __tablename__ = 'users'

    wallet_address = Column(String(44), primary_key=True)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=False, index=True)
    telegram_username = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    monitoring_config = relationship("MonitoringConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    degen_config = relationship("DegenConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")
    opportunity_snapshots = relationship("OpportunitySnapshot", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'wallet_address': self.wallet_address,
            'telegram_chat_id': self.telegram_chat_id,
            'telegram_username': self.telegram_username,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class MonitoringConfig(Base):
    __tablename__ = 'monitoring_configs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), unique=True, nullable=False)
    enabled = Column(Boolean, default=False, index=True)
    interval_minutes = Column(Integer, default=15)
    threshold_multiplier = Column(DECIMAL(4, 2), default=1.3)
    whitelist = Column(JSONB, default=list)
    quote_preferences = Column(JSONB, default={'sol': True, 'usdc': True})
    min_fees_30min = Column(DECIMAL(10, 2), default=100.0)
    last_check = Column(TIMESTAMP(timezone=True), nullable=True)
    next_check = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="monitoring_config")

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'enabled': self.enabled,
            'interval_minutes': self.interval_minutes,
            'threshold_multiplier': float(self.threshold_multiplier),
            'whitelist': self.whitelist,
            'quote_preferences': self.quote_preferences,
            'min_fees_30min': float(self.min_fees_30min),
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'next_check': self.next_check.isoformat() if self.next_check else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class TelegramAuthCode(Base):
    __tablename__ = 'telegram_auth_codes'

    code = Column(String(6), primary_key=True)
    wallet_address = Column(String(44), nullable=False, index=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    used = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    def to_dict(self):
        return {
            'code': self.code,
            'wallet_address': self.wallet_address,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'used': self.used,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class OpportunitySnapshot(Base):
    __tablename__ = 'opportunity_snapshots'
    __table_args__ = (
        # Composite index for efficient queries ordered by created_at per wallet
        Index('idx_snapshots_wallet_created', 'wallet_address', 'created_at'),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), nullable=False, index=True)
    opportunities = Column(JSONB, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="opportunity_snapshots")

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'opportunities': self.opportunities,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class DegenConfig(Base):
    """
    Degen Mode Configuration
    Stores wallet and monitoring settings for high-frequency fee rate monitoring
    """
    __tablename__ = 'degen_configs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), unique=True, nullable=False)
    wallet_type = Column(String(20), nullable=False)  # 'imported' or 'generated'
    degen_wallet_address = Column(String(44), nullable=False)  # The wallet used for degen mode
    encrypted_private_key = Column(LargeBinary, nullable=False)  # Encrypted private key
    min_fee_rate_threshold = Column(DECIMAL(10, 2), default=5.0)  # Fee rate threshold percentage
    check_interval_minutes = Column(Integer, default=1)  # Check interval (default 1 minute)
    enabled = Column(Boolean, default=False, index=True)
    automation_enabled = Column(Boolean, default=False)  # For Phase 2: automated LP provision
    max_position_size = Column(DECIMAL(10, 2), nullable=True)  # For Phase 2: max SOL per position
    last_check = Column(TIMESTAMP(timezone=True), nullable=True)
    next_check = Column(TIMESTAMP(timezone=True), nullable=True)
    last_notified_pools = Column(JSONB, default=dict)  # Track recently notified pools to avoid spam
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="degen_config")

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'wallet_type': self.wallet_type,
            'degen_wallet_address': self.degen_wallet_address,
            'min_fee_rate_threshold': float(self.min_fee_rate_threshold),
            'check_interval_minutes': self.check_interval_minutes,
            'enabled': self.enabled,
            'automation_enabled': self.automation_enabled,
            'max_position_size': float(self.max_position_size) if self.max_position_size else None,
            'last_check': self.last_check.isoformat() if self.last_check else None,
            'next_check': self.next_check.isoformat() if self.next_check else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


# ============================================
# LIQUIDITY MANAGEMENT MODELS
# ============================================

class LiquidityPosition(Base):
    """Tracks user liquidity positions in DLMM pools"""
    __tablename__ = 'liquidity_positions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    position_address = Column(String(44), unique=True, nullable=False, index=True)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), nullable=False, index=True)
    pool_address = Column(String(44), nullable=False, index=True)

    # Token information
    token_x_mint = Column(String(44), nullable=False)
    token_y_mint = Column(String(44), nullable=False)
    token_x_symbol = Column(String(20))
    token_y_symbol = Column(String(20))

    # Initial liquidity
    initial_amount_x = Column(DECIMAL(30, 10), nullable=False)
    initial_amount_y = Column(DECIMAL(30, 10), nullable=False)
    initial_liquidity_usd = Column(DECIMAL(20, 2))

    # Current liquidity (updated periodically)
    current_amount_x = Column(DECIMAL(30, 10))
    current_amount_y = Column(DECIMAL(30, 10))
    current_liquidity_usd = Column(DECIMAL(20, 2))

    # Price range
    lower_price = Column(DECIMAL(30, 10), nullable=False)
    upper_price = Column(DECIMAL(30, 10), nullable=False)

    # Bin information
    lower_bin_id = Column(Integer, nullable=False)
    upper_bin_id = Column(Integer, nullable=False)
    active_bin_id_at_creation = Column(Integer)

    # Strategy used
    strategy_name = Column(String(50))

    # Transaction details
    creation_tx_signature = Column(String(88), nullable=False)

    # Position type and status
    position_type = Column(String(20), default='manual')  # 'manual' or 'automated'
    status = Column(String(20), default='active', index=True)  # 'active', 'closed', 'failed'

    # Fees earned
    fees_earned_x = Column(DECIMAL(30, 10), default=0)
    fees_earned_y = Column(DECIMAL(30, 10), default=0)
    fees_earned_usd = Column(DECIMAL(20, 2), default=0)
    last_fee_update = Column(TIMESTAMP(timezone=True))

    # Performance tracking
    total_profit_usd = Column(DECIMAL(20, 2), default=0)
    unrealized_pnl_usd = Column(DECIMAL(20, 2), default=0)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    closed_at = Column(TIMESTAMP(timezone=True))
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'position_address': self.position_address,
            'wallet_address': self.wallet_address,
            'pool_address': self.pool_address,
            'token_x_mint': self.token_x_mint,
            'token_y_mint': self.token_y_mint,
            'token_x_symbol': self.token_x_symbol,
            'token_y_symbol': self.token_y_symbol,
            'initial_amount_x': float(self.initial_amount_x) if self.initial_amount_x else None,
            'initial_amount_y': float(self.initial_amount_y) if self.initial_amount_y else None,
            'initial_liquidity_usd': float(self.initial_liquidity_usd) if self.initial_liquidity_usd else None,
            'current_amount_x': float(self.current_amount_x) if self.current_amount_x else None,
            'current_amount_y': float(self.current_amount_y) if self.current_amount_y else None,
            'current_liquidity_usd': float(self.current_liquidity_usd) if self.current_liquidity_usd else None,
            'lower_price': float(self.lower_price) if self.lower_price else None,
            'upper_price': float(self.upper_price) if self.upper_price else None,
            'lower_bin_id': self.lower_bin_id,
            'upper_bin_id': self.upper_bin_id,
            'active_bin_id_at_creation': self.active_bin_id_at_creation,
            'strategy_name': self.strategy_name,
            'creation_tx_signature': self.creation_tx_signature,
            'position_type': self.position_type,
            'status': self.status,
            'fees_earned_x': float(self.fees_earned_x) if self.fees_earned_x else 0,
            'fees_earned_y': float(self.fees_earned_y) if self.fees_earned_y else 0,
            'fees_earned_usd': float(self.fees_earned_usd) if self.fees_earned_usd else 0,
            'last_fee_update': self.last_fee_update.isoformat() if self.last_fee_update else None,
            'total_profit_usd': float(self.total_profit_usd) if self.total_profit_usd else 0,
            'unrealized_pnl_usd': float(self.unrealized_pnl_usd) if self.unrealized_pnl_usd else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PositionAutomationRules(Base):
    """Per-position automation settings (TP/SL, compound, rebalance)"""
    __tablename__ = 'position_automation_rules'

    id = Column(Integer, primary_key=True, autoincrement=True)
    position_address = Column(String(44), ForeignKey('liquidity_positions.position_address', ondelete='CASCADE'), unique=True, nullable=False)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), nullable=False, index=True)

    # Take Profit settings
    take_profit_enabled = Column(Boolean, default=False, index=True)
    take_profit_type = Column(String(20))  # 'percentage' or 'usd_amount'
    take_profit_value = Column(DECIMAL(20, 2))
    take_profit_triggered = Column(Boolean, default=False)

    # Stop Loss settings
    stop_loss_enabled = Column(Boolean, default=False, index=True)
    stop_loss_type = Column(String(20))  # 'percentage' or 'usd_amount'
    stop_loss_value = Column(DECIMAL(20, 2))
    stop_loss_triggered = Column(Boolean, default=False)

    # Auto-Compound settings
    auto_compound_enabled = Column(Boolean, default=False, index=True)
    compound_frequency_hours = Column(Integer, default=24)
    compound_min_threshold_usd = Column(DECIMAL(20, 2), default=10.0)
    last_compound_at = Column(TIMESTAMP(timezone=True))

    # Rebalancing settings
    rebalancing_enabled = Column(Boolean, default=False, index=True)
    rebalance_triggers = Column(JSONB, default=list)  # Array of trigger objects
    last_rebalance_at = Column(TIMESTAMP(timezone=True))

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'position_address': self.position_address,
            'wallet_address': self.wallet_address,
            'take_profit_enabled': self.take_profit_enabled,
            'take_profit_type': self.take_profit_type,
            'take_profit_value': float(self.take_profit_value) if self.take_profit_value else None,
            'take_profit_triggered': self.take_profit_triggered,
            'stop_loss_enabled': self.stop_loss_enabled,
            'stop_loss_type': self.stop_loss_type,
            'stop_loss_value': float(self.stop_loss_value) if self.stop_loss_value else None,
            'stop_loss_triggered': self.stop_loss_triggered,
            'auto_compound_enabled': self.auto_compound_enabled,
            'compound_frequency_hours': self.compound_frequency_hours,
            'compound_min_threshold_usd': float(self.compound_min_threshold_usd) if self.compound_min_threshold_usd else None,
            'last_compound_at': self.last_compound_at.isoformat() if self.last_compound_at else None,
            'rebalancing_enabled': self.rebalancing_enabled,
            'rebalance_triggers': self.rebalance_triggers,
            'last_rebalance_at': self.last_rebalance_at.isoformat() if self.last_rebalance_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class AutomationConfig(Base):
    """Wallet-level global automation defaults"""
    __tablename__ = 'automation_configs'

    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), primary_key=True)

    # Automation enabled
    automation_enabled = Column(Boolean, default=False)

    # Default strategy
    default_strategy = Column(String(50), default='Follow the Herd')

    # Risk management
    max_position_size_percentage = Column(DECIMAL(5, 2), default=10.0)
    min_rugcheck_score = Column(Integer, default=50)
    auto_close_on_security_drop = Column(Boolean, default=True)
    security_drop_threshold = Column(Integer, default=30)

    # Default TP/SL settings
    default_take_profit_percentage = Column(DECIMAL(5, 2), default=50.0)
    default_stop_loss_percentage = Column(DECIMAL(5, 2), default=-25.0)

    # Default compounding settings
    default_auto_compound = Column(Boolean, default=True)
    default_compound_frequency_hours = Column(Integer, default=24)
    default_compound_threshold_usd = Column(DECIMAL(20, 2), default=10.0)

    # Default rebalancing settings
    default_rebalancing_enabled = Column(Boolean, default=True)
    default_rebalance_triggers = Column(JSONB, default=[{"type": "price_drift", "value": 10}])

    # Notification preferences
    notify_on_open = Column(Boolean, default=True)
    notify_on_close = Column(Boolean, default=True)
    notify_on_take_profit = Column(Boolean, default=True)
    notify_on_stop_loss = Column(Boolean, default=True)
    notify_on_compound = Column(Boolean, default=False)
    notify_on_rebalance = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'wallet_address': self.wallet_address,
            'automation_enabled': self.automation_enabled,
            'default_strategy': self.default_strategy,
            'max_position_size_percentage': float(self.max_position_size_percentage) if self.max_position_size_percentage else None,
            'min_rugcheck_score': self.min_rugcheck_score,
            'auto_close_on_security_drop': self.auto_close_on_security_drop,
            'security_drop_threshold': self.security_drop_threshold,
            'default_take_profit_percentage': float(self.default_take_profit_percentage) if self.default_take_profit_percentage else None,
            'default_stop_loss_percentage': float(self.default_stop_loss_percentage) if self.default_stop_loss_percentage else None,
            'default_auto_compound': self.default_auto_compound,
            'default_compound_frequency_hours': self.default_compound_frequency_hours,
            'default_compound_threshold_usd': float(self.default_compound_threshold_usd) if self.default_compound_threshold_usd else None,
            'default_rebalancing_enabled': self.default_rebalancing_enabled,
            'default_rebalance_triggers': self.default_rebalance_triggers,
            'notify_on_open': self.notify_on_open,
            'notify_on_close': self.notify_on_close,
            'notify_on_take_profit': self.notify_on_take_profit,
            'notify_on_stop_loss': self.notify_on_stop_loss,
            'notify_on_compound': self.notify_on_compound,
            'notify_on_rebalance': self.notify_on_rebalance,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class LiquidityTransaction(Base):
    """Records all liquidity-related transactions"""
    __tablename__ = 'liquidity_transactions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), nullable=False, index=True)
    pool_address = Column(String(44), nullable=False, index=True)
    position_address = Column(String(44), index=True)  # NULL for failed transactions

    # Transaction type
    transaction_type = Column(String(20), nullable=False, index=True)

    # Amounts
    amount_x = Column(DECIMAL(30, 10))
    amount_y = Column(DECIMAL(30, 10))
    amount_usd = Column(DECIMAL(20, 2))

    # Fees (for compound transactions)
    fees_claimed_x = Column(DECIMAL(30, 10))
    fees_claimed_y = Column(DECIMAL(30, 10))
    fees_claimed_usd = Column(DECIMAL(20, 2))

    # Transaction details
    transaction_signature = Column(String(88), unique=True, nullable=False)
    status = Column(String(20), default='pending', index=True)
    error_message = Column(String)

    # Execution context
    execution_mode = Column(String(20), default='manual')  # 'manual' or 'automated'
    triggered_by = Column(String(50))

    # Gas costs
    gas_cost_sol = Column(DECIMAL(20, 10))
    gas_cost_usd = Column(DECIMAL(10, 2))

    # Transaction metadata
    tx_metadata = Column(JSONB)

    # Timestamps
    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, index=True)
    confirmed_at = Column(TIMESTAMP(timezone=True))
    updated_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'pool_address': self.pool_address,
            'position_address': self.position_address,
            'transaction_type': self.transaction_type,
            'amount_x': float(self.amount_x) if self.amount_x else None,
            'amount_y': float(self.amount_y) if self.amount_y else None,
            'amount_usd': float(self.amount_usd) if self.amount_usd else None,
            'fees_claimed_x': float(self.fees_claimed_x) if self.fees_claimed_x else None,
            'fees_claimed_y': float(self.fees_claimed_y) if self.fees_claimed_y else None,
            'fees_claimed_usd': float(self.fees_claimed_usd) if self.fees_claimed_usd else None,
            'transaction_signature': self.transaction_signature,
            'status': self.status,
            'error_message': self.error_message,
            'execution_mode': self.execution_mode,
            'triggered_by': self.triggered_by,
            'gas_cost_sol': float(self.gas_cost_sol) if self.gas_cost_sol else None,
            'gas_cost_usd': float(self.gas_cost_usd) if self.gas_cost_usd else None,
            'metadata': self.tx_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class PoolFavorite(Base):
    """User-favorited pools for quick access"""
    __tablename__ = 'pool_favorites'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(44), ForeignKey('users.wallet_address', ondelete='CASCADE'), nullable=False, index=True)
    pool_address = Column(String(44), nullable=False, index=True)

    # Pool info (cached)
    pair_name = Column(String(50))
    token_x_mint = Column(String(44))
    token_y_mint = Column(String(44))
    token_x_symbol = Column(String(20))
    token_y_symbol = Column(String(20))

    created_at = Column(TIMESTAMP(timezone=True), default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'pool_address': self.pool_address,
            'pair_name': self.pair_name,
            'token_x_mint': self.token_x_mint,
            'token_y_mint': self.token_y_mint,
            'token_x_symbol': self.token_x_symbol,
            'token_y_symbol': self.token_y_symbol,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# Helper functions
def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)


def cleanup_expired_auth_codes(db):
    """Clean up expired or used auth codes"""
    try:
        now = datetime.utcnow()
        deleted = db.query(TelegramAuthCode).filter(
            (TelegramAuthCode.expires_at < now) | (TelegramAuthCode.used == True)
        ).delete()
        db.commit()
        return deleted
    except Exception as e:
        db.rollback()
        raise e


def cleanup_old_snapshots(db, keep_last_n=10):
    """
    Clean up old opportunity snapshots, keeping only the most recent N per user.

    Args:
        db: Database session
        keep_last_n: Number of recent snapshots to keep per user (default: 10)

    Returns:
        Number of snapshots deleted
    """
    try:
        # Use SQL to delete old snapshots efficiently
        # This keeps the last N snapshots per wallet_address
        delete_query = text("""
            DELETE FROM opportunity_snapshots
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY wallet_address
                               ORDER BY created_at DESC
                           ) as rn
                    FROM opportunity_snapshots
                ) t
                WHERE rn > :keep_last_n
            )
        """)

        result = db.execute(delete_query, {'keep_last_n': keep_last_n})
        deleted_count = result.rowcount
        db.commit()

        return deleted_count

    except Exception as e:
        db.rollback()
        raise e


def create_performance_indexes(db):
    """
    Create performance indexes for scalability
    Safe to run multiple times - uses IF NOT EXISTS
    """
    try:
        # Composite index on opportunity_snapshots for cleanup query performance
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_snapshots_wallet_created
            ON opportunity_snapshots(wallet_address, created_at DESC)
        """))

        # Partial index on monitoring_configs for active monitors
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_active_monitors
            ON monitoring_configs(wallet_address)
            WHERE enabled = TRUE
        """))

        db.commit()
        logger = logging.getLogger(__name__)
        logger.info("✅ Performance indexes created/verified")

    except Exception as e:
        db.rollback()
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating performance indexes: {e}")
        raise e
