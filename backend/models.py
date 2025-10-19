"""
Database models for Capital Rotation Monitoring
"""

from sqlalchemy import create_engine, Column, String, Integer, Boolean, DECIMAL, BigInteger, TIMESTAMP, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

# Database connection
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
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
