"""
Meteora DLMM SDK Python Wrapper
Handles blockchain interactions with Meteora DLMM pools
"""

import logging
import os
import json
from typing import Optional, Dict, Tuple
from solana.rpc.api import Client
from solana.rpc.commitment import Confirmed
from solders.pubkey import Pubkey
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.instruction import Instruction, AccountMeta
from solders.compute_budget import set_compute_unit_limit, set_compute_unit_price
import struct
import base64

logger = logging.getLogger(__name__)


class MeteoraDLMM:
    """Python wrapper for Meteora DLMM program interactions"""

    # Meteora DLMM Program ID (mainnet)
    DLMM_PROGRAM_ID = Pubkey.from_string("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo")

    def __init__(self, rpc_url: Optional[str] = None):
        self.rpc_url = rpc_url or os.environ.get('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
        self.client = Client(self.rpc_url, commitment=Confirmed)
        logger.info(f"Initialized Meteora SDK with RPC: {self.rpc_url}")

    def get_position_data(self, position_address: str, pool_address: str) -> Optional[Dict]:
        """
        Fetch current position data from blockchain
        Returns: {
            'amountX': float,
            'amountY': float,
            'valueUSD': float,
            'feesX': float,
            'feesY': float,
            'feesUSD': float,
            'profitUSD': float,
            'inRange': bool
        }
        """
        try:
            position_pubkey = Pubkey.from_string(position_address)
            pool_pubkey = Pubkey.from_string(pool_address)

            # Fetch position account data
            position_account = self.client.get_account_info(position_pubkey)
            if not position_account.value:
                logger.error(f"Position account not found: {position_address}")
                return None

            # Fetch pool account data
            pool_account = self.client.get_account_info(pool_pubkey)
            if not pool_account.value:
                logger.error(f"Pool account not found: {pool_address}")
                return None

            # Parse position data
            position_data = self._parse_position_account(position_account.value.data)
            pool_data = self._parse_pool_account(pool_account.value.data)

            if not position_data or not pool_data:
                return None

            # Calculate token amounts
            amount_x = position_data['total_x_amount'] / (10 ** pool_data['decimals_x'])
            amount_y = position_data['total_y_amount'] / (10 ** pool_data['decimals_y'])

            # Calculate fees
            fees_x = position_data['fee_x'] / (10 ** pool_data['decimals_x'])
            fees_y = position_data['fee_y'] / (10 ** pool_data['decimals_y'])

            # Fetch token prices from Jupiter
            prices = self._fetch_token_prices(pool_data['mint_x'], pool_data['mint_y'])

            # Calculate USD values
            value_x_usd = amount_x * prices.get('price_x', 0)
            value_y_usd = amount_y * prices.get('price_y', 0)
            total_value_usd = value_x_usd + value_y_usd

            fees_x_usd = fees_x * prices.get('price_x', 0)
            fees_y_usd = fees_y * prices.get('price_y', 0)
            total_fees_usd = fees_x_usd + fees_y_usd

            # Check if position is in range
            active_bin_id = pool_data['active_bin_id']
            in_range = (position_data['lower_bin_id'] <= active_bin_id <= position_data['upper_bin_id'])

            result = {
                'amountX': amount_x,
                'amountY': amount_y,
                'valueUSD': total_value_usd,
                'feesX': fees_x,
                'feesY': fees_y,
                'feesUSD': total_fees_usd,
                'profitUSD': total_fees_usd,  # Simplified - doesn't account for IL
                'inRange': in_range,
                'activeBinId': active_bin_id,
                'lowerBinId': position_data['lower_bin_id'],
                'upperBinId': position_data['upper_bin_id']
            }

            logger.info(f"Position data fetched: ${total_value_usd:.2f} value, ${total_fees_usd:.2f} fees, in_range={in_range}")
            return result

        except Exception as e:
            logger.error(f"Error fetching position data: {e}", exc_info=True)
            return None

    def _parse_position_account(self, data: bytes) -> Optional[Dict]:
        """
        Parse Meteora DLMM position account data
        This is a simplified parser - actual structure may vary
        """
        try:
            # Position account structure (approximate):
            # - 8 bytes: discriminator
            # - 32 bytes: lb_pair (pool address)
            # - 32 bytes: owner
            # - 8 bytes: liquidity
            # - 4 bytes: lower_bin_id
            # - 4 bytes: upper_bin_id
            # - 8 bytes: total_x_amount
            # - 8 bytes: total_y_amount
            # - 8 bytes: fee_x
            # - 8 bytes: fee_y

            if len(data) < 128:
                logger.error(f"Position account data too short: {len(data)} bytes")
                return None

            # Skip discriminator
            offset = 8

            # Skip lb_pair (32) and owner (32)
            offset += 64

            # Skip liquidity (8)
            offset += 8

            # Read bin IDs (4 + 4 bytes)
            lower_bin_id = struct.unpack('<i', data[offset:offset+4])[0]
            upper_bin_id = struct.unpack('<i', data[offset+4:offset+8])[0]
            offset += 8

            # Read amounts (8 + 8 bytes)
            total_x_amount = struct.unpack('<Q', data[offset:offset+8])[0]
            total_y_amount = struct.unpack('<Q', data[offset+8:offset+16])[0]
            offset += 16

            # Read fees (8 + 8 bytes)
            fee_x = struct.unpack('<Q', data[offset:offset+8])[0]
            fee_y = struct.unpack('<Q', data[offset+8:offset+16])[0]

            return {
                'lower_bin_id': lower_bin_id,
                'upper_bin_id': upper_bin_id,
                'total_x_amount': total_x_amount,
                'total_y_amount': total_y_amount,
                'fee_x': fee_x,
                'fee_y': fee_y
            }

        except Exception as e:
            logger.error(f"Error parsing position account: {e}")
            return None

    def _parse_pool_account(self, data: bytes) -> Optional[Dict]:
        """
        Parse Meteora DLMM pool account data
        """
        try:
            # Pool account structure (approximate):
            # - 8 bytes: discriminator
            # - 32 bytes: mint_x
            # - 32 bytes: mint_y
            # - 1 byte: decimals_x
            # - 1 byte: decimals_y
            # - 2 bytes: bin_step
            # - 4 bytes: active_bin_id

            if len(data) < 96:
                logger.error(f"Pool account data too short: {len(data)} bytes")
                return None

            offset = 8  # Skip discriminator

            # Read mints (32 + 32 bytes)
            mint_x = Pubkey(data[offset:offset+32])
            mint_y = Pubkey(data[offset+32:offset+64])
            offset += 64

            # Read decimals (1 + 1 bytes)
            decimals_x = data[offset]
            decimals_y = data[offset+1]
            offset += 2

            # Read bin_step (2 bytes)
            bin_step = struct.unpack('<H', data[offset:offset+2])[0]
            offset += 2

            # Read active_bin_id (4 bytes)
            active_bin_id = struct.unpack('<i', data[offset:offset+4])[0]

            return {
                'mint_x': str(mint_x),
                'mint_y': str(mint_y),
                'decimals_x': decimals_x,
                'decimals_y': decimals_y,
                'bin_step': bin_step,
                'active_bin_id': active_bin_id
            }

        except Exception as e:
            logger.error(f"Error parsing pool account: {e}")
            return None

    def _fetch_token_prices(self, mint_x: str, mint_y: str) -> Dict:
        """Fetch token prices from Jupiter API"""
        try:
            import requests
            response = requests.get(
                f"https://api.jup.ag/price/v2?ids={mint_x},{mint_y}",
                timeout=5
            )

            if response.status_code == 200:
                data = response.json().get('data', {})
                return {
                    'price_x': data.get(mint_x, {}).get('price', 0),
                    'price_y': data.get(mint_y, {}).get('price', 0)
                }
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")

        return {'price_x': 0, 'price_y': 0}

    def create_remove_liquidity_transaction(
        self,
        position_address: str,
        pool_address: str,
        owner: Keypair,
        bps_to_remove: int = 10000  # 10000 = 100%
    ) -> Optional[Transaction]:
        """
        Create a transaction to remove liquidity from a position
        bps_to_remove: Basis points (10000 = 100%, 5000 = 50%)
        """
        try:
            logger.info(f"Creating remove liquidity tx: {position_address} ({bps_to_remove} bps)")

            position_pubkey = Pubkey.from_string(position_address)
            pool_pubkey = Pubkey.from_string(pool_address)

            # Get recent blockhash
            recent_blockhash = self.client.get_latest_blockhash().value.blockhash

            # Build remove liquidity instruction
            # Note: This is a simplified version - actual instruction would need:
            # - Correct accounts (position, pool, token accounts, etc.)
            # - Correct instruction data format
            # - Token account derivations

            instruction_data = self._build_remove_liquidity_instruction_data(bps_to_remove)

            # Create instruction (placeholder - needs actual account list)
            instruction = Instruction(
                program_id=self.DLMM_PROGRAM_ID,
                accounts=[
                    AccountMeta(pubkey=position_pubkey, is_signer=False, is_writable=True),
                    AccountMeta(pubkey=pool_pubkey, is_signer=False, is_writable=True),
                    AccountMeta(pubkey=owner.pubkey(), is_signer=True, is_writable=False),
                    # ... additional accounts needed
                ],
                data=instruction_data
            )

            # Create transaction
            transaction = Transaction.new_with_payer(
                instructions=[
                    set_compute_unit_limit(400_000),
                    set_compute_unit_price(50_000),
                    instruction
                ],
                payer=owner.pubkey()
            )

            # Set blockhash
            transaction.recent_blockhash = recent_blockhash

            # Sign transaction
            transaction.sign([owner])

            logger.info("Remove liquidity transaction created successfully")
            return transaction

        except Exception as e:
            logger.error(f"Error creating remove liquidity transaction: {e}", exc_info=True)
            return None

    def _build_remove_liquidity_instruction_data(self, bps: int) -> bytes:
        """Build instruction data for remove liquidity"""
        # Instruction discriminator for remove_liquidity (8 bytes)
        # Followed by bps (2 bytes, little-endian)
        discriminator = b'\x00\x00\x00\x00\x00\x00\x00\x01'  # Placeholder
        bps_bytes = struct.pack('<H', bps)
        return discriminator + bps_bytes

    def create_claim_fees_transaction(
        self,
        position_address: str,
        pool_address: str,
        owner: Keypair
    ) -> Optional[Transaction]:
        """
        Create a transaction to claim fees from a position
        """
        try:
            logger.info(f"Creating claim fees tx: {position_address}")

            position_pubkey = Pubkey.from_string(position_address)
            pool_pubkey = Pubkey.from_string(pool_address)

            # Get recent blockhash
            recent_blockhash = self.client.get_latest_blockhash().value.blockhash

            # Build claim fee instruction
            instruction_data = self._build_claim_fee_instruction_data()

            instruction = Instruction(
                program_id=self.DLMM_PROGRAM_ID,
                accounts=[
                    AccountMeta(pubkey=position_pubkey, is_signer=False, is_writable=True),
                    AccountMeta(pubkey=pool_pubkey, is_signer=False, is_writable=True),
                    AccountMeta(pubkey=owner.pubkey(), is_signer=True, is_writable=False),
                    # ... additional accounts needed
                ],
                data=instruction_data
            )

            # Create transaction
            transaction = Transaction.new_with_payer(
                instructions=[
                    set_compute_unit_limit(300_000),
                    set_compute_unit_price(50_000),
                    instruction
                ],
                payer=owner.pubkey()
            )

            transaction.recent_blockhash = recent_blockhash
            transaction.sign([owner])

            logger.info("Claim fees transaction created successfully")
            return transaction

        except Exception as e:
            logger.error(f"Error creating claim fees transaction: {e}", exc_info=True)
            return None

    def _build_claim_fee_instruction_data(self) -> bytes:
        """Build instruction data for claim fees"""
        discriminator = b'\x00\x00\x00\x00\x00\x00\x00\x02'  # Placeholder
        return discriminator

    def create_add_liquidity_transaction(
        self,
        pool_address: str,
        position_address: str,
        owner: Keypair,
        amount_x: int,
        amount_y: int,
        lower_bin_id: int,
        upper_bin_id: int
    ) -> Optional[Transaction]:
        """
        Create a transaction to add liquidity to a position
        Used for compounding - adds claimed fees back to position
        """
        try:
            logger.info(f"Creating add liquidity tx: {position_address}")

            position_pubkey = Pubkey.from_string(position_address)
            pool_pubkey = Pubkey.from_string(pool_address)

            # Get recent blockhash
            recent_blockhash = self.client.get_latest_blockhash().value.blockhash

            # Build add liquidity instruction
            instruction_data = self._build_add_liquidity_instruction_data(
                amount_x, amount_y, lower_bin_id, upper_bin_id
            )

            instruction = Instruction(
                program_id=self.DLMM_PROGRAM_ID,
                accounts=[
                    AccountMeta(pubkey=position_pubkey, is_signer=False, is_writable=True),
                    AccountMeta(pubkey=pool_pubkey, is_signer=False, is_writable=True),
                    AccountMeta(pubkey=owner.pubkey(), is_signer=True, is_writable=False),
                    # ... additional accounts needed
                ],
                data=instruction_data
            )

            # Create transaction
            transaction = Transaction.new_with_payer(
                instructions=[
                    set_compute_unit_limit(400_000),
                    set_compute_unit_price(50_000),
                    instruction
                ],
                payer=owner.pubkey()
            )

            transaction.recent_blockhash = recent_blockhash
            transaction.sign([owner])

            logger.info("Add liquidity transaction created successfully")
            return transaction

        except Exception as e:
            logger.error(f"Error creating add liquidity transaction: {e}", exc_info=True)
            return None

    def _build_add_liquidity_instruction_data(
        self,
        amount_x: int,
        amount_y: int,
        lower_bin_id: int,
        upper_bin_id: int
    ) -> bytes:
        """Build instruction data for add liquidity"""
        discriminator = b'\x00\x00\x00\x00\x00\x00\x00\x03'  # Placeholder
        # Pack amounts and bin IDs
        data = discriminator
        data += struct.pack('<Q', amount_x)  # 8 bytes
        data += struct.pack('<Q', amount_y)  # 8 bytes
        data += struct.pack('<i', lower_bin_id)  # 4 bytes
        data += struct.pack('<i', upper_bin_id)  # 4 bytes
        return data

    def send_and_confirm_transaction(
        self,
        transaction: Transaction,
        max_retries: int = 3
    ) -> Optional[str]:
        """
        Send transaction and wait for confirmation
        Returns transaction signature if successful
        """
        try:
            # Serialize transaction
            serialized_tx = bytes(transaction)

            # Send transaction
            logger.info("Sending transaction...")
            result = self.client.send_raw_transaction(serialized_tx)

            if result.value:
                signature = str(result.value)
                logger.info(f"Transaction sent: {signature}")

                # Wait for confirmation
                logger.info("Waiting for confirmation...")
                confirmation = self.client.confirm_transaction(
                    result.value,
                    commitment=Confirmed
                )

                if confirmation.value:
                    logger.info(f"✅ Transaction confirmed: {signature}")
                    return signature
                else:
                    logger.error("Transaction failed confirmation")
                    return None
            else:
                logger.error("Failed to send transaction")
                return None

        except Exception as e:
            logger.error(f"Error sending transaction: {e}", exc_info=True)
            return None


# Global instance
meteora_sdk = MeteoraDLMM()
