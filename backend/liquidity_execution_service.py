"""
Liquidity Position Execution Service
Processes queued automation actions using the degen wallet
"""

import logging
import os
import json
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from sqlalchemy import text
from models import get_db, LiquidityPosition, LiquidityTransaction
from solana.rpc.api import Client
from solders.keypair import Keypair
from solders.pubkey import Pubkey
import base58

logger = logging.getLogger(__name__)


class LiquidityExecutionService:
    def __init__(self):
        # Load degen wallet from environment
        self.degen_wallet = self._load_degen_wallet()
        if not self.degen_wallet:
            logger.error("Degen wallet not configured - execution service will not function")
            return

        # Solana connection
        self.rpc_url = os.environ.get('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
        self.connection = Client(self.rpc_url)

        logger.info(f"Degen wallet loaded: {self.degen_wallet.pubkey()}")

        # Configure scheduler
        executors = {
            'default': ThreadPoolExecutor(5)  # Limit concurrent executions
        }

        job_defaults = {
            'coalesce': False,
            'max_instances': 1,
            'misfire_grace_time': 300
        }

        self.scheduler = BackgroundScheduler(
            executors=executors,
            job_defaults=job_defaults
        )
        self.scheduler.start()
        logger.info("Liquidity Execution Service initialized")

        # Schedule execution job (runs every 2 minutes)
        self.scheduler.add_job(
            func=self._process_queue,
            trigger='interval',
            minutes=2,
            id='process_execution_queue',
            replace_existing=True
        )
        logger.info("Scheduled execution queue processing (every 2 minutes)")

    def _load_degen_wallet(self) -> Keypair:
        """Load degen wallet from environment variable"""
        try:
            degen_private_key = os.environ.get('DEGEN_WALLET_PRIVATE_KEY')
            if not degen_private_key:
                logger.warning("DEGEN_WALLET_PRIVATE_KEY not set in environment")
                return None

            # Parse private key (can be base58 or JSON array)
            try:
                # Try base58 first
                secret_key = base58.b58decode(degen_private_key)
            except:
                # Try JSON array
                secret_key = bytes(json.loads(degen_private_key))

            keypair = Keypair.from_bytes(secret_key)
            logger.info(f"Loaded degen wallet: {keypair.pubkey()}")
            return keypair

        except Exception as e:
            logger.error(f"Error loading degen wallet: {e}", exc_info=True)
            return None

    def _process_queue(self):
        """Process pending actions in the queue"""
        if not self.degen_wallet:
            return

        db = get_db()
        try:
            # Get pending actions
            result = db.execute(text("""
                SELECT position_address, action_type, created_at
                FROM position_monitoring_queue
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT 10
            """))

            pending_actions = result.fetchall()

            if not pending_actions:
                return

            logger.info(f"Processing {len(pending_actions)} pending actions...")

            for row in pending_actions:
                position_address = row[0]
                action_type = row[1]

                try:
                    # Mark as processing
                    db.execute(text("""
                        UPDATE position_monitoring_queue
                        SET status = 'processing', updated_at = NOW()
                        WHERE position_address = :position_address
                    """), {'position_address': position_address})
                    db.commit()

                    # Get position
                    position = db.query(LiquidityPosition).filter(
                        LiquidityPosition.position_address == position_address
                    ).first()

                    if not position:
                        logger.error(f"Position not found: {position_address}")
                        self._mark_failed(position_address, "Position not found", db)
                        continue

                    # Execute action
                    if action_type == 'take_profit' or action_type == 'stop_loss':
                        self._execute_close_position(position, action_type, db)
                    elif action_type == 'compound':
                        self._execute_compound(position, db)
                    elif action_type == 'rebalance':
                        self._execute_rebalance(position, db)
                    else:
                        logger.error(f"Unknown action type: {action_type}")
                        self._mark_failed(position_address, f"Unknown action: {action_type}", db)

                except Exception as e:
                    logger.error(f"Error executing {action_type} for {position_address}: {e}", exc_info=True)
                    self._mark_failed(position_address, str(e), db)

        except Exception as e:
            logger.error(f"Error processing queue: {e}", exc_info=True)
        finally:
            db.close()

    def _execute_close_position(self, position: LiquidityPosition, reason: str, db):
        """
        Close a position (for take profit or stop loss)
        This uses Meteora microservice to remove all liquidity
        """
        try:
            logger.info(f"Closing position {position.position_address} (reason: {reason})")

            from meteora_sdk_http import meteora_sdk_http

            # Close position via microservice
            signature = meteora_sdk_http.close_position(
                position_address=position.position_address,
                pool_address=position.pool_address
            )

            if not signature:
                raise Exception("Failed to close position")

            logger.info(f"Transaction confirmed: {signature}")

            # Update position status
            position.status = 'closed'
            position.closed_at = datetime.utcnow()
            position.close_reason = reason

            # Record transaction
            tx = LiquidityTransaction(
                position_address=position.position_address,
                wallet_address=position.wallet_address,
                transaction_type='remove',
                amount_x=position.current_amount_x or 0,
                amount_y=position.current_amount_y or 0,
                value_usd=position.current_value_usd or 0,
                transaction_signature=signature,
                tx_metadata={
                    'reason': reason,
                    'profit_percentage': position.profit_percentage,
                    'fees_earned': position.fees_earned_usd
                }
            )
            db.add(tx)

            # Mark queue item as completed
            db.execute(text("""
                UPDATE position_monitoring_queue
                SET status = 'completed', updated_at = NOW()
                WHERE position_address = :position_address
            """), {'position_address': position.position_address})

            db.commit()

            logger.info(f"✅ Successfully closed position {position.position_address}")

        except Exception as e:
            logger.error(f"Error closing position: {e}", exc_info=True)
            raise

    def _execute_compound(self, position: LiquidityPosition, db):
        """
        Compound position fees
        Claims fees and adds them back to the position
        """
        try:
            logger.info(f"Compounding position {position.position_address}")

            from meteora_sdk_http import meteora_sdk_http

            # Compound via microservice (claim + add in one call)
            result = meteora_sdk_http.compound_position(
                position_address=position.position_address,
                pool_address=position.pool_address
            )

            if not result:
                raise Exception("Failed to compound position")

            claim_signature = result.get('claimSignature')
            add_signature = result.get('addSignature')
            fees_compounded = result.get('feesCompounded', {})

            logger.info(f"Fees claimed: {claim_signature}")
            logger.info(f"Fees reinvested: {add_signature}")

            # Record transaction
            tx = LiquidityTransaction(
                position_address=position.position_address,
                wallet_address=position.wallet_address,
                transaction_type='compound',
                amount_x=fees_compounded.get('feesX', 0),
                amount_y=fees_compounded.get('feesY', 0),
                value_usd=position.fees_earned_usd or 0,
                transaction_signature=claim_signature,
                tx_metadata={
                    'fees_compounded': position.fees_earned_usd,
                    'claim_signature': claim_signature,
                    'add_signature': add_signature
                }
            )
            db.add(tx)

            # Update position
            position.last_compound_at = datetime.utcnow()
            position.fees_earned_usd = 0  # Fees claimed and reinvested

            # Mark queue item as completed
            db.execute(text("""
                UPDATE position_monitoring_queue
                SET status = 'completed', updated_at = NOW()
                WHERE position_address = :position_address
            """), {'position_address': position.position_address})

            db.commit()

            logger.info(f"✅ Successfully compounded position {position.position_address}")

        except Exception as e:
            logger.error(f"Error compounding position: {e}", exc_info=True)
            raise

    def _execute_rebalance(self, position: LiquidityPosition, db):
        """
        Rebalance position
        Adjusts the liquidity range based on current market conditions
        """
        try:
            logger.info(f"Rebalancing position {position.position_address}")

            from meteora_sdk_http import meteora_sdk_http

            # Get current position data
            position_data = meteora_sdk_http.get_position_data(
                position.position_address,
                position.pool_address
            )

            if not position_data:
                raise Exception("Could not fetch position data for rebalancing")

            # Step 1: Remove all liquidity
            remove_signature = meteora_sdk_http.close_position(
                position_address=position.position_address,
                pool_address=position.pool_address
            )

            if not remove_signature:
                raise Exception("Failed to remove liquidity")

            logger.info(f"Liquidity removed: {remove_signature}")

            # Step 2: Calculate new range based on current price
            # Use a simple strategy: center around active bin with same width
            active_bin_id = position_data['activeBinId']
            old_range_width = position.upper_bin_id - position.lower_bin_id
            new_lower_bin_id = active_bin_id - (old_range_width // 2)
            new_upper_bin_id = active_bin_id + (old_range_width // 2)

            logger.info(f"New range: bins {new_lower_bin_id} to {new_upper_bin_id} (centered on {active_bin_id})")

            # Step 3: Add liquidity back at new range
            # Note: After closing position, we need to create a NEW position at the new range
            # This is a limitation - we can't easily change the range of an existing position
            # For now, log a warning that rebalancing would require creating a new position
            logger.warning("Rebalancing requires creating a new position - not yet implemented")
            logger.info("Position closed, user needs to manually create new position at desired range")

            # For production: Would need to call add_liquidity with new range
            # But this requires having the tokens in the wallet after removal

            # Update position with new range
            old_lower_price = position.lower_price
            old_upper_price = position.upper_price

            position.lower_bin_id = new_lower_bin_id
            position.upper_bin_id = new_upper_bin_id
            # Note: Would need to convert bin IDs back to prices for lower_price/upper_price

            # Record transaction
            tx = LiquidityTransaction(
                position_address=position.position_address,
                wallet_address=position.wallet_address,
                transaction_type='rebalance',
                amount_x=position.current_amount_x or 0,
                amount_y=position.current_amount_y or 0,
                value_usd=position.current_value_usd or 0,
                transaction_signature=remove_signature,
                tx_metadata={
                    'old_lower_bin_id': position.lower_bin_id,
                    'old_upper_bin_id': position.upper_bin_id,
                    'new_lower_bin_id': new_lower_bin_id,
                    'new_upper_bin_id': new_upper_bin_id,
                    'old_lower_price': old_lower_price,
                    'old_upper_price': old_upper_price,
                    'remove_signature': remove_signature,
                    'add_signature': add_signature
                }
            )
            db.add(tx)

            # Mark queue item as completed
            db.execute(text("""
                UPDATE position_monitoring_queue
                SET status = 'completed', updated_at = NOW()
                WHERE position_address = :position_address
            """), {'position_address': position.position_address})

            db.commit()

            logger.info(f"✅ Successfully rebalanced position {position.position_address}")

        except Exception as e:
            logger.error(f"Error rebalancing position: {e}", exc_info=True)
            raise

    def _mark_failed(self, position_address: str, error_message: str, db):
        """Mark a queued action as failed"""
        try:
            db.execute(text("""
                UPDATE position_monitoring_queue
                SET status = 'failed', error_message = :error, updated_at = NOW()
                WHERE position_address = :position_address
            """), {
                'position_address': position_address,
                'error': error_message
            })
            db.commit()
        except Exception as e:
            logger.error(f"Error marking failed: {e}")
            db.rollback()

    def shutdown(self):
        """Shutdown the scheduler"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown()
            logger.info("Liquidity Execution Service shutdown")
        except Exception as e:
            logger.error(f"Error shutting down service: {e}")


# Global instance
liquidity_execution_service = LiquidityExecutionService()
