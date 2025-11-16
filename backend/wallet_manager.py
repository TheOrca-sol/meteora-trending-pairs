"""
Wallet Manager for Degen Mode
Handles secure encryption/decryption of private keys and wallet generation
"""

import os
import logging
import base64
import base58
from cryptography.fernet import Fernet
from solders.keypair import Keypair
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Get encryption key from environment
ENCRYPTION_KEY = os.getenv('WALLET_ENCRYPTION_KEY')

if not ENCRYPTION_KEY:
    # Generate a new key and warn the user
    logger.warning("⚠️  WALLET_ENCRYPTION_KEY not set in .env - generating temporary key")
    logger.warning("⚠️  Add this to your .env file: WALLET_ENCRYPTION_KEY=" + Fernet.generate_key().decode())
    ENCRYPTION_KEY = Fernet.generate_key().decode()

# Initialize Fernet cipher
fernet = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


class WalletManager:
    """Manages wallet encryption, decryption, and generation"""

    @staticmethod
    def generate_wallet():
        """
        Generate a new Solana wallet keypair

        Returns:
            dict: {
                'public_key': str (base58 encoded),
                'private_key': str (base58 encoded),
                'encrypted_private_key': bytes
            }
        """
        try:
            # Generate new keypair
            keypair = Keypair()

            # Get public key (address)
            public_key = str(keypair.pubkey())

            # Get private key as bytes - solders uses different method
            # The keypair can be converted to bytes directly
            private_key_bytes = bytes(keypair)
            private_key_base58 = base58.b58encode(private_key_bytes).decode('utf-8')

            # Encrypt the private key
            encrypted_private_key = WalletManager.encrypt_private_key(private_key_base58)

            logger.info(f"✅ Generated new wallet: {public_key}")

            return {
                'public_key': public_key,
                'private_key': private_key_base58,  # Return unencrypted for user to save
                'encrypted_private_key': encrypted_private_key
            }

        except Exception as e:
            logger.error(f"Error generating wallet: {e}")
            raise ValueError(f"Failed to generate wallet: {str(e)}")

    @staticmethod
    def import_wallet(private_key_str):
        """
        Import an existing wallet from private key

        Args:
            private_key_str: Private key as base58 string or JSON array

        Returns:
            dict: {
                'public_key': str,
                'encrypted_private_key': bytes
            }
        """
        try:
            # Validate and parse the private key
            keypair = WalletManager.validate_private_key(private_key_str)

            # Get public key
            public_key = str(keypair.pubkey())

            # Normalize private key to base58 format
            private_key_bytes = bytes(keypair)
            private_key_base58 = base58.b58encode(private_key_bytes).decode('utf-8')

            # Encrypt the private key
            encrypted_private_key = WalletManager.encrypt_private_key(private_key_base58)

            logger.info(f"✅ Imported wallet: {public_key}")

            return {
                'public_key': public_key,
                'encrypted_private_key': encrypted_private_key
            }

        except Exception as e:
            logger.error(f"Error importing wallet: {e}")
            raise ValueError(f"Failed to import wallet: {str(e)}")

    @staticmethod
    def validate_private_key(private_key_str):
        """
        Validate and convert private key string to Keypair

        Args:
            private_key_str: Private key as base58 string or JSON array string

        Returns:
            Keypair: Solana keypair object
        """
        try:
            # Try to parse as base58 first
            try:
                private_key_bytes = base58.b58decode(private_key_str)
                # solders uses from_bytes as class method
                keypair = Keypair.from_bytes(private_key_bytes)
                return keypair
            except Exception as e1:
                pass

            # Try to parse as JSON array string like "[1,2,3,...]"
            try:
                import json
                private_key_array = json.loads(private_key_str)
                if isinstance(private_key_array, list) and len(private_key_array) == 64:
                    private_key_bytes = bytes(private_key_array)
                    keypair = Keypair.from_bytes(private_key_bytes)
                    return keypair
            except Exception as e2:
                pass

            # Try to parse as comma-separated numbers
            try:
                private_key_array = [int(x.strip()) for x in private_key_str.split(',')]
                if len(private_key_array) == 64:
                    private_key_bytes = bytes(private_key_array)
                    keypair = Keypair.from_bytes(private_key_bytes)
                    return keypair
            except Exception as e3:
                pass

            raise ValueError("Invalid private key format. Supported formats: base58 string or JSON array of 64 bytes")

        except Exception as e:
            raise ValueError(f"Invalid private key: {str(e)}")

    @staticmethod
    def encrypt_private_key(private_key_str):
        """
        Encrypt a private key using Fernet symmetric encryption

        Args:
            private_key_str: Private key as base58 string

        Returns:
            bytes: Encrypted private key
        """
        try:
            # Encrypt the private key
            encrypted = fernet.encrypt(private_key_str.encode('utf-8'))
            return encrypted

        except Exception as e:
            logger.error(f"Error encrypting private key: {e}")
            raise ValueError(f"Failed to encrypt private key: {str(e)}")

    @staticmethod
    def decrypt_private_key(encrypted_private_key):
        """
        Decrypt a private key using Fernet symmetric encryption

        Args:
            encrypted_private_key: Encrypted private key as bytes

        Returns:
            str: Decrypted private key as base58 string
        """
        try:
            # Decrypt the private key
            decrypted = fernet.decrypt(encrypted_private_key)
            return decrypted.decode('utf-8')

        except Exception as e:
            logger.error(f"Error decrypting private key: {e}")
            raise ValueError(f"Failed to decrypt private key: {str(e)}")

    @staticmethod
    def get_keypair_from_encrypted(encrypted_private_key):
        """
        Get a Solana Keypair object from encrypted private key

        Args:
            encrypted_private_key: Encrypted private key as bytes

        Returns:
            Keypair: Solana keypair object
        """
        try:
            # Decrypt the private key
            private_key_base58 = WalletManager.decrypt_private_key(encrypted_private_key)

            # Convert to keypair
            private_key_bytes = base58.b58decode(private_key_base58)
            keypair = Keypair.from_bytes(private_key_bytes)

            return keypair

        except Exception as e:
            logger.error(f"Error getting keypair from encrypted key: {e}")
            raise ValueError(f"Failed to get keypair: {str(e)}")


