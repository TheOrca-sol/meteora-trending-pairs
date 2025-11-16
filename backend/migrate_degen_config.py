"""
Migration script to create degen_configs table
"""
import logging
from sqlalchemy import text
from models import Base, engine, get_db, DegenConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    """Create degen_configs table"""
    try:
        logger.info("Creating degen_configs table...")

        # Create only the degen_configs table
        DegenConfig.__table__.create(bind=engine, checkfirst=True)

        logger.info("✅ Successfully created degen_configs table")

        # Verify table exists
        db = get_db()
        try:
            result = db.execute(text("SELECT COUNT(*) FROM degen_configs"))
            count = result.scalar()
            logger.info(f"✅ Table verified - contains {count} rows")
        except Exception as e:
            logger.error(f"❌ Error verifying table: {e}")
        finally:
            db.close()

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    migrate()
