"""
Capital Rotation Monitoring Service (Database-backed)
Monitors for new opportunities and sends Telegram notifications
"""

import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
import requests
from models import get_db, User, MonitoringConfig, OpportunitySnapshot, cleanup_old_snapshots
from telegram_bot import telegram_bot_handler

logger = logging.getLogger(__name__)


class MonitoringService:
    def __init__(self):
        # Configure scheduler with proper logging
        from apscheduler.executors.pool import ThreadPoolExecutor

        executors = {
            'default': ThreadPoolExecutor(10)
        }

        job_defaults = {
            'coalesce': False,
            'max_instances': 3,
            'misfire_grace_time': 300  # 5 minutes
        }

        self.scheduler = BackgroundScheduler(
            executors=executors,
            job_defaults=job_defaults
        )
        self.scheduler.start()
        logger.info("Monitoring service initialized with BackgroundScheduler")

        # Schedule database cleanup job (runs every hour)
        self.scheduler.add_job(
            func=self._cleanup_old_snapshots,
            trigger='interval',
            hours=1,
            id='cleanup_snapshots',
            replace_existing=True
        )
        logger.info("Scheduled hourly snapshot cleanup job")

    def load_active_monitors(self):
        """Load all active monitors from database and schedule them"""
        logger.info("Starting to load active monitors from database...")
        db = get_db()
        try:
            active_configs = db.query(MonitoringConfig).filter(
                MonitoringConfig.enabled == True
            ).all()

            logger.info(f"Found {len(active_configs)} enabled monitoring configs")

            for config in active_configs:
                wallet_short = f"{config.wallet_address[:8]}...{config.wallet_address[-6:]}"
                logger.info(f"Scheduling monitor for {wallet_short} (interval: {config.interval_minutes} min)")
                self._schedule_monitor(config.wallet_address, config.interval_minutes)

                # Verify job was scheduled
                job_id = f"monitor_{config.wallet_address}"
                job = self.scheduler.get_job(job_id)
                if job:
                    logger.info(f"✅ Monitor scheduled successfully. Next run: {job.next_run_time}")
                else:
                    logger.error(f"❌ Failed to schedule monitor for {wallet_short}")

            total_jobs = len(self.scheduler.get_jobs())
            logger.info(f"Monitor loading complete. Total scheduler jobs: {total_jobs}")
        except Exception as e:
            logger.error(f"Error loading active monitors: {e}", exc_info=True)
        finally:
            db.close()

    def start_monitoring(self, wallet_address: str, config_data: dict) -> bool:
        """
        Start monitoring for a wallet
        config_data = {
            'interval_minutes': int,
            'threshold_multiplier': float,
            'whitelist': list,
            'quote_preferences': dict,
            'min_fees_30min': float
        }
        """
        db = get_db()
        try:
            # Verify user exists (has linked Telegram)
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user:
                logger.error(f"User {wallet_address} not found - must link Telegram first")
                return False

            # Get or create monitoring config
            config = db.query(MonitoringConfig).filter(
                MonitoringConfig.wallet_address == wallet_address
            ).first()

            if not config:
                config = MonitoringConfig(wallet_address=wallet_address)
                db.add(config)

            # Update config
            config.enabled = True
            config.interval_minutes = config_data.get('interval_minutes', 15)
            config.threshold_multiplier = config_data.get('threshold_multiplier', 1.3)
            config.whitelist = config_data.get('whitelist', [])
            config.quote_preferences = config_data.get('quote_preferences', {'sol': True, 'usdc': True})
            config.min_fees_30min = config_data.get('min_fees_30min', 100)
            config.updated_at = datetime.utcnow()

            db.commit()

            # Schedule monitoring job
            self._schedule_monitor(wallet_address, config.interval_minutes)

            # Run initial check
            self._check_opportunities(wallet_address)

            logger.info(f"Started monitoring for {wallet_address} every {config.interval_minutes} minutes")
            return True

        except Exception as e:
            logger.error(f"Error starting monitoring: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    def stop_monitoring(self, wallet_address: str) -> bool:
        """Stop monitoring for a wallet"""
        db = get_db()
        try:
            config = db.query(MonitoringConfig).filter(
                MonitoringConfig.wallet_address == wallet_address
            ).first()

            if config:
                config.enabled = False
                config.updated_at = datetime.utcnow()
                db.commit()

            # Remove scheduled job
            job_id = f"monitor_{wallet_address}"
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)

            logger.info(f"Stopped monitoring for {wallet_address}")
            return True

        except Exception as e:
            logger.error(f"Error stopping monitoring: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    def get_monitoring_status(self, wallet_address: str) -> dict:
        """Get monitoring status for a wallet"""
        db = get_db()
        try:
            config = db.query(MonitoringConfig).filter(
                MonitoringConfig.wallet_address == wallet_address
            ).first()

            if not config:
                return {
                    'active': False,
                    'next_run': None,
                    'interval_minutes': None,
                    'last_check': None,
                    'telegram_connected': False
                }

            # Check if Telegram is connected
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            telegram_connected = user is not None

            job_id = f"monitor_{wallet_address}"
            job = self.scheduler.get_job(job_id)

            return {
                'active': config.enabled,
                'next_run': job.next_run_time.isoformat() if job and job.next_run_time else None,
                'interval_minutes': config.interval_minutes,
                'last_check': config.last_check.isoformat() if config.last_check else None,
                'telegram_connected': telegram_connected,
                'config': config.to_dict() if config else None
            }

        except Exception as e:
            logger.error(f"Error getting monitoring status: {e}")
            return {
                'active': False,
                'next_run': None,
                'interval_minutes': None,
                'last_check': None,
                'telegram_connected': False
            }
        finally:
            db.close()

    def _schedule_monitor(self, wallet_address: str, interval_minutes: int):
        """Schedule monitoring job for a wallet"""
        job_id = f"monitor_{wallet_address}"

        # Remove existing job if any
        existing = self.scheduler.get_job(job_id)
        if existing:
            logger.info(f"Removing existing job {job_id}")
            self.scheduler.remove_job(job_id)

        # Schedule new job
        # Note: Don't set next_run_time - let the interval trigger handle it
        # This ensures the job runs at proper intervals
        logger.info(f"Adding job {job_id} with {interval_minutes} min interval")
        self.scheduler.add_job(
            func=self._check_opportunities,
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

    def _check_opportunities(self, wallet_address: str):
        """Check for new opportunities (runs in background)"""
        db = get_db()
        try:
            logger.info(f"Checking opportunities for {wallet_address}")

            # Get config
            config = db.query(MonitoringConfig).filter(
                MonitoringConfig.wallet_address == wallet_address,
                MonitoringConfig.enabled == True
            ).first()

            if not config:
                logger.warning(f"No active config found for {wallet_address}")
                return

            # Fetch current opportunities
            opportunities = self._fetch_opportunities(wallet_address, config)

            if opportunities is None:
                logger.error(f"Failed to fetch opportunities for {wallet_address}")
                return

            # Get previous snapshot
            previous_snapshot = db.query(OpportunitySnapshot).filter(
                OpportunitySnapshot.wallet_address == wallet_address
            ).order_by(OpportunitySnapshot.created_at.desc()).first()

            previous_opps = previous_snapshot.opportunities if previous_snapshot else []

            # Find new opportunities
            new_opportunities = self._find_new_opportunities(
                previous_opps,
                opportunities,
                float(config.threshold_multiplier)
            )

            # Log comparison results
            logger.info(f"Opportunity comparison: {len(previous_opps)} previous, {len(opportunities)} current, {len(new_opportunities)} new/improved")

            # Send notifications
            if new_opportunities:
                logger.info(f"🔔 Found {len(new_opportunities)} new opportunities for {wallet_address} - sending notifications")
                self._send_telegram_notifications(wallet_address, new_opportunities)
            else:
                logger.info(f"No new opportunities to notify about (threshold: {float(config.threshold_multiplier)}x)")

            # Save snapshot
            snapshot = OpportunitySnapshot(
                wallet_address=wallet_address,
                opportunities=opportunities
            )
            db.add(snapshot)

            # Update config with last check time and next check time
            config.last_check = datetime.utcnow()
            config.next_check = datetime.utcnow() + timedelta(minutes=config.interval_minutes)

            db.commit()

            logger.info(f"Completed check for {wallet_address}")

        except Exception as e:
            logger.error(f"Error checking opportunities for {wallet_address}: {e}", exc_info=True)
            db.rollback()
        finally:
            db.close()

    def _fetch_opportunities(self, wallet_address: str, config: MonitoringConfig) -> list:
        """Fetch opportunities from backend"""
        try:
            # Use PORT environment variable (same as Flask app)
            port = int(os.environ.get('PORT', 5000))
            base_url = f'http://localhost:{port}'

            # Fetch positions
            positions_response = requests.post(
                f'{base_url}/api/wallet/positions',
                json={
                    'walletAddress': wallet_address,
                    'whitelist': config.whitelist,
                    'quotePreferences': config.quote_preferences
                },
                timeout=30
            )

            if positions_response.status_code != 200:
                logger.error(f"Failed to fetch positions: {positions_response.status_code}")
                return None

            positions = positions_response.json().get('positions', [])

            # Fetch opportunities
            opportunities_response = requests.post(
                f'{base_url}/api/opportunities/analyze',
                json={
                    'walletAddress': wallet_address,
                    'whitelist': config.whitelist,
                    'quotePreferences': config.quote_preferences,
                    'currentPositions': positions,
                    'minFees30min': float(config.min_fees_30min)
                },
                timeout=30
            )

            if opportunities_response.status_code != 200:
                logger.error(f"Failed to fetch opportunities: {opportunities_response.status_code}")
                return None

            return opportunities_response.json().get('opportunities', [])

        except Exception as e:
            logger.error(f"Error fetching opportunities: {e}")
            return None

    def _find_new_opportunities(self, previous: list, current: list, threshold: float) -> list:
        """Find new opportunities that weren't there before or improved significantly"""
        previous_addresses = {opp['address'] for opp in previous}

        new_opps = []
        for opp in current:
            # Check if completely new pool
            if opp['address'] not in previous_addresses:
                new_opps.append({
                    **opp,
                    'reason': 'New pool discovered'
                })
                continue

            # Check if existing pool improved significantly
            prev_opp = next((p for p in previous if p['address'] == opp['address']), None)
            if prev_opp:
                fee_rate_improved = opp['feeRate30min'] > prev_opp['feeRate30min'] * threshold
                if fee_rate_improved:
                    improvement = ((opp['feeRate30min'] / prev_opp['feeRate30min']) - 1) * 100
                    new_opps.append({
                        **opp,
                        'reason': f'Fee rate improved by {improvement:.1f}%'
                    })

        return new_opps

    def _send_telegram_notifications(self, wallet_address: str, opportunities: list):
        """Send Telegram notifications for new opportunities"""
        db = get_db()
        try:
            # Get user's Telegram chat ID
            user = db.query(User).filter(User.wallet_address == wallet_address).first()
            if not user:
                logger.warning(f"No user found for {wallet_address}")
                return

            chat_id = user.telegram_chat_id

            # Send notifications (limit to 5 per check)
            for opp in opportunities[:5]:
                message = self._format_opportunity_message(opp)
                # Use sync version by creating event loop
                import asyncio
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(
                        telegram_bot_handler.send_notification(chat_id, message)
                    )
                finally:
                    loop.close()

        except Exception as e:
            logger.error(f"Error sending notifications: {e}", exc_info=True)
        finally:
            db.close()

    def _format_opportunity_message(self, opp: dict) -> str:
        """Format opportunity as Telegram message"""
        message = f"""
🚀 <b>New Capital Rotation Opportunity!</b>

<b>Pool:</b> {opp['pairName']}
<b>Reason:</b> {opp.get('reason', 'New opportunity')}

💰 <b>Metrics:</b>
• Fee Rate (30min): {opp['feeRate30min']:.4f}%
• 30min Fees: ${opp['fees30min']:.2f}
• 30min Volume: ${opp['volume30min']:.2f}
• Liquidity: ${opp['liquidity']:.2f}

⚙️ <b>Config:</b>
• Bin Step: {opp['binStep']}
• Base Fee: {opp['baseFee']}%

<a href="https://app.meteora.ag/dlmm/{opp['address']}">View on Meteora</a>
"""
        return message.strip()

    def _cleanup_old_snapshots(self):
        """
        Clean up old opportunity snapshots (runs hourly)
        Keeps only the last 10 snapshots per user
        """
        db = get_db()
        try:
            deleted_count = cleanup_old_snapshots(db, keep_last_n=10)
            if deleted_count > 0:
                logger.info(f"🧹 Cleaned up {deleted_count} old opportunity snapshots")
        except Exception as e:
            logger.error(f"Error cleaning up snapshots: {e}", exc_info=True)
        finally:
            db.close()

    def shutdown(self):
        """Shutdown the scheduler"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown()
            logger.info("Monitoring service shutdown")
        except Exception as e:
            logger.error(f"Error shutting down monitoring service: {e}")


# Global instance
monitoring_service = MonitoringService()