def generate_encryption_key():
    """Generate a new Fernet encryption key for .env file"""
    key = Fernet.generate_key()
    print(f"Add this to your .env file:")
    print(f"WALLET_ENCRYPTION_KEY={key.decode()}")
    return key.decode()


if __name__ == "__main__":
    # Test the wallet manager
    print("=== Wallet Manager Test ===\n")

    # Test wallet generation
    print("1. Generating new wallet...")
    wallet = WalletManager.generate_wallet()
    print(f"   Public Key: {wallet['public_key']}")
    print(f"   Private Key (KEEP SECRET): {wallet['private_key'][:20]}...")
    print(f"   Encrypted: ✓\n")

    # Test wallet import
    print("2. Re-importing generated wallet...")
    imported = WalletManager.import_wallet(wallet['private_key'])
    print(f"   Public Key: {imported['public_key']}")
    print(f"   Match: {imported['public_key'] == wallet['public_key']}\n")

    # Test decryption
    print("3. Testing encryption/decryption...")
    decrypted = WalletManager.decrypt_private_key(wallet['encrypted_private_key'])
    print(f"   Decryption: ✓")
    print(f"   Match: {decrypted == wallet['private_key']}\n")

    # Test keypair recovery
    print("4. Testing keypair recovery...")
    keypair = WalletManager.get_keypair_from_encrypted(wallet['encrypted_private_key'])
    print(f"   Keypair recovered: ✓")
    print(f"   Public key match: {str(keypair.pubkey()) == wallet['public_key']}\n")

    print("=== All tests passed! ✓ ===")
