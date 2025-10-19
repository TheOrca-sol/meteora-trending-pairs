"""
Capital Rotation Monitoring Service
Monitors for new opportunities and sends Telegram notifications
"""

import logging
import json
import os
import asyncio
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from telegram import Bot
from telegram.error import TelegramError
import requests

logger = logging.getLogger(__name__)

class MonitoringService:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.active_monitors = {}  # {wallet_address: monitor_config}
        self.previous_opportunities = {}  # {wallet_address: [opportunities]}
        self.data_file = 'monitoring_data.json'
        self.load_data()

    def load_data(self):
        """Load previous monitoring data from file"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'r') as f:
                    data = json.load(f)
                    self.previous_opportunities = data.get('previous_opportunities', {})
                    logger.info(f"Loaded monitoring data for {len(self.previous_opportunities)} wallets")
        except Exception as e:
            logger.error(f"Error loading monitoring data: {e}")
            self.previous_opportunities = {}

    def save_data(self):
        """Save monitoring data to file"""
        try:
            with open(self.data_file, 'w') as f:
                json.dump({
                    'previous_opportunities': self.previous_opportunities,
                    'last_updated': datetime.now().isoformat()
                }, f)
        except Exception as e:
            logger.error(f"Error saving monitoring data: {e}")

    def start_monitoring(self, wallet_address, config):
        """
        Start monitoring for a wallet
        config = {
            'telegram_chat_id': str,
            'telegram_bot_token': str,
            'interval_minutes': int,
            'threshold_multiplier': float,
            'whitelist': list,
            'quote_preferences': dict,
            'min_fees_30min': float
        }
        """
        try:
            # Remove existing job if any
            job_id = f"monitor_{wallet_address}"
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)

            # Store config
            self.active_monitors[wallet_address] = config

            # Schedule new job
            interval = config.get('interval_minutes', 15)
            self.scheduler.add_job(
                func=self._check_opportunities,
                trigger='interval',
                minutes=interval,
                id=job_id,
                args=[wallet_address],
                replace_existing=True
            )

            # Start scheduler if not running
            if not self.scheduler.running:
                self.scheduler.start()

            logger.info(f"Started monitoring for wallet {wallet_address} every {interval} minutes")

            # Run initial check
            self._check_opportunities(wallet_address)

            return True
        except Exception as e:
            logger.error(f"Error starting monitoring: {e}")
            return False

    def stop_monitoring(self, wallet_address):
        """Stop monitoring for a wallet"""
        try:
            job_id = f"monitor_{wallet_address}"
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)

            if wallet_address in self.active_monitors:
                del self.active_monitors[wallet_address]

            logger.info(f"Stopped monitoring for wallet {wallet_address}")
            return True
        except Exception as e:
            logger.error(f"Error stopping monitoring: {e}")
            return False

    def get_monitoring_status(self, wallet_address):
        """Get monitoring status for a wallet"""
        job_id = f"monitor_{wallet_address}"
        job = self.scheduler.get_job(job_id)

        if job:
            return {
                'active': True,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'interval_minutes': self.active_monitors.get(wallet_address, {}).get('interval_minutes', 15),
                'last_check': self.previous_opportunities.get(wallet_address, {}).get('last_check')
            }
        else:
            return {
                'active': False,
                'next_run': None,
                'interval_minutes': None,
                'last_check': None
            }

    def _check_opportunities(self, wallet_address):
        """Check for new opportunities (runs in background)"""
        try:
            logger.info(f"Checking opportunities for wallet {wallet_address}")

            config = self.active_monitors.get(wallet_address)
            if not config:
                logger.warning(f"No config found for wallet {wallet_address}")
                return

            # Fetch current opportunities from backend
            opportunities = self._fetch_opportunities(wallet_address, config)

            if opportunities is None:
                logger.error("Failed to fetch opportunities")
                return

            # Compare with previous opportunities
            new_opportunities = self._find_new_opportunities(wallet_address, opportunities, config)

            # Send notifications for new opportunities
            if new_opportunities:
                logger.info(f"Found {len(new_opportunities)} new opportunities")
                self._send_telegram_notifications(new_opportunities, config)
            else:
                logger.info("No new opportunities found")

            # Update stored opportunities
            self.previous_opportunities[wallet_address] = {
                'opportunities': opportunities,
                'last_check': datetime.now().isoformat()
            }
            self.save_data()

        except Exception as e:
            logger.error(f"Error checking opportunities: {e}", exc_info=True)

    def _fetch_opportunities(self, wallet_address, config):
        """Fetch opportunities from backend"""
        try:
            # First fetch positions
            positions_response = requests.post(
                'http://localhost:5000/api/wallet/positions',
                json={
                    'walletAddress': wallet_address,
                    'whitelist': config.get('whitelist', []),
                    'quotePreferences': config.get('quote_preferences', {'sol': True, 'usdc': True})
                },
                timeout=30
            )

            if positions_response.status_code != 200:
                logger.error(f"Failed to fetch positions: {positions_response.status_code}")
                return None

            positions = positions_response.json().get('positions', [])

            # Then fetch opportunities
            opportunities_response = requests.post(
                'http://localhost:5000/api/opportunities/analyze',
                json={
                    'walletAddress': wallet_address,
                    'whitelist': config.get('whitelist', []),
                    'quotePreferences': config.get('quote_preferences', {'sol': True, 'usdc': True}),
                    'currentPositions': positions,
                    'minFees30min': config.get('min_fees_30min', 100)
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

    def _find_new_opportunities(self, wallet_address, current_opportunities, config):
        """Find new opportunities that weren't there before"""
        threshold = config.get('threshold_multiplier', 1.3)

        # Get previous opportunities
        previous = self.previous_opportunities.get(wallet_address, {}).get('opportunities', [])
        previous_addresses = {opp['address'] for opp in previous}

        # Find opportunities that are new or significantly better
        new_opps = []
        for opp in current_opportunities:
            # Check if this is a completely new pool
            if opp['address'] not in previous_addresses:
                new_opps.append({
                    **opp,
                    'reason': 'New pool discovered'
                })
                continue

            # Check if existing pool got significantly better
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

    def _send_telegram_notifications(self, opportunities, config):
        """Send Telegram notifications for new opportunities"""
        try:
            bot_token = config.get('telegram_bot_token')
            chat_id = config.get('telegram_chat_id')

            if not bot_token or not chat_id:
                logger.warning("Missing Telegram credentials")
                return

            # Create event loop for async telegram bot
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                for opp in opportunities[:5]:  # Limit to 5 notifications per check
                    message = self._format_opportunity_message(opp)
                    loop.run_until_complete(self._send_message(bot_token, chat_id, message))
            finally:
                loop.close()

        except Exception as e:
            logger.error(f"Error sending Telegram notifications: {e}", exc_info=True)

    async def _send_message(self, bot_token, chat_id, message):
        """Send a single Telegram message"""
        try:
            bot = Bot(token=bot_token)
            await bot.send_message(
                chat_id=chat_id,
                text=message,
                parse_mode='HTML',
                disable_web_page_preview=True
            )
            logger.info(f"Sent Telegram notification to {chat_id}")
        except TelegramError as e:
            logger.error(f"Telegram error: {e}")
        except Exception as e:
            logger.error(f"Error sending message: {e}")

    def _format_opportunity_message(self, opp):
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
