"""
Telegram Bot Handler for Capital Rotation Monitoring
Handles user authentication and commands
"""

import os
import logging
import fcntl
from datetime import datetime
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, ContextTypes
from telegram.error import TelegramError
from telegram.request import HTTPXRequest
from dotenv import load_dotenv
from models import get_db, User, TelegramAuthCode, MonitoringConfig, DegenConfig

load_dotenv()

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME')

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set")


class TelegramBotHandler:
    def __init__(self):
        self.application = None
        # Configure HTTPXRequest with larger connection pool to handle multiple simultaneous notifications
        # Default pool size is typically 10, increasing to 50 to handle bursts of notifications
        # This prevents "Pool timeout: All connections in the connection pool are occupied" errors
        request = HTTPXRequest(
            connection_pool_size=50,  # Maximum number of connections in the pool
            connect_timeout=10.0,     # Connection timeout in seconds
            read_timeout=10.0,        # Read timeout in seconds
            write_timeout=10.0,       # Write timeout in seconds
            pool_timeout=10.0         # Pool timeout in seconds
        )
        self.bot = Bot(token=TELEGRAM_BOT_TOKEN, request=request)
        self.running = False

    def initialize(self):
        """Initialize the bot application"""
        # Use the same HTTPXRequest configuration for the Application
        # to ensure consistent connection pool settings across all bot operations
        request = HTTPXRequest(
            connection_pool_size=50,
            connect_timeout=10.0,
            read_timeout=10.0,
            write_timeout=10.0,
            pool_timeout=10.0
        )
        self.application = Application.builder().token(TELEGRAM_BOT_TOKEN).request(request).build()

        # Register command handlers
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        self.application.add_handler(CommandHandler("stop", self.stop_command))
        self.application.add_handler(CommandHandler("help", self.help_command))

        # Degen mode command handlers
        self.application.add_handler(CommandHandler("degen_status", self.degen_status_command))
        self.application.add_handler(CommandHandler("degen_stop", self.degen_stop_command))
        self.application.add_handler(CommandHandler("degen_threshold", self.degen_threshold_command))

        logger.info("Telegram bot initialized")

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command - used for authentication"""
        chat_id = update.effective_chat.id
        username = update.effective_user.username

        # Check if user sent an auth code
        if context.args and len(context.args) > 0:
            auth_code = context.args[0].upper()

            # Verify auth code
            db = get_db()
            try:
                code_entry = db.query(TelegramAuthCode).filter(
                    TelegramAuthCode.code == auth_code,
                    TelegramAuthCode.used == False,
                    TelegramAuthCode.expires_at > datetime.utcnow()
                ).first()

                if not code_entry:
                    await update.message.reply_text(
                        "❌ Invalid or expired authentication code.\n\n"
                        "Please generate a new code from the web app and try again."
                    )
                    return

                # Check if this chat is already linked to another wallet
                existing_user = db.query(User).filter(User.telegram_chat_id == chat_id).first()
                if existing_user and existing_user.wallet_address != code_entry.wallet_address:
                    await update.message.reply_text(
                        f"⚠️ This Telegram account is already linked to wallet:\n"
                        f"`{existing_user.wallet_address[:8]}...{existing_user.wallet_address[-6:]}`\n\n"
                        f"Please use /stop to unlink first, then try again."
                    )
                    return

                # Create or update user
                user = db.query(User).filter(User.wallet_address == code_entry.wallet_address).first()
                if user:
                    # Update existing user
                    user.telegram_chat_id = chat_id
                    user.telegram_username = username
                    user.updated_at = datetime.utcnow()
                else:
                    # Create new user
                    user = User(
                        wallet_address=code_entry.wallet_address,
                        telegram_chat_id=chat_id,
                        telegram_username=username
                    )
                    db.add(user)

                    # Create monitoring config for new user
                    config = MonitoringConfig(
                        wallet_address=code_entry.wallet_address
                    )
                    db.add(config)

                # Mark code as used
                code_entry.used = True

                db.commit()

                wallet_short = f"{code_entry.wallet_address[:8]}...{code_entry.wallet_address[-6:]}"
                await update.message.reply_text(
                    f"✅ Successfully linked!\n\n"
                    f"📱 Telegram: @{username or 'Unknown'}\n"
                    f"💰 Wallet: `{wallet_short}`\n\n"
                    f"You can now enable monitoring in the web app to receive notifications about new capital rotation opportunities.\n\n"
                    f"Use /status to check your monitoring status.\n"
                    f"Use /help to see all available commands."
                )

                logger.info(f"User {wallet_short} successfully linked to chat {chat_id}")

            except Exception as e:
                logger.error(f"Error in start command: {e}")
                await update.message.reply_text(
                    "❌ An error occurred while linking your account. Please try again."
                )
                db.rollback()
            finally:
                db.close()
        else:
            # No auth code provided
            await update.message.reply_text(
                f"👋 Welcome to Meteora Capital Rotation Bot!\n\n"
                f"To get started:\n"
                f"1. Open the Capital Rotation page in the web app\n"
                f"2. Click 'Connect Telegram' to generate an auth code\n"
                f"3. Click the link or use: `/start YOUR_CODE`\n\n"
                f"Use /help to see all available commands."
            )

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command - show monitoring status"""
        chat_id = update.effective_chat.id

        db = get_db()
        try:
            user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

            if not user:
                await update.message.reply_text(
                    "❌ You haven't linked your wallet yet.\n\n"
                    "Use /start with an auth code from the web app to get started."
                )
                return

            config = db.query(MonitoringConfig).filter(
                MonitoringConfig.wallet_address == user.wallet_address
            ).first()

            wallet_short = f"{user.wallet_address[:8]}...{user.wallet_address[-6:]}"

            if config and config.enabled:
                status_msg = (
                    f"✅ Monitoring Active\n\n"
                    f"💰 Wallet: `{wallet_short}`\n"
                    f"⏱ Check Interval: Every {config.interval_minutes} minutes\n"
                    f"📊 Notification Threshold: {float(config.threshold_multiplier)}x\n"
                    f"💵 Min 30min Fees: ${float(config.min_fees_30min)}\n"
                )

                if config.last_check:
                    last_check = config.last_check.strftime("%Y-%m-%d %H:%M UTC")
                    status_msg += f"🕐 Last Check: {last_check}\n"

                if config.next_check:
                    next_check = config.next_check.strftime("%Y-%m-%d %H:%M UTC")
                    status_msg += f"🕐 Next Check: {next_check}\n"

                status_msg += "\nYou'll receive notifications when new opportunities are found!"
            else:
                status_msg = (
                    f"⏸ Monitoring Inactive\n\n"
                    f"💰 Wallet: `{wallet_short}`\n\n"
                    f"Enable monitoring in the web app to start receiving notifications."
                )

            await update.message.reply_text(status_msg)

        except Exception as e:
            logger.error(f"Error in status command: {e}")
            await update.message.reply_text("❌ An error occurred. Please try again.")
        finally:
            db.close()

    async def stop_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /stop command - unlink Telegram account"""
        chat_id = update.effective_chat.id

        db = get_db()
        try:
            user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

            if not user:
                await update.message.reply_text(
                    "You don't have a linked wallet."
                )
                return

            wallet_short = f"{user.wallet_address[:8]}...{user.wallet_address[-6:]}"

            # Delete user (cascade will delete monitoring config and snapshots)
            db.delete(user)
            db.commit()

            await update.message.reply_text(
                f"✅ Successfully unlinked wallet `{wallet_short}`.\n\n"
                f"Your monitoring has been stopped and all data has been removed.\n\n"
                f"You can link a new wallet anytime using /start with an auth code."
            )

            logger.info(f"User {wallet_short} unlinked from chat {chat_id}")

        except Exception as e:
            logger.error(f"Error in stop command: {e}")
            await update.message.reply_text("❌ An error occurred. Please try again.")
            db.rollback()
        finally:
            db.close()

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command - show available commands"""
        help_text = (
            "🤖 Meteora Capital Rotation Bot\n\n"
            "📊 Capital Rotation Commands:\n"
            "/start CODE - Link your wallet using auth code\n"
            "/status - Check your monitoring status\n"
            "/stop - Unlink your wallet and stop monitoring\n\n"
            "🚀 Degen Mode Commands:\n"
            "/degen_status - Check degen mode status\n"
            "/degen_threshold X - Set fee rate threshold (%)\n"
            "/degen_stop - Stop degen mode monitoring\n\n"
            "/help - Show this help message\n\n"
            "💡 How it works:\n"
            "1. Generate an auth code in the web app\n"
            "2. Link your Telegram using /start CODE\n"
            "3. Configure monitoring settings in the web app\n"
            "4. Receive notifications about new opportunities!\n\n"
            "For more info, visit the Capital Rotation page."
        )

        await update.message.reply_text(help_text)

    async def degen_status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /degen_status command - show degen mode status"""
        chat_id = update.effective_chat.id

        db = get_db()
        try:
            user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

            if not user:
                await update.message.reply_text(
                    "❌ You haven't linked your wallet yet.\n\n"
                    "Use /start with an auth code from the web app to get started."
                )
                return

            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == user.wallet_address
            ).first()

            if not config:
                await update.message.reply_text(
                    "⏸ Degen Mode Not Set Up\n\n"
                    f"💰 Wallet: `{user.wallet_address[:8]}...{user.wallet_address[-6:]}`\n\n"
                    "Set up degen mode in the web app to start monitoring high fee rate pools!"
                )
                return

            degen_wallet_short = f"{config.degen_wallet_address[:8]}...{config.degen_wallet_address[-6:]}"

            if config.enabled:
                status_msg = (
                    f"🚀 Degen Mode Active\n\n"
                    f"💰 Main Wallet: `{user.wallet_address[:8]}...{user.wallet_address[-6:]}`\n"
                    f"🎯 Degen Wallet: `{degen_wallet_short}`\n"
                    f"📊 Fee Rate Threshold: {float(config.min_fee_rate_threshold)}%\n"
                    f"⏱ Check Interval: Every {config.check_interval_minutes} minute(s)\n"
                )

                if config.last_check:
                    last_check = config.last_check.strftime("%Y-%m-%d %H:%M UTC")
                    status_msg += f"🕐 Last Check: {last_check}\n"

                if config.next_check:
                    next_check = config.next_check.strftime("%Y-%m-%d %H:%M UTC")
                    status_msg += f"🕐 Next Check: {next_check}\n"

                status_msg += "\nYou'll receive notifications when high fee rate pools are found!"
            else:
                status_msg = (
                    f"⏸ Degen Mode Inactive\n\n"
                    f"💰 Main Wallet: `{user.wallet_address[:8]}...{user.wallet_address[-6:]}`\n"
                    f"🎯 Degen Wallet: `{degen_wallet_short}`\n\n"
                    f"Enable degen mode in the web app to start receiving notifications."
                )

            await update.message.reply_text(status_msg)

        except Exception as e:
            logger.error(f"Error in degen_status command: {e}")
            await update.message.reply_text("❌ An error occurred. Please try again.")
        finally:
            db.close()

    async def degen_stop_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /degen_stop command - stop degen mode monitoring"""
        chat_id = update.effective_chat.id

        db = get_db()
        try:
            user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

            if not user:
                await update.message.reply_text("❌ You haven't linked your wallet yet.")
                return

            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == user.wallet_address
            ).first()

            if not config:
                await update.message.reply_text("You don't have degen mode set up.")
                return

            if not config.enabled:
                await update.message.reply_text("Degen mode is already stopped.")
                return

            # Stop monitoring via the monitoring service
            try:
                from services.monitoring.degen_monitoring import degen_monitoring_service
                degen_monitoring_service.stop_monitoring(user.wallet_address)
            except Exception as e:
                logger.error(f"Error stopping degen monitoring service: {e}")

            await update.message.reply_text(
                f"✅ Degen mode monitoring stopped.\n\n"
                f"You can restart it anytime from the web app."
            )

            logger.info(f"Degen mode stopped for {user.wallet_address} via Telegram")

        except Exception as e:
            logger.error(f"Error in degen_stop command: {e}")
            await update.message.reply_text("❌ An error occurred. Please try again.")
        finally:
            db.close()

    async def degen_threshold_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /degen_threshold command - set fee rate threshold"""
        chat_id = update.effective_chat.id

        db = get_db()
        try:
            user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

            if not user:
                await update.message.reply_text(
                    "❌ You haven't linked your wallet yet.\n\n"
                    "Use /start with an auth code from the web app to get started."
                )
                return

            config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == user.wallet_address
            ).first()

            if not config:
                await update.message.reply_text(
                    "❌ Degen mode not set up.\n\n"
                    "Set up degen mode in the web app first."
                )
                return

            # Check if threshold value was provided
            if not context.args or len(context.args) == 0:
                await update.message.reply_text(
                    f"Current fee rate threshold: {float(config.min_fee_rate_threshold)}%\n\n"
                    f"Usage: /degen_threshold <percentage>\n"
                    f"Example: /degen_threshold 5"
                )
                return

            # Parse threshold value
            try:
                new_threshold = float(context.args[0])
                if new_threshold <= 0 or new_threshold > 100:
                    await update.message.reply_text("❌ Threshold must be between 0.1 and 100%.")
                    return
            except ValueError:
                await update.message.reply_text(
                    "❌ Invalid threshold value. Please provide a number.\n"
                    "Example: /degen_threshold 5"
                )
                return

            # Update threshold
            config.min_fee_rate_threshold = new_threshold
            config.updated_at = datetime.utcnow()
            db.commit()

            await update.message.reply_text(
                f"✅ Fee rate threshold updated to {new_threshold}%\n\n"
                f"You'll now receive alerts for pools with fee rates ≥ {new_threshold}%."
            )

            logger.info(f"Degen threshold updated to {new_threshold}% for {user.wallet_address} via Telegram")

        except Exception as e:
            logger.error(f"Error in degen_threshold command: {e}")
            await update.message.reply_text("❌ An error occurred. Please try again.")
            db.rollback()
        finally:
            db.close()

    def start_polling(self):
        """Start the bot with polling (for background thread)"""
        import asyncio
        import signal

        if not self.application:
            self.initialize()

        # Try to acquire file lock to ensure only ONE instance polls
        # This prevents "Conflict: terminated by other getUpdates request" errors
        lock_file_path = '/tmp/telegram_bot_polling.lock'
        try:
            lock_file = open(lock_file_path, 'w')
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            logger.info("✅ Acquired polling lock - this instance will handle Telegram updates")
        except (IOError, OSError) as e:
            logger.warning(f"⚠️ Could not acquire polling lock - another instance is already polling. This is normal in multi-instance deployments.")
            logger.warning(f"   This instance will only send notifications, not handle bot commands.")
            return  # Exit without starting polling

        logger.info("Starting Telegram bot polling...")

        # Create new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def run():
            """Run the bot"""
            try:
                # Initialize and start the application
                await self.application.initialize()
                await self.application.start()

                # Start polling (this is non-blocking)
                await self.application.updater.start_polling(
                    allowed_updates=Update.ALL_TYPES,
                    drop_pending_updates=True
                )

                logger.info("Telegram bot is now polling for updates")

                # Keep the loop running
                self.running = True
                while self.running:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Error in bot polling: {e}", exc_info=True)
            finally:
                # Cleanup
                logger.info("Stopping Telegram bot...")
                await self.application.updater.stop()
                await self.application.stop()
                await self.application.shutdown()

        try:
            loop.run_until_complete(run())
        except KeyboardInterrupt:
            logger.info("Telegram bot interrupted")
        except Exception as e:
            logger.error(f"Error in polling: {e}", exc_info=True)
        finally:
            loop.close()

    def stop_polling(self):
        """Stop the bot polling"""
        self.running = False

    async def send_notification(self, chat_id: int, message: str):
        """Send a notification message to a user"""
        try:
            await self.bot.send_message(
                chat_id=chat_id,
                text=message,
                parse_mode='HTML',
                disable_web_page_preview=True
            )
            logger.info(f"Sent notification to chat {chat_id}")
            return True
        except TelegramError as e:
            logger.error(f"Telegram error sending to {chat_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending notification to {chat_id}: {e}")
            return False


# Global instance
telegram_bot_handler = TelegramBotHandler()


def get_bot_link(auth_code: str) -> str:
    """Generate a Telegram bot link with auth code"""
    return f"https://t.me/{TELEGRAM_BOT_USERNAME}?start={auth_code}"
