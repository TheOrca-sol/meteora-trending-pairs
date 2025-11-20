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

# Configure connection pool for Supabase Session mode limits
# Supabase Session mode has strict connection limits, so we use a smaller pool
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,        # Verify connections before using
    pool_size=5,                # Reduced from 10 to fit Supabase limits
    max_overflow=5,             # Reduced from 20 to fit Supabase limits
    pool_recycle=300,           # Recycle connections after 5 minutes to prevent stale connections
    pool_timeout=30,            # Wait up to 30 seconds for a connection
    echo_pool=False             # Set to True for connection pool debugging
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
