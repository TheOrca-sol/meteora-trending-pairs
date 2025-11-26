"""
Meteora SDK HTTP Client
Calls Node.js microservice that wraps the official Meteora SDK
"""

import logging
import os
import requests
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class MeteoraDLMMHTTP:
    """HTTP client for Meteora microservice"""

    def __init__(self, service_url: Optional[str] = None):
        self.service_url = service_url or os.environ.get('METEORA_SERVICE_URL', 'http://localhost:3002')
        logger.info(f"Initialized Meteora HTTP client: {self.service_url}")

    def health_check(self) -> bool:
        """Check if microservice is running"""
        try:
            response = requests.get(f"{self.service_url}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Meteora service healthy: {data}")
                return True
            return False
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

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
            'inRange': bool,
            'activeBinId': int,
            'lowerBinId': int,
            'upperBinId': int
        }
        """
        try:
            logger.debug(f"Fetching position data: {position_address}")

            response = requests.post(
                f"{self.service_url}/position/data",
                json={
                    'positionAddress': position_address,
                    'poolAddress': pool_address
                },
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"Position data: ${data.get('valueUSD', 0):.2f} value, ${data.get('feesUSD', 0):.2f} fees")
                return data
            else:
                error = response.json().get('error', 'Unknown error')
                logger.error(f"Failed to fetch position data: {error}")
                return None

        except Exception as e:
            logger.error(f"Error fetching position data: {e}", exc_info=True)
            return None

    def close_position(self, position_address: str, pool_address: str) -> Optional[str]:
        """
        Close position (remove 100% liquidity)
        Returns transaction signature if successful
        """
        try:
            logger.info(f"Closing position: {position_address}")

            response = requests.post(
                f"{self.service_url}/position/close",
                json={
                    'positionAddress': position_address,
                    'poolAddress': pool_address
                },
                timeout=60
            )

            if response.status_code == 200:
                data = response.json()
                signature = data.get('signature')
                logger.info(f"✅ Position closed: {signature}")
                return signature
            else:
                error = response.json().get('error', 'Unknown error')
                logger.error(f"Failed to close position: {error}")
                return None

        except Exception as e:
            logger.error(f"Error closing position: {e}", exc_info=True)
            return None

    def claim_fees(self, position_address: str, pool_address: str) -> Optional[str]:
        """
        Claim fees from position
        Returns transaction signature if successful
        """
        try:
            logger.info(f"Claiming fees: {position_address}")

            response = requests.post(
                f"{self.service_url}/position/claim-fees",
                json={
                    'positionAddress': position_address,
                    'poolAddress': pool_address
                },
                timeout=60
            )

            if response.status_code == 200:
                data = response.json()
                signature = data.get('signature')
                logger.info(f"✅ Fees claimed: {signature}")
                return signature
            else:
                error = response.json().get('error', 'Unknown error')
                logger.error(f"Failed to claim fees: {error}")
                return None

        except Exception as e:
            logger.error(f"Error claiming fees: {e}", exc_info=True)
            return None

    def add_liquidity(
        self,
        position_address: str,
        pool_address: str,
        amount_x: float,
        amount_y: float
    ) -> Optional[str]:
        """
        Add liquidity to position
        Returns transaction signature if successful
        """
        try:
            logger.info(f"Adding liquidity: {position_address} ({amount_x} X, {amount_y} Y)")

            response = requests.post(
                f"{self.service_url}/position/add-liquidity",
                json={
                    'positionAddress': position_address,
                    'poolAddress': pool_address,
                    'amountX': amount_x,
                    'amountY': amount_y
                },
                timeout=60
            )

            if response.status_code == 200:
                data = response.json()
                signature = data.get('signature')
                logger.info(f"✅ Liquidity added: {signature}")
                return signature
            else:
                error = response.json().get('error', 'Unknown error')
                logger.error(f"Failed to add liquidity: {error}")
                return None

        except Exception as e:
            logger.error(f"Error adding liquidity: {e}", exc_info=True)
            return None

    def compound_position(self, position_address: str, pool_address: str) -> Optional[Dict]:
        """
        Compound position (claim fees + add back as liquidity)
        Returns: {
            'claimSignature': str,
            'addSignature': str,
            'feesCompounded': { 'feesX': float, 'feesY': float }
        }
        """
        try:
            logger.info(f"Compounding position: {position_address}")

            response = requests.post(
                f"{self.service_url}/position/compound",
                json={
                    'positionAddress': position_address,
                    'poolAddress': pool_address
                },
                timeout=120  # Compound takes longer (2 transactions)
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"✅ Position compounded: claim={data['claimSignature']}, add={data['addSignature']}")
                return data
            else:
                error = response.json().get('error', 'Unknown error')
                logger.error(f"Failed to compound: {error}")
                return None

        except Exception as e:
            logger.error(f"Error compounding: {e}", exc_info=True)
            return None


# Global instance
meteora_sdk_http = MeteoraDLMMHTTP()
