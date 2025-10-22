"""
Degen Mode Monitoring Service
Monitors ALL pools for high 30min fee rates and sends Telegram notifications
"""

import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from models import get_db, User, DegenConfig
from telegram_bot import telegram_bot_handler
from pool_cache import get_pools_from_cache

logger = logging.getLogger(__name__)


class DegenMonitoringService:
    def __init__(self):
        """Initialize the degen monitoring service"""
        from apscheduler.executors.pool import ThreadPoolExecutor

        executors = {
            'default': ThreadPoolExecutor(5)
        }

        job_defaults = {
            'coalesce': False,
            'max_instances': 3,
            'misfire_grace_time': 120  # 2 minutes
        }

        self.scheduler = BackgroundScheduler(
            executors=executors,
            job_defaults=job_defaults
        )
        self.scheduler.start()
        logger.info("✅ Degen monitoring service initialized")

    def load_active_monitors(self):
        """Load all active degen monitors from database and schedule them"""
        logger.info("Loading active degen monitors from database...")
        db = get_db()
        try:
            active_configs = db.query(DegenConfig).filter(
                DegenConfig.enabled == True
            ).all()

            logger.info(f"Found {len(active_configs)} enabled degen monitors")

            for config in active_configs:
                wallet_short = f"{config.wallet_address[:8]}...{config.wallet_address[-6:]}"
                logger.info(f"Scheduling degen monitor for {wallet_short} (interval: {config.check_interval_minutes} min)")
                self._schedule_monitor(config.wallet_address, config.check_interval_minutes)

                # Verify job was scheduled
                job_id = f"degen_monitor_{config.wallet_address}"
                job = self.scheduler.get_job(job_id)
                if job:
                    logger.info(f"✅ Degen monitor scheduled. Next run: {job.next_run_time}")
                else:
                    logger.error(f"❌ Failed to schedule degen monitor for {wallet_short}")

            total_jobs = len(self.scheduler.get_jobs())
            logger.info(f"Degen monitor loading complete. Total jobs: {total_jobs}")
        except Exception as e:
            logger.error(f"Error loading active degen monitors: {e}", exc_info=True)
        finally:
            db.close()

    def start_monitoring(self, wallet_address: str, threshold: float = 5.0) -> bool:
        """
        Start degen monitoring for a wallet

        Args:
            wallet_address: User's wallet address
            threshold: Min fee rate threshold (default 5%)

        Returns:
            bool: Success status
        """
        db = get_db()
        try:
            # Verify user exists and has Telegram linked
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user:
                logger.error(f"User {wallet_address} not found - must link Telegram first")
                return False

            # Get degen config
            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address
            ).first()

            if not config:
                logger.error(f"Degen config not found for {wallet_address} - must set up wallet first")
                return False

            # Update config
            config.enabled = True
            config.min_fee_rate_threshold = threshold
            config.check_interval_minutes = 1  # Always 1 minute for degen mode
            config.updated_at = datetime.utcnow()

            db.commit()

            # Schedule monitoring job
            self._schedule_monitor(wallet_address, config.check_interval_minutes)

            # Run initial check
            self._check_high_fee_pools(wallet_address)

            logger.info(f"✅ Started degen monitoring for {wallet_address} (threshold: {threshold}%)")
            return True

        except Exception as e:
            logger.error(f"Error starting degen monitoring: {e}", exc_info=True)
            db.rollback()
            return False
        finally:
            db.close()

    def stop_monitoring(self, wallet_address: str) -> bool:
        """Stop degen monitoring for a wallet"""
        db = get_db()
        try:
            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address
            ).first()

            if config:
                config.enabled = False
                config.updated_at = datetime.utcnow()
                db.commit()

            # Remove scheduled job
            job_id = f"degen_monitor_{wallet_address}"
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)

            logger.info(f"✅ Stopped degen monitoring for {wallet_address}")
            return True

        except Exception as e:
            logger.error(f"Error stopping degen monitoring: {e}", exc_info=True)
            db.rollback()
            return False
        finally:
            db.close()

    def update_threshold(self, wallet_address: str, threshold: float) -> bool:
        """Update fee rate threshold for a wallet"""
        db = get_db()
        try:
            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address
            ).first()

            if not config:
                logger.error(f"Degen config not found for {wallet_address}")
                return False

            config.min_fee_rate_threshold = threshold
            config.updated_at = datetime.utcnow()
            db.commit()

            logger.info(f"✅ Updated fee threshold to {threshold}% for {wallet_address}")
            return True

        except Exception as e:
            logger.error(f"Error updating threshold: {e}", exc_info=True)
            db.rollback()
            return False
        finally:
            db.close()

    def get_monitoring_status(self, wallet_address: str) -> dict:
        """Get degen monitoring status for a wallet"""
        db = get_db()
        try:
            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address
            ).first()

            if not config:
                return {
                    'active': False,
                    'next_run': None,
                    'threshold': None,
                    'last_check': None,
                    'wallet_address': None
                }

            job_id = f"degen_monitor_{wallet_address}"
            job = self.scheduler.get_job(job_id)

            return {
                'active': config.enabled,
                'next_run': job.next_run_time.isoformat() if job and job.next_run_time else None,
                'threshold': float(config.min_fee_rate_threshold),
                'last_check': config.last_check.isoformat() if config.last_check else None,
                'wallet_address': config.degen_wallet_address,
                'config': config.to_dict()
            }

        except Exception as e:
            logger.error(f"Error getting degen monitoring status: {e}", exc_info=True)
            return {
                'active': False,
                'next_run': None,
                'threshold': None,
                'last_check': None,
                'wallet_address': None
            }
        finally:
            db.close()

    def _schedule_monitor(self, wallet_address: str, interval_minutes: int):
        """Schedule monitoring job for a wallet"""
        job_id = f"degen_monitor_{wallet_address}"

        # Remove existing job if any
        existing = self.scheduler.get_job(job_id)
        if existing:
            logger.info(f"Removing existing degen job {job_id}")
            self.scheduler.remove_job(job_id)

        # Schedule new job
        logger.info(f"Adding degen job {job_id} with {interval_minutes} min interval")
        self.scheduler.add_job(
            func=self._check_high_fee_pools,
            trigger='interval',
            minutes=interval_minutes,
            id=job_id,
            args=[wallet_address],
            replace_existing=True
        )

        # Log the scheduled time
        job = self.scheduler.get_job(job_id)
        if job:
            logger.info(f"Job {job_id} next run: {job.next_run_time}")

    def _check_high_fee_pools(self, wallet_address: str):
        """Check for pools with high 30min fee rates"""
        db = get_db()
        try:
            logger.info(f"🔍 Checking high fee pools for {wallet_address}")

            # Get config
            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address,
                DegenConfig.enabled == True
            ).first()

            if not config:
                logger.warning(f"No active degen config found for {wallet_address}")
                return

            # Get user for Telegram chat ID
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user or not user.telegram_chat_id:
                logger.warning(f"No Telegram linked for {wallet_address}")
                return

            # Fetch all pools from cache
            pools = get_pools_from_cache()
            if not pools:
                logger.error("Failed to fetch pools from cache")
                return

            # Filter pools by fee rate threshold
            threshold = float(config.min_fee_rate_threshold)
            high_fee_pools = []

            for pool in pools:
                # Calculate fee rate (30min fees / TVL * 100)
                tvl = pool.get('tvl', 0)
                fees_30min = pool.get('fees_30min', 0)

                if tvl > 0:
                    fee_rate = (fees_30min / tvl) * 100

                    if fee_rate >= threshold:
                        high_fee_pools.append({
                            'address': pool['address'],
                            'name': pool['name'],
                            'tvl': tvl,
                            'fees_30min': fees_30min,
                            'fee_rate': round(fee_rate, 2)
                        })

            # Sort by fee rate (highest first)
            high_fee_pools.sort(key=lambda x: x['fee_rate'], reverse=True)

            # Get previously notified pools (within last 30 minutes)
            last_notified = config.last_notified_pools or {}
            current_time = datetime.utcnow()

            # Filter out pools notified in the last 30 minutes
            new_pools = []
            for pool in high_fee_pools:
                pool_address = pool['address']
                last_notified_time = last_notified.get(pool_address)

                if last_notified_time:
                    # Parse the stored timestamp
                    last_time = datetime.fromisoformat(last_notified_time)
                    time_diff = (current_time - last_time).total_seconds() / 60

                    # Only notify if more than 30 minutes have passed
                    if time_diff > 30:
                        new_pools.append(pool)
                        last_notified[pool_address] = current_time.isoformat()
                else:
                    new_pools.append(pool)
                    last_notified[pool_address] = current_time.isoformat()

            logger.info(f"Found {len(high_fee_pools)} high fee pools, {len(new_pools)} are new")

            # Send notifications for new pools (limit to top 5)
            if new_pools:
                top_pools = new_pools[:5]
                self._send_telegram_notification(user.telegram_chat_id, top_pools, threshold)

                # Update last notified pools
                config.last_notified_pools = last_notified

            # Update config with check times
            config.last_check = current_time
            config.next_check = current_time + timedelta(minutes=config.check_interval_minutes)

            db.commit()

            logger.info(f"✅ Completed degen check for {wallet_address}")

        except Exception as e:
            logger.error(f"Error checking high fee pools for {wallet_address}: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()

    def _send_telegram_notification(self, chat_id: int, pools: list, threshold: float):
        """Send Telegram notification about high fee pools"""
        try:
            if not pools:
                return

            # Build message
            message = f"🚨 <b>DEGEN ALERT</b> 🚨\n\n"
            message += f"Found {len(pools)} pool(s) with fee rate ≥ {threshold}%:\n\n"

            for i, pool in enumerate(pools[:5], 1):  # Top 5
                message += f"<b>{i}. {pool['name']}</b>\n"
                message += f"   Fee Rate: <b>{pool['fee_rate']}%</b>\n"
                message += f"   TVL: ${pool['tvl']:,.0f}\n"
                message += f"   30min Fees: ${pool['fees_30min']:,.2f}\n"
                message += f"   🔗 <a href='https://app.meteora.ag/pools/{pool['address']}'>Trade on Meteora</a>\n\n"

            message += f"⚡️ Act fast! High fee rates won't last long.\n"
            message += f"💡 Use /degen_threshold to adjust your alert threshold."

            # Send via Telegram bot
            import asyncio
            asyncio.run(telegram_bot_handler.send_notification(chat_id, message))

            logger.info(f"✅ Sent degen notification to chat {chat_id}")

        except Exception as e:
            logger.error(f"Error sending degen notification: {e}", exc_info=True)

    def shutdown(self):
        """Shutdown the scheduler"""
        try:
            self.scheduler.shutdown(wait=False)
            logger.info("✅ Degen monitoring service shut down")
        except Exception as e:
            logger.error(f"Error shutting down degen monitoring service: {e}")


# Global instance
degen_monitoring_service = DegenMonitoringService()
