"""
Liquidity Position Automation Monitoring Service
Monitors active liquidity positions and triggers automation actions:
- Take Profit / Stop Loss
- Auto-compound fees
- Rebalancing
"""

import logging
import os
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from sqlalchemy import and_
from models import (
    get_db,
    LiquidityPosition,
    PositionAutomationRules,
    AutomationConfig,
    LiquidityTransaction
)
from telegram_bot import telegram_bot_handler
import asyncio

logger = logging.getLogger(__name__)


class LiquidityMonitoringService:
    def __init__(self):
        # Configure scheduler
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
        logger.info("Liquidity Monitoring Service initialized")

        # Schedule main monitoring job (runs every 5 minutes)
        self.scheduler.add_job(
            func=self._monitor_all_positions,
            trigger='interval',
            minutes=5,
            id='monitor_liquidity_positions',
            replace_existing=True
        )
        logger.info("Scheduled liquidity position monitoring (every 5 minutes)")

        # Schedule compound job (runs every hour to check compound schedules)
        self.scheduler.add_job(
            func=self._check_compound_schedules,
            trigger='interval',
            hours=1,
            id='check_compound_schedules',
            replace_existing=True
        )
        logger.info("Scheduled compound checking (every hour)")

    def _monitor_all_positions(self):
        """Monitor all active positions for automation triggers"""
        db = get_db()
        try:
            logger.info("Starting position monitoring cycle...")

            # Get all active positions
            active_positions = db.query(LiquidityPosition).filter(
                LiquidityPosition.status == 'active'
            ).all()

            logger.info(f"Monitoring {len(active_positions)} active positions")

            for position in active_positions:
                try:
                    self._check_position(position, db)
                except Exception as e:
                    logger.error(f"Error checking position {position.position_address}: {e}", exc_info=True)

            logger.info("Position monitoring cycle completed")

        except Exception as e:
            logger.error(f"Error in monitoring cycle: {e}", exc_info=True)
        finally:
            db.close()

    def _check_position(self, position: LiquidityPosition, db):
        """Check a single position for automation triggers"""

        # Get automation rules
        rules = db.query(PositionAutomationRules).filter(
            PositionAutomationRules.position_address == position.position_address
        ).first()

        if not rules:
            return  # No automation rules set

        # Get automation config for global settings
        config = db.query(AutomationConfig).filter(
            AutomationConfig.wallet_address == position.wallet_address
        ).first()

        # Check if automation is globally disabled
        if config and not config.automation_enabled:
            return

        # Update position data from blockchain
        position_data = self._fetch_position_data(position)
        if not position_data:
            logger.warning(f"Could not fetch data for position {position.position_address}")
            return

        # Update position in database
        position.current_amount_x = position_data.get('amountX', position.current_amount_x)
        position.current_amount_y = position_data.get('amountY', position.current_amount_y)
        position.current_value_usd = position_data.get('valueUSD', position.current_value_usd)
        position.fees_earned_usd = position_data.get('feesUSD', position.fees_earned_usd)
        position.total_profit_usd = position_data.get('profitUSD', position.total_profit_usd)

        # Calculate profit percentage
        initial_value = position.liquidity_usd
        current_value = position.current_value_usd or initial_value
        fees = position.fees_earned_usd or 0
        total_value = current_value + fees
        profit_percentage = ((total_value - initial_value) / initial_value * 100) if initial_value > 0 else 0

        position.profit_percentage = profit_percentage
        position.last_monitored = datetime.utcnow()

        db.commit()

        logger.info(f"Position {position.position_address[:8]}... P&L: {profit_percentage:.2f}%")

        # Check Take Profit
        if rules.take_profit_enabled:
            if rules.take_profit_type == 'percentage':
                if profit_percentage >= rules.take_profit_value:
                    logger.info(f"🎯 Take profit triggered for {position.position_address[:8]}... ({profit_percentage:.2f}% >= {rules.take_profit_value}%)")
                    self._execute_take_profit(position, db)
                    return  # Position closed, no need to check other rules

        # Check Stop Loss
        if rules.stop_loss_enabled:
            if rules.stop_loss_type == 'percentage':
                if profit_percentage <= rules.stop_loss_value:
                    logger.info(f"🛑 Stop loss triggered for {position.position_address[:8]}... ({profit_percentage:.2f}% <= {rules.stop_loss_value}%)")
                    self._execute_stop_loss(position, db)
                    return  # Position closed

        # Check Rebalancing triggers
        if rules.rebalancing_enabled and rules.rebalance_triggers:
            if self._check_rebalance_triggers(position, position_data, rules.rebalance_triggers):
                logger.info(f"⚖️ Rebalancing triggered for {position.position_address[:8]}...")
                self._execute_rebalance(position, db)

    def _check_compound_schedules(self):
        """Check which positions are due for compounding"""
        db = get_db()
        try:
            logger.info("Checking compound schedules...")

            # Get positions with auto-compound enabled
            positions = db.query(LiquidityPosition, PositionAutomationRules).join(
                PositionAutomationRules,
                LiquidityPosition.position_address == PositionAutomationRules.position_address
            ).filter(
                and_(
                    LiquidityPosition.status == 'active',
                    PositionAutomationRules.auto_compound_enabled == True
                )
            ).all()

            for position, rules in positions:
                # Check if compound is due
                last_compound = position.last_compound_at or position.opened_at
                hours_since_compound = (datetime.utcnow() - last_compound).total_seconds() / 3600

                if hours_since_compound >= rules.compound_frequency_hours:
                    # Check if fees meet minimum threshold
                    fees_usd = position.fees_earned_usd or 0
                    min_threshold = rules.compound_min_threshold_usd or 10.0

                    if fees_usd >= min_threshold:
                        logger.info(f"💰 Compound triggered for {position.position_address[:8]}... (${fees_usd:.2f} fees, {hours_since_compound:.1f}h since last)")
                        self._execute_compound(position, db)
                    else:
                        logger.info(f"Compound skipped for {position.position_address[:8]}... (fees ${fees_usd:.2f} < ${min_threshold:.2f} threshold)")

        except Exception as e:
            logger.error(f"Error checking compound schedules: {e}", exc_info=True)
        finally:
            db.close()

    def _fetch_position_data(self, position: LiquidityPosition) -> dict:
        """
        Fetch current position data from blockchain using Meteora microservice
        """
        try:
            from meteora_sdk_http import meteora_sdk_http

            logger.debug(f"Fetching position data for {position.position_address}")

            # Fetch position data from microservice
            position_data = meteora_sdk_http.get_position_data(
                position.position_address,
                position.pool_address
            )

            if not position_data:
                logger.warning(f"Could not fetch blockchain data for {position.position_address}")
                return None

            return position_data

        except Exception as e:
            logger.error(f"Error fetching position data: {e}", exc_info=True)
            return None

    def _check_rebalance_triggers(self, position: LiquidityPosition, position_data: dict, triggers: list) -> bool:
        """Check if any rebalance trigger conditions are met"""
        for trigger in triggers:
            trigger_type = trigger.get('type')
            trigger_value = trigger.get('value')

            if trigger_type == 'price_drift':
                # Check if price drifted X% from range center
                # TODO: Implement price drift calculation
                pass

            elif trigger_type == 'imbalance_change':
                # Check if token ratio changed significantly
                # TODO: Implement imbalance detection
                pass

            elif trigger_type == 'fee_threshold':
                # Check if accumulated fees exceed threshold
                fees_usd = position.fees_earned_usd or 0
                if fees_usd >= trigger_value:
                    logger.info(f"Fee threshold met: ${fees_usd:.2f} >= ${trigger_value:.2f}")
                    return True

        return False

    def _execute_take_profit(self, position: LiquidityPosition, db):
        """Execute take profit - close position"""
        logger.info(f"Executing take profit for {position.position_address}")

        # Add to execution queue (will be processed by execution service)
        self._queue_action(position, 'take_profit', db)

        # Send Telegram notification
        self._send_notification(
            position.wallet_address,
            f"🎯 <b>Take Profit Triggered</b>\n\n"
            f"Position: {position.token_x_symbol}/{position.token_y_symbol}\n"
            f"Profit: {position.profit_percentage:.2f}%\n"
            f"Position queued for closure.\n\n"
            f"<a href='https://solscan.io/account/{position.position_address}'>View Position</a>",
            db
        )

    def _execute_stop_loss(self, position: LiquidityPosition, db):
        """Execute stop loss - close position"""
        logger.info(f"Executing stop loss for {position.position_address}")

        # Add to execution queue
        self._queue_action(position, 'stop_loss', db)

        # Send Telegram notification
        self._send_notification(
            position.wallet_address,
            f"🛑 <b>Stop Loss Triggered</b>\n\n"
            f"Position: {position.token_x_symbol}/{position.token_y_symbol}\n"
            f"Loss: {position.profit_percentage:.2f}%\n"
            f"Position queued for closure.\n\n"
            f"<a href='https://solscan.io/account/{position.position_address}'>View Position</a>",
            db
        )

    def _execute_compound(self, position: LiquidityPosition, db):
        """Execute auto-compound - claim and reinvest fees"""
        logger.info(f"Executing compound for {position.position_address}")

        # Add to execution queue
        self._queue_action(position, 'compound', db)

        # Update last compound time
        position.last_compound_at = datetime.utcnow()
        db.commit()

        # Send Telegram notification
        self._send_notification(
            position.wallet_address,
            f"💰 <b>Auto-Compound Executing</b>\n\n"
            f"Position: {position.token_x_symbol}/{position.token_y_symbol}\n"
            f"Fees: ${position.fees_earned_usd:.2f}\n"
            f"Reinvesting fees...\n\n"
            f"<a href='https://solscan.io/account/{position.position_address}'>View Position</a>",
            db
        )

    def _execute_rebalance(self, position: LiquidityPosition, db):
        """Execute rebalancing - adjust position range"""
        logger.info(f"Executing rebalance for {position.position_address}")

        # Add to execution queue
        self._queue_action(position, 'rebalance', db)

        # Send Telegram notification
        self._send_notification(
            position.wallet_address,
            f"⚖️ <b>Rebalancing Position</b>\n\n"
            f"Position: {position.token_x_symbol}/{position.token_y_symbol}\n"
            f"Adjusting liquidity range...\n\n"
            f"<a href='https://solscan.io/account/{position.position_address}'>View Position</a>",
            db
        )

    def _queue_action(self, position: LiquidityPosition, action_type: str, db):
        """
        Queue an automation action for execution
        This creates a pending transaction that will be picked up by the execution service
        """
        try:
            # Add to position_monitoring_queue
            from sqlalchemy import text
            db.execute(text("""
                INSERT INTO position_monitoring_queue (position_address, action_type, status, created_at)
                VALUES (:position_address, :action_type, 'pending', NOW())
                ON CONFLICT (position_address)
                DO UPDATE SET action_type = :action_type, status = 'pending', created_at = NOW()
            """), {
                'position_address': position.position_address,
                'action_type': action_type
            })
            db.commit()
            logger.info(f"Queued {action_type} action for {position.position_address}")

        except Exception as e:
            logger.error(f"Error queueing action: {e}")
            db.rollback()

    def _send_notification(self, wallet_address: str, message: str, db):
        """Send Telegram notification to user"""
        try:
            from models import User
            user = db.query(User).filter(User.wallet_address == wallet_address).first()

            if not user or not user.telegram_chat_id:
                logger.warning(f"No Telegram linked for {wallet_address}")
                return

            # Send async notification
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(
                    telegram_bot_handler.send_notification(user.telegram_chat_id, message)
                )
            finally:
                loop.close()

        except Exception as e:
            logger.error(f"Error sending notification: {e}", exc_info=True)

    def shutdown(self):
        """Shutdown the scheduler"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown()
            logger.info("Liquidity Monitoring Service shutdown")
        except Exception as e:
            logger.error(f"Error shutting down service: {e}")


# Global instance
liquidity_monitoring_service = LiquidityMonitoringService()
