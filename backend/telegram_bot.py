"""
Telegram Bot Handler for Capital Rotation Monitoring
Handles user authentication and commands
"""

import os
import logging
from datetime import datetime
from telegram import Update, Bot
from telegram.ext import Application, CommandHandler, ContextTypes
from telegram.error import TelegramError
from dotenv import load_dotenv
from models import get_db, User, TelegramAuthCode, MonitoringConfig

load_dotenv()

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME')

if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is not set")


class TelegramBotHandler:
    def __init__(self):
        self.application = None
        self.bot = Bot(token=TELEGRAM_BOT_TOKEN)
        self.running = False

    def initialize(self):
        """Initialize the bot application"""
        self.application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

        # Register command handlers
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        self.application.add_handler(CommandHandler("stop", self.stop_command))
        self.application.add_handler(CommandHandler("help", self.help_command))

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
            "Available Commands:\n\n"
            "/start CODE - Link your wallet using auth code\n"
            "/status - Check your monitoring status\n"
            "/stop - Unlink your wallet and stop monitoring\n"
            "/help - Show this help message\n\n"
            "💡 How it works:\n"
            "1. Generate an auth code in the web app\n"
            "2. Link your Telegram using /start CODE\n"
            "3. Configure monitoring settings in the web app\n"
            "4. Receive notifications about new opportunities!\n\n"
            "For more info, visit the Capital Rotation page."
        )

        await update.message.reply_text(help_text)

    def start_polling(self):
        """Start the bot with polling (for background thread)"""
        import asyncio
        import signal

        if not self.application:
            self.initialize()

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
