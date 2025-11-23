from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import logging
import os
import gc
import random
import string
import threading
from datetime import datetime, timedelta
from pool_cache import get_cached_pools, pool_cache
from grouped_pool_cache import get_grouped_cached_pools, grouped_pool_cache
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

# Optional database features (for Capital Rotation)
# These are only needed if DATABASE_URL is set
DATABASE_ENABLED = os.getenv('DATABASE_URL') is not None

if DATABASE_ENABLED:
    try:
        from monitoring_service import monitoring_service
        from models import get_db, User, TelegramAuthCode, MonitoringConfig, DegenConfig, cleanup_expired_auth_codes, create_performance_indexes
        from telegram_bot import telegram_bot_handler, get_bot_link
        from wallet_manager import WalletManager
        from services.monitoring.degen_monitoring import degen_monitoring_service
        # Enable APScheduler logging
        logging.getLogger('apscheduler').setLevel(logging.DEBUG)
        logger.info("Database features enabled (Capital Rotation + Degen Mode)")
    except Exception as e:
        logger.warning(f"Failed to load database features: {e}")
        DATABASE_ENABLED = False
else:
    logger.info("Running in analytics-only mode (no DATABASE_URL set)")

app = Flask(__name__)

# Pool cache configuration
# Set to True to use GroupedPoolCache (/pair/groups API) - NOT RECOMMENDED (slow)
# Set to False to use PoolDataCache (/pair/all API) - RECOMMENDED (fast)
# See PHASE_2_ANALYSIS.md for performance comparison
USE_GROUPED_CACHE = os.getenv('USE_GROUPED_CACHE', 'false').lower() == 'true'

logger.info(f"Cache mode: {'GroupedPoolCache (Phase 2)' if USE_GROUPED_CACHE else 'PoolDataCache (Phase 1)'}")

def get_pools_from_cache(force_refresh=False, limit=None):
    """
    Wrapper function to get pools from the configured cache

    Args:
        force_refresh: Force refresh of cache
        limit: Max number of groups to load (only for GroupedPoolCache)

    Returns:
        List of pool data
    """
    if USE_GROUPED_CACHE:
        return get_grouped_cached_pools(force_refresh=force_refresh, limit=limit)
    else:
        return get_cached_pools(force_refresh=force_refresh)
CORS(app, resources={r"/*": {"origins": ["https://www.imded.fun", "https://imded.fun", "http://localhost:3000", "http://localhost:5000"]}})

def process_pairs_data(data, page=1, limit=50, search_term=None, min_liquidity=0, min_volume_24h=0, sort_by='fees_24h'):
    try:
        # Clear memory
        gc.collect()

        logger.info(f"Processing {len(data)} pairs with filters: page={page}, limit={limit}, search={search_term}, min_liquidity={min_liquidity}, min_volume_24h={min_volume_24h}")

        # Apply search filter first (most efficient)
        filtered_data = data
        if search_term:
            search_term = search_term.upper()
            filtered_data = [
                pair for pair in filtered_data
                if search_term in str(pair.get('name', '')).upper()
            ]
            logger.info(f"After search filter: {len(filtered_data)} pairs")

        # Apply liquidity filter
        if min_liquidity > 0:
            def safe_float(value, default=0.0):
                """Safely convert value to float, handling empty strings and None"""
                if value is None or value == '':
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default

            filtered_data = [
                pair for pair in filtered_data
                if safe_float(pair.get('liquidity', 0)) >= min_liquidity
            ]
            logger.info(f"After liquidity filter: {len(filtered_data)} pairs")

        # Apply 24h volume filter
        if min_volume_24h > 0:
            def safe_float(value, default=0.0):
                """Safely convert value to float, handling empty strings and None"""
                if value is None or value == '':
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default

            filtered_data = [
                pair for pair in filtered_data
                if safe_float(pair.get('volume', {}).get('hour_24', 0)) >= min_volume_24h
            ]
            logger.info(f"After 24h volume filter: {len(filtered_data)} pairs")
        
        # Sort data
        def safe_float(value, default=0.0):
            """Safely convert value to float, handling empty strings and None"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        # Calculate fee rate for sorting (30min fees / TVL)
        # Use minimum TVL threshold to avoid unrealistic fee rates from low liquidity pools
        def calculate_fee_rate(pair):
            fees_obj = pair.get('fees', {})
            fees_30min = safe_float(fees_obj.get('min_30', 0))
            tvl = safe_float(pair.get('liquidity', 0))
            # Only calculate fee rate for pools with TVL >= $1000
            # This avoids showing unrealistic percentages from tiny liquidity pools
            return (fees_30min / tvl * 100) if tvl >= 1000 else 0

        sort_key = {
            'fee_rate_30min': calculate_fee_rate,
            'fees_24h': lambda x: safe_float(x.get('fees_24h', 0)),
            'liquidity': lambda x: safe_float(x.get('liquidity', 0)),
            'name': lambda x: str(x.get('name', ''))
        }.get(sort_by, calculate_fee_rate)  # Default to fee_rate_30min
        
        sorted_data = sorted(filtered_data, key=sort_key, reverse=True)
        
        # Calculate pagination
        total_pairs = len(sorted_data)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        
        # Get the page slice
        page_data = sorted_data[start_idx:end_idx]
        logger.info(f"Page {page}: showing {len(page_data)} pairs (total: {total_pairs})")
        
        # Process only the page data
        def safe_float(value, default=0.0):
            """Safely convert value to float, handling empty strings and None"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        def safe_int(value, default=0):
            """Safely convert value to int, handling empty strings and None"""
            if value is None or value == '':
                return default
            try:
                return int(float(value))  # Convert to float first to handle "1.0" strings
            except (ValueError, TypeError):
                return default

        processed_pairs = []
        for pair in page_data:
            try:
                # Extract volume and fees
                volume_obj = pair.get('volume', {})
                fees_obj = pair.get('fees', {})
                volume_30min = safe_float(volume_obj.get('min_30', 0))
                volume_24h = safe_float(volume_obj.get('hour_24', 0))
                fees_30min = safe_float(fees_obj.get('min_30', 0))

                processed_pair = {
                    'address': pair.get('address', ''),
                    'pairName': pair.get('name', ''),
                    'price': safe_float(pair.get('current_price', 0)),
                    'fees24h': safe_float(pair.get('fees_24h', 0)),
                    'fees30min': fees_30min,
                    'volume30min': volume_30min,
                    'volume24h': volume_24h,
                    'apr': safe_float(pair.get('apr', 0)),
                    'totalLiquidity': safe_float(pair.get('liquidity', 0)),
                    'binStep': safe_int(pair.get('bin_step', 0)),
                    'baseFee': safe_float(pair.get('base_fee_percentage', 0)),
                    'is_blacklisted': bool(pair.get('is_blacklisted', False)),
                    'mint_x': pair.get('mint_x', ''),
                    'mint_y': pair.get('mint_y', '')
                }
                processed_pairs.append(processed_pair)
            except Exception as e:
                logger.error(f"Error processing pair: {e}")
                continue
        
        # Clear memory
        gc.collect()
        
        return {
            'data': processed_pairs,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_pairs,
                'total_pages': (total_pairs + limit - 1) // limit,
                'has_next': end_idx < total_pairs,
                'has_prev': page > 1
            }
        }
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        raise

@app.route('/api/pairs', methods=['GET'])
def get_pairs():
    try:
        # Get pagination and filter parameters with proper defaults
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 per page
        search_term = request.args.get('search', '').strip()

        # Handle empty string for min_liquidity
        min_liquidity_param = request.args.get('min_liquidity', '').strip()
        min_liquidity = float(min_liquidity_param) if min_liquidity_param else 0.0

        # Handle empty string for min_volume_24h
        min_volume_24h_param = request.args.get('min_volume_24h', '').strip()
        min_volume_24h = float(min_volume_24h_param) if min_volume_24h_param else 0.0

        sort_by = request.args.get('sort_by', 'fees_24h')

        # Check if user wants to force refresh (bypass cache)
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'

        logger.info(f"API request: page={page}, limit={limit}, search='{search_term}', min_liquidity={min_liquidity}, min_volume_24h={min_volume_24h}, sort_by={sort_by}, force_refresh={force_refresh}")

        # Fetch data from cache (or Meteora API if cache is stale or force refresh)
        if force_refresh:
            logger.info("Force refresh requested - bypassing cache...")
        else:
            logger.info("Fetching pool data from cache...")
        data = get_pools_from_cache(force_refresh=force_refresh, limit=50)
        logger.info(f"Received {len(data)} pairs {'(fresh from API)' if force_refresh else '(from cache)'}")
        
        # Process data with pagination and filtering
        result = process_pairs_data(data, page, limit, search_term, min_liquidity, min_volume_24h, sort_by)
        logger.info(f"Successfully processed page {page} with {len(result['data'])} pairs")
        
        # Clear memory
        del data
        gc.collect()
        
        return jsonify({
            'status': 'success',
            **result
        })
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

@app.route('/api/wallet/positions', methods=['POST'])
def get_wallet_positions():
    """
    Get Meteora positions by checking pools with whitelisted tokens and quote preferences
    """
    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')
        whitelist = data.get('whitelist', [])
        quote_preferences = data.get('quotePreferences', {'sol': True, 'usdc': True})

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # If no whitelist, return empty
        if not whitelist:
            return jsonify({
                'status': 'success',
                'positions': [],
                'message': 'Add tokens to whitelist to find positions'
            })

        logger.info(f"Fetching positions for wallet: {wallet_address} with {len(whitelist)} whitelisted tokens")

        # Fetch all pools from cache
        logger.info("Fetching pools from cache...")
        all_pools = get_pools_from_cache(limit=100)
        logger.info(f"Loaded {len(all_pools)} pools from cache")

        # Common quote token addresses
        QUOTE_TOKENS = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        }

        # Filter pools based on whitelist and quote preferences
        candidate_pools = []
        for pool in all_pools:
            mint_x = pool.get('mint_x', '')
            mint_y = pool.get('mint_y', '')

            # Check if pool contains a whitelisted token
            has_whitelisted_token = mint_x in whitelist or mint_y in whitelist
            if not has_whitelisted_token:
                continue

            # Check if pool has preferred quote token
            has_sol_quote = (mint_x == QUOTE_TOKENS['SOL'] or mint_y == QUOTE_TOKENS['SOL']) and quote_preferences.get('sol', False)
            has_usdc_quote = (mint_x == QUOTE_TOKENS['USDC'] or mint_y == QUOTE_TOKENS['USDC']) and quote_preferences.get('usdc', False)

            if has_sol_quote or has_usdc_quote:
                candidate_pools.append(pool)

        logger.info(f"Found {len(candidate_pools)} candidate pools matching whitelist and quote preferences")

        # Now fetch ALL positions for this wallet in ONE RPC call (like the SDK does)
        # Then match them against candidate pools
        RPC_URL = "https://api.mainnet-beta.solana.com"
        DLMM_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"

        import base58

        def safe_float(value, default=0.0):
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default

        # Query ALL positions for this wallet in one call (SDK approach)
        logger.info("Fetching all user positions...")
        rpc_payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "getProgramAccounts",
            "params": [
                DLMM_PROGRAM_ID,
                {
                    "encoding": "base64",
                    "filters": [
                        {
                            "memcmp": {
                                "offset": 40,  # Owner at offset 40
                                "bytes": wallet_address
                            }
                        }
                    ]
                }
            ]
        }

        try:
            rpc_response = requests.post(RPC_URL, json=rpc_payload, timeout=30)
            rpc_response.raise_for_status()
            rpc_data = rpc_response.json()
        except Exception as e:
            logger.error(f"Error querying positions: {e}")
            return jsonify({
                'status': 'error',
                'message': f'Error querying blockchain: {str(e)}'
            }), 500

        # Extract pool addresses and position data from position accounts
        user_positions_map = {}  # pool_address -> list of position accounts
        if 'result' in rpc_data and rpc_data['result']:
            logger.info(f"Found {len(rpc_data['result'])} total positions for wallet")

            for account in rpc_data['result']:
                try:
                    position_pubkey = account.get('pubkey')
                    account_data = account.get('account', {}).get('data', [])
                    if not account_data or len(account_data) < 1:
                        continue

                    # Decode base64 data
                    import base64
                    import struct
                    data_bytes = base64.b64decode(account_data[0])

                    # Extract pool address at offset 8 (32 bytes)
                    if len(data_bytes) >= 40:
                        pool_pubkey_bytes = data_bytes[8:40]
                        pool_address = base58.b58encode(pool_pubkey_bytes).decode('ascii')

                        # Store position account with its pool
                        if pool_address not in user_positions_map:
                            user_positions_map[pool_address] = []

                        # Try to extract position data (amounts, fees, etc.)
                        # Position structure (simplified):
                        # offset 72: liquidity_shares (u128 = 16 bytes)
                        # offset 88: fee_pending_x (u64 = 8 bytes)
                        # offset 96: fee_pending_y (u64 = 8 bytes)

                        position_info = {
                            'position_account': position_pubkey,
                            'pool_address': pool_address
                        }

                        # Extract liquidity shares if available
                        if len(data_bytes) >= 88:
                            try:
                                # Read u128 as two u64s
                                liquidity_low = struct.unpack('<Q', data_bytes[72:80])[0]
                                liquidity_high = struct.unpack('<Q', data_bytes[80:88])[0]
                                liquidity_shares = liquidity_low + (liquidity_high << 64)
                                position_info['liquidity_shares'] = liquidity_shares
                            except Exception as e:
                                logger.error(f"Error extracting liquidity: {e}")

                        # Extract pending fees if available
                        if len(data_bytes) >= 104:
                            try:
                                fee_x = struct.unpack('<Q', data_bytes[88:96])[0]
                                fee_y = struct.unpack('<Q', data_bytes[96:104])[0]
                                position_info['fee_pending_x'] = fee_x
                                position_info['fee_pending_y'] = fee_y
                            except Exception as e:
                                logger.error(f"Error extracting fees: {e}")

                        user_positions_map[pool_address].append(position_info)

                except Exception as e:
                    logger.error(f"Error extracting position data: {e}")
                    continue

        logger.info(f"User has positions in {len(user_positions_map)} pools")

        # Get SOL price from SOL-USDC pool in Meteora data
        def get_sol_price_from_pools(pools):
            """Extract SOL price from SOL-USDC pool"""
            SOL_MINT = 'So11111111111111111111111111111111111111112'
            USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

            for pool in pools:
                mint_x = pool.get('mint_x', '')
                mint_y = pool.get('mint_y', '')

                # Find SOL-USDC pool
                if (mint_x == SOL_MINT and mint_y == USDC_MINT):
                    # SOL is X, USDC is Y, so pool_price = USDC per SOL = SOL price
                    price = safe_float(pool.get('current_price', 0))
                    if price > 0:
                        logger.info(f"Found SOL price from SOL-USDC pool: ${price:.2f}")
                        return price
                elif (mint_x == USDC_MINT and mint_y == SOL_MINT):
                    # USDC is X, SOL is Y, so pool_price = SOL per USDC, need to invert
                    price = safe_float(pool.get('current_price', 0))
                    if price > 0:
                        sol_price = 1.0 / price
                        logger.info(f"Found SOL price from USDC-SOL pool: ${sol_price:.2f}")
                        return sol_price

            logger.warning("Could not find SOL-USDC pool, using fallback price $150")
            return 150.0  # Fallback

        sol_price_usd = get_sol_price_from_pools(all_pools)

        # Now match user's pools with candidate pools
        positions = []
        candidate_pool_map = {pool['address']: pool for pool in candidate_pools}

        for pool_address, position_accounts in user_positions_map.items():
            if pool_address in candidate_pool_map:
                pool = candidate_pool_map[pool_address]
                logger.info(f"Matched position: {pool.get('name', '')} ({len(position_accounts)} position(s))")

                # Fetch detailed position data from Meteora API for each position
                total_token_x = 0
                total_token_y = 0
                total_liquidity_shares = sum(p.get('liquidity_shares', 0) for p in position_accounts)
                total_fee_x = sum(p.get('fee_pending_x', 0) for p in position_accounts)
                total_fee_y = sum(p.get('fee_pending_y', 0) for p in position_accounts)

                # Fetch deposit and withdrawal history for each position to calculate current balance
                for position_account in position_accounts:
                    position_address = position_account.get('position_account')
                    try:
                        # Fetch deposits
                        deposits_response = requests.get(
                            f"https://dlmm-api.meteora.ag/position/{position_address}/deposits",
                            timeout=5
                        )
                        # Fetch withdrawals
                        withdraws_response = requests.get(
                            f"https://dlmm-api.meteora.ag/position/{position_address}/withdraws",
                            timeout=5
                        )

                        if deposits_response.status_code == 200:
                            deposits = deposits_response.json()
                            for deposit in deposits:
                                total_token_x += deposit.get('token_x_amount', 0)
                                total_token_y += deposit.get('token_y_amount', 0)

                        if withdraws_response.status_code == 200:
                            withdraws = withdraws_response.json()
                            for withdraw in withdraws:
                                total_token_x -= withdraw.get('token_x_amount', 0)
                                total_token_y -= withdraw.get('token_y_amount', 0)

                    except Exception as e:
                        logger.error(f"  Error fetching position history: {e}")

                # Get token info and derive prices from pool data
                mint_x = pool.get('mint_x', '')
                mint_y = pool.get('mint_y', '')
                pool_price = safe_float(pool.get('current_price', 0))  # Y per X (e.g., USDC per JUP)

                # Derive token USD prices from pool price
                # Common quote tokens we can use as USD anchors
                USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
                SOL_MINT = 'So11111111111111111111111111111111111111112'

                # Default prices
                price_x = 0
                price_y = 0

                # If Y token is USDC, then pool_price = USDC per X token = X price in USD
                if mint_y == USDC_MINT:
                    price_y = 1.0  # USDC = $1
                    price_x = pool_price  # X token price in USD
                # If X token is USDC, then pool_price = Y per USDC, so Y price = pool_price
                elif mint_x == USDC_MINT:
                    price_x = 1.0  # USDC = $1
                    price_y = pool_price
                # For SOL pairs, use real-time SOL price from Jupiter
                elif mint_y == SOL_MINT:
                    price_y = sol_price_usd
                    price_x = pool_price * price_y
                elif mint_x == SOL_MINT:
                    price_x = sol_price_usd
                    price_y = pool_price * price_x

                # Get token decimals (standard decimals for common tokens, or query from RPC)
                # For now, use common decimals - JUP: 6, USDC: 6, SOL: 9, WEED: likely 6
                COMMON_DECIMALS = {
                    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 6,  # JUP
                    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,  # USDC
                    'So11111111111111111111111111111111111111112': 9,  # SOL
                }
                decimals_x = COMMON_DECIMALS.get(mint_x, 6)  # Default to 6 if unknown
                decimals_y = COMMON_DECIMALS.get(mint_y, 6)

                # Note: Fee extraction from position bytes needs verification
                # The current offsets may not be correct for all position versions
                # For now, set fees to 0 until we can verify the correct data structure
                total_pending_fees_usd = 0
                # fee_x_usd = (total_fee_x / (10 ** decimals_x)) * price_x if total_fee_x > 0 else 0
                # fee_y_usd = (total_fee_y / (10 ** decimals_y)) * price_y if total_fee_y > 0 else 0
                # total_pending_fees_usd = fee_x_usd + fee_y_usd

                # Calculate position value from actual token amounts (deposits - withdrawals)
                # Convert raw amounts to human-readable (divide by 10^decimals) then multiply by price
                token_x_readable = total_token_x / (10 ** decimals_x) if total_token_x > 0 else 0
                token_y_readable = total_token_y / (10 ** decimals_y) if total_token_y > 0 else 0

                value_from_x = token_x_readable * price_x
                value_from_y = token_y_readable * price_y
                estimated_position_value = value_from_x + value_from_y

                # Convert to strings to avoid JSON serialization issues with huge numbers
                # Calculate 30-minute fee rate for this pool
                fees_obj = pool.get('fees', {})
                volume_obj = pool.get('volume', {})
                fees_30min = safe_float(fees_obj.get('min_30', 0))
                volume_30min = safe_float(volume_obj.get('min_30', 0))
                pool_liquidity = safe_float(pool.get('liquidity', 0))
                fee_rate_30min = (fees_30min / pool_liquidity * 100) if pool_liquidity > 0 else 0

                position_data = {
                    'address': pool_address,
                    'pairName': pool.get('name', ''),
                    # Pool-level data (for reference)
                    'pool_liquidity': pool_liquidity,
                    'pool_feeRate30min': fee_rate_30min,
                    'pool_fees30min': fees_30min,
                    'pool_volume30min': volume_30min,
                    'pool_current_price': safe_float(pool.get('current_price', 0)),
                    'binStep': pool.get('bin_step', 0),
                    'baseFee': safe_float(pool.get('base_fee_percentage', 0)),
                    # Position-specific data
                    'liquidity_shares': str(total_liquidity_shares),
                    'pending_fee_x': str(total_fee_x),
                    'pending_fee_y': str(total_fee_y),
                    'pending_fees_usd': total_pending_fees_usd,
                    'estimated_value_usd': estimated_position_value,
                    'token_x_amount': token_x_readable,
                    'token_y_amount': token_y_readable,
                    'has_liquidity': total_liquidity_shares > 0,
                    'has_pending_fees': total_fee_x > 0 or total_fee_y > 0,
                    'position_count': len(position_accounts),
                    'status': 'Active' if total_liquidity_shares > 0 else 'Empty',
                    'mint_x': mint_x,
                    'mint_y': mint_y,
                    'price_x': price_x,
                    'price_y': price_y
                }

                logger.info(f"  Position value: ${estimated_position_value:.2f} ({token_x_readable:.2f} X + {token_y_readable:.2f} Y)")

                positions.append(position_data)

        if not positions:
            return jsonify({
                'status': 'success',
                'positions': [],
                'message': 'No active Meteora DLMM positions found for this wallet'
            })

        return jsonify({
            'status': 'success',
            'positions': positions,
            'total_positions': len(positions)
        })
    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/opportunities/analyze', methods=['POST'])
def analyze_opportunities():
    """
    Analyze and find better pool opportunities based on whitelist and preferences
    """
    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')
        whitelist = data.get('whitelist', [])
        quote_preferences = data.get('quotePreferences', {'sol': True, 'usdc': True})
        current_positions = data.get('currentPositions', [])
        min_fees_30min = data.get('minFees30min', 100)  # Default: $100

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        if not whitelist:
            return jsonify({
                'status': 'success',
                'opportunities': [],
                'message': 'No tokens in whitelist'
            })

        logger.info(f"Analyzing opportunities for {len(whitelist)} tokens")

        # Fetch all pools from cache
        all_pools = get_pools_from_cache(limit=200)
        logger.info(f"Loaded {len(all_pools)} pools from cache for opportunities")

        # Common quote token addresses
        QUOTE_TOKENS = {
            'SOL': 'So11111111111111111111111111111111111111112',
            'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        }

        # Build allowed tokens set: whitelist + selected quote tokens
        allowed_tokens = set(whitelist)
        if quote_preferences.get('sol', False):
            allowed_tokens.add(QUOTE_TOKENS['SOL'])
        if quote_preferences.get('usdc', False):
            allowed_tokens.add(QUOTE_TOKENS['USDC'])

        logger.info(f"Allowed tokens for opportunities: {len(allowed_tokens)} tokens")
        logger.info(f"Minimum 30min fees filter: ${min_fees_30min}")

        # Filter pools: BOTH tokens must be in allowed set
        opportunities = []
        for pool in all_pools:
            mint_x = pool.get('mint_x', '')
            mint_y = pool.get('mint_y', '')

            # Both tokens must be in the allowed set (whitelist + quote tokens)
            if mint_x not in allowed_tokens or mint_y not in allowed_tokens:
                continue

            # At least one must be from whitelist (to avoid showing only SOL-USDC when you don't have positions)
            has_whitelisted_token = mint_x in whitelist or mint_y in whitelist
            if not has_whitelisted_token:
                # Allow quote-only pairs (like SOL-USDC) only if you have both quotes selected
                is_quote_pair = (mint_x in QUOTE_TOKENS.values() and mint_y in QUOTE_TOKENS.values())
                if not is_quote_pair:
                    continue

            # Determine quote token
            quote_token = 'SOL' if (mint_x == QUOTE_TOKENS['SOL'] or mint_y == QUOTE_TOKENS['SOL']) else 'USDC'

            # Calculate opportunity score (weighted combination of metrics)
            def safe_float(value, default=0.0):
                if value is None or value == '':
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default

            # Get 30-minute data
            fees_obj = pool.get('fees', {})
            volume_obj = pool.get('volume', {})
            fees_30min = safe_float(fees_obj.get('min_30', 0))
            volume_30min = safe_float(volume_obj.get('min_30', 0))
            liquidity = safe_float(pool.get('liquidity', 0))

            # Calculate 30-minute fee rate (percentage)
            fee_rate_30min = (fees_30min / liquidity * 100) if liquidity > 0 else 0

            # Skip pools with very low liquidity, volume, or fees
            if liquidity < 1000 or volume_30min < 20:  # $20 in 30min = ~$1K daily
                continue

            # Skip pools with fees below minimum threshold
            if fees_30min < min_fees_30min:
                continue

            # Calculate score based on fee rate (higher is better)
            score = fee_rate_30min

            opportunity = {
                'address': pool.get('address', ''),
                'pairName': pool.get('name', ''),
                'quoteToken': quote_token,
                'feeRate30min': fee_rate_30min,
                'fees30min': fees_30min,
                'volume30min': volume_30min,
                'liquidity': liquidity,
                'binStep': pool.get('bin_step', 0),
                'baseFee': safe_float(pool.get('base_fee_percentage', 0)),
                'score': score,
                'mint_x': mint_x,
                'mint_y': mint_y
            }

            opportunities.append(opportunity)

        # Log current positions for analysis
        logger.info("=" * 80)
        logger.info("CURRENT POSITIONS:")
        position_addresses = set()
        for pos in current_positions:
            position_addresses.add(pos.get('address', ''))
            logger.info(f"  {pos.get('pairName', 'Unknown')}")
            logger.info(f"    Address: {pos.get('address', 'Unknown')}")
            logger.info(f"    Fee Rate (30min): {safe_float(pos.get('pool_feeRate30min', 0)):.4f}%")
            logger.info(f"    30min Fees: ${safe_float(pos.get('pool_fees30min', 0)):.2f}")
            logger.info(f"    30min Volume: ${safe_float(pos.get('pool_volume30min', 0)):.2f}")
            logger.info(f"    Liquidity: ${safe_float(pos.get('pool_liquidity', 0)):.2f}")
            logger.info(f"    Value: ${safe_float(pos.get('estimated_value_usd', 0)):.2f}")

        # Filter opportunities: only show pools with better fee rates than current positions
        if current_positions:
            # Get best fee rate from current positions
            position_best_fee_rate = max([safe_float(p.get('pool_feeRate30min', 0)) for p in current_positions], default=0)

            logger.info("=" * 80)
            logger.info(f"FILTERING CRITERIA:")
            logger.info(f"  1. Exclude pools you already have positions in ({len(position_addresses)} pools)")
            logger.info(f"  2. Fee rate must be at least 30% better than best position")
            logger.info(f"")
            logger.info(f"  Best Position Fee Rate: {position_best_fee_rate:.4f}% (need >{position_best_fee_rate * 1.3:.4f}%)")
            logger.info("=" * 80)

            # Filter: opportunity must pass criteria
            MIN_IMPROVEMENT = 1.3  # Must be 30% better
            filtered_opportunities = []

            logger.info(f"EVALUATING {len(opportunities)} CANDIDATE OPPORTUNITIES:")
            for opp in opportunities:
                # Criterion 1: Exclude pools you already have positions in
                if opp['address'] in position_addresses:
                    logger.info(f"  {opp['pairName']}")
                    logger.info(f"    Result: EXCLUDED (already have position in this pool)")
                    continue

                # Criterion 2: Fee rate must be significantly better
                is_better = opp['feeRate30min'] > position_best_fee_rate * MIN_IMPROVEMENT

                logger.info(f"  {opp['pairName']}")
                logger.info(f"    Fee Rate (30min): {opp['feeRate30min']:.4f}% {'✓' if is_better else '✗'}")
                logger.info(f"    30min Fees: ${opp['fees30min']:.2f}")
                logger.info(f"    30min Volume: ${opp['volume30min']:.2f}")
                logger.info(f"    Result: {'INCLUDED' if is_better else 'FILTERED OUT'}")

                if is_better:
                    filtered_opportunities.append(opp)

            opportunities = filtered_opportunities
            logger.info("=" * 80)
            logger.info(f"FINAL: {len(opportunities)} opportunities passed the filter")

        # Sort by score (best first)
        opportunities.sort(key=lambda x: x['score'], reverse=True)

        # Limit to top 20 opportunities
        top_opportunities = opportunities[:20]

        logger.info(f"Returning {len(top_opportunities)} top opportunities")

        return jsonify({
            'status': 'success',
            'opportunities': top_opportunities,
            'total_found': len(opportunities)
        })
    except Exception as e:
        logger.error(f"Error analyzing opportunities: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/monitoring/start', methods=['POST'])
def start_monitoring():
    """
    Start automated opportunity monitoring with Telegram notifications
    Requires Telegram to be connected first
    """
    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # Check if user has linked Telegram
        db = get_db()
        user = db.query(User).filter(User.wallet_address == wallet_address).first()
        db.close()

        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Please connect your Telegram account first'
            }), 400

        config = {
            'interval_minutes': data.get('intervalMinutes', 15),
            'threshold_multiplier': data.get('thresholdMultiplier', 1.3),
            'whitelist': data.get('whitelist', []),
            'quote_preferences': data.get('quotePreferences', {'sol': True, 'usdc': True}),
            'min_fees_30min': data.get('minFees30min', 100)
        }

        success = monitoring_service.start_monitoring(wallet_address, config)

        if success:
            return jsonify({
                'status': 'success',
                'message': f'Monitoring started. Checking every {config["interval_minutes"]} minutes.',
                'config': {
                    'interval_minutes': config['interval_minutes'],
                    'threshold_multiplier': config['threshold_multiplier']
                }
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to start monitoring. Please ensure Telegram is connected.'
            }), 500

    except Exception as e:
        logger.error(f"Error starting monitoring: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/monitoring/stop', methods=['POST'])
def stop_monitoring():
    """
    Stop automated opportunity monitoring
    """
    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        success = monitoring_service.stop_monitoring(wallet_address)

        if success:
            return jsonify({
                'status': 'success',
                'message': 'Monitoring stopped'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to stop monitoring'
            }), 500

    except Exception as e:
        logger.error(f"Error stopping monitoring: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/monitoring/status', methods=['POST'])
def get_monitoring_status():
    """
    Get monitoring status for a wallet
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        status = monitoring_service.get_monitoring_status(wallet_address)

        return jsonify({
            'status': 'success',
            'monitoring': status
        })

    except Exception as e:
        logger.error(f"Error getting monitoring status: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/telegram/generate-code', methods=['POST'])
def generate_telegram_code():
    """
    Generate a temporary 6-digit code for Telegram authentication
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # Generate random 6-digit code
        code = ''.join(random.choices(string.digits, k=6))

        # Check if code already exists (very unlikely)
        db = get_db()
        try:
            while db.query(TelegramAuthCode).filter(TelegramAuthCode.code == code).first():
                code = ''.join(random.choices(string.digits, k=6))

            # Create auth code entry (expires in 5 minutes)
            auth_code = TelegramAuthCode(
                code=code,
                wallet_address=wallet_address,
                expires_at=datetime.utcnow() + timedelta(minutes=5)
            )
            db.add(auth_code)
            db.commit()
        finally:
            db.close()

        # Generate bot link
        bot_link = get_bot_link(code)

        logger.info(f"Generated auth code for wallet {wallet_address}")

        return jsonify({
            'status': 'success',
            'code': code,
            'botLink': bot_link,
            'expiresIn': 300  # 5 minutes in seconds
        })

    except Exception as e:
        logger.error(f"Error generating auth code: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/telegram/connection-status', methods=['POST'])
def check_telegram_connection():
    """
    Check if a wallet has linked their Telegram account
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        db = get_db()
        user = db.query(User).filter(User.wallet_address == wallet_address).first()
        db.close()

        if user:
            return jsonify({
                'status': 'success',
                'connected': True,
                'telegram_username': user.telegram_username,
                'connected_at': user.created_at.isoformat() if user.created_at else None
            })
        else:
            return jsonify({
                'status': 'success',
                'connected': False
            })

    except Exception as e:
        logger.error(f"Error checking Telegram connection: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/monitoring/debug', methods=['GET'])
def debug_monitoring_status():
    """
    Debug endpoint to check scheduler status
    """
    try:
        jobs = monitoring_service.scheduler.get_jobs()
        jobs_info = []

        for job in jobs:
            jobs_info.append({
                'id': job.id,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger),
                'func_name': job.func.__name__
            })

        return jsonify({
            'status': 'success',
            'scheduler_running': monitoring_service.scheduler.running,
            'scheduler_state': monitoring_service.scheduler.state,
            'total_jobs': len(jobs),
            'jobs': jobs_info
        })

    except Exception as e:
        logger.error(f"Error getting debug info: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/degen/debug', methods=['GET'])
def debug_degen_monitoring():
    """
    Debug endpoint to check Degen Mode scheduler status and database configs
    """
    try:
        # Get scheduler jobs
        jobs = degen_monitoring_service.scheduler.get_jobs()
        jobs_info = []

        for job in jobs:
            jobs_info.append({
                'id': job.id,
                'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger),
                'func_name': job.func.__name__
            })

        # Get database configs
        db = get_db()
        try:
            configs = db.query(DegenConfig).all()
            configs_info = []

            for config in configs:
                configs_info.append({
                    'wallet_address': f"{config.wallet_address[:8]}...{config.wallet_address[-6:]}",
                    'degen_wallet': f"{config.degen_wallet_address[:8]}...{config.degen_wallet_address[-6:]}",
                    'enabled': config.enabled,
                    'threshold': float(config.min_fee_rate_threshold),
                    'interval_minutes': config.check_interval_minutes,
                    'last_check': config.last_check.isoformat() if config.last_check else None,
                    'next_check': config.next_check.isoformat() if config.next_check else None
                })

            enabled_count = sum(1 for c in configs if c.enabled)
        finally:
            db.close()

        return jsonify({
            'status': 'success',
            'scheduler': {
                'running': degen_monitoring_service.scheduler.running,
                'state': degen_monitoring_service.scheduler.state,
                'total_jobs': len(jobs),
                'jobs': jobs_info
            },
            'database': {
                'total_configs': len(configs),
                'enabled_configs': enabled_count,
                'configs': configs_info
            }
        })

    except Exception as e:
        logger.error(f"Error getting degen debug info: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/cache/stats', methods=['GET'])
def get_cache_stats():
    """
    Get pool cache statistics
    """
    try:
        if USE_GROUPED_CACHE:
            stats = grouped_pool_cache.get_stats()
            cache_type = 'GroupedPoolCache'
        else:
            stats = pool_cache.get_stats()
            cache_type = 'PoolDataCache'

        return jsonify({
            'status': 'success',
            'cache_type': cache_type,
            'cache': stats
        })
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/telegram/disconnect', methods=['POST'])
def disconnect_telegram():
    """
    Disconnect Telegram account from wallet
    """
    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        db = get_db()
        user = db.query(User).filter(User.wallet_address == wallet_address).first()

        if user:
            # Stop monitoring first
            monitoring_service.stop_monitoring(wallet_address)

            # Delete user (cascade will delete everything)
            db.delete(user)
            db.commit()

            logger.info(f"Disconnected Telegram for wallet {wallet_address}")

            db.close()
            return jsonify({
                'status': 'success',
                'message': 'Telegram account disconnected'
            })
        else:
            db.close()
            return jsonify({
                'status': 'error',
                'message': 'No Telegram account linked'
            }), 404

    except Exception as e:
        logger.error(f"Error disconnecting Telegram: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# ============================================
# DEGEN MODE API ENDPOINTS
# ============================================

@app.route('/api/degen/wallet/generate', methods=['POST'])
def generate_degen_wallet():
    """
    Generate a new Solana wallet for degen mode
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # Verify user exists and has Telegram linked
        db = get_db()
        try:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()

            if not user:
                return jsonify({
                    'status': 'error',
                    'message': 'User not found. Please link Telegram first.'
                }), 404

            # Generate new wallet
            wallet_data = WalletManager.generate_wallet()

            # Check if degen config already exists
            existing_config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address
            ).first()

            if existing_config:
                # Update existing config
                existing_config.wallet_type = 'generated'
                existing_config.degen_wallet_address = wallet_data['public_key']
                existing_config.encrypted_private_key = wallet_data['encrypted_private_key']
                existing_config.updated_at = datetime.utcnow()
            else:
                # Create new config
                config = DegenConfig(
                    wallet_address=wallet_address,
                    wallet_type='generated',
                    degen_wallet_address=wallet_data['public_key'],
                    encrypted_private_key=wallet_data['encrypted_private_key']
                )
                db.add(config)

            db.commit()

            logger.info(f"Generated degen wallet for {wallet_address}")

            return jsonify({
                'status': 'success',
                'message': 'Wallet generated successfully',
                'publicKey': wallet_data['public_key'],
                'privateKey': wallet_data['private_key']  # Return only once for user to save
            })
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error generating degen wallet: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/degen/wallet/import', methods=['POST'])
def import_degen_wallet():
    """
    Import an existing Solana wallet for degen mode
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')
        private_key = data.get('privateKey')

        if not wallet_address or not private_key:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address and private key are required'
            }), 400

        # Verify user exists and has Telegram linked
        db = get_db()
        try:
            user = db.query(User).filter(User.wallet_address == wallet_address).first()

            if not user:
                return jsonify({
                    'status': 'error',
                    'message': 'User not found. Please link Telegram first.'
                }), 404

            # Import wallet
            try:
                wallet_data = WalletManager.import_wallet(private_key)
            except ValueError as ve:
                return jsonify({
                    'status': 'error',
                    'message': f'Invalid private key: {str(ve)}'
                }), 400

            # Check if degen config already exists
            existing_config = db.query(DegenConfig).filter(
                DegenConfig.wallet_address == wallet_address
            ).first()

            if existing_config:
                # Update existing config
                existing_config.wallet_type = 'imported'
                existing_config.degen_wallet_address = wallet_data['public_key']
                existing_config.encrypted_private_key = wallet_data['encrypted_private_key']
                existing_config.updated_at = datetime.utcnow()
            else:
                # Create new config
                config = DegenConfig(
                    wallet_address=wallet_address,
                    wallet_type='imported',
                    degen_wallet_address=wallet_data['public_key'],
                    encrypted_private_key=wallet_data['encrypted_private_key']
                )
                db.add(config)

            db.commit()

            logger.info(f"Imported degen wallet for {wallet_address}")

            return jsonify({
                'status': 'success',
                'message': 'Wallet imported successfully',
                'publicKey': wallet_data['public_key']
            })
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error importing degen wallet: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/degen/monitoring/start', methods=['POST'])
def start_degen_monitoring():
    """
    Start degen mode monitoring
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')
        threshold = data.get('threshold', 5.0)

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # Start monitoring
        success = degen_monitoring_service.start_monitoring(wallet_address, threshold)

        if success:
            logger.info(f"Started degen monitoring for {wallet_address} with threshold {threshold}%")
            return jsonify({
                'status': 'success',
                'message': 'Degen monitoring started'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to start degen monitoring. Check if wallet is set up.'
            }), 400

    except Exception as e:
        logger.error(f"Error starting degen monitoring: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/degen/monitoring/stop', methods=['POST'])
def stop_degen_monitoring():
    """
    Stop degen mode monitoring
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # Stop monitoring
        success = degen_monitoring_service.stop_monitoring(wallet_address)

        if success:
            logger.info(f"Stopped degen monitoring for {wallet_address}")
            return jsonify({
                'status': 'success',
                'message': 'Degen monitoring stopped'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to stop degen monitoring'
            }), 400

    except Exception as e:
        logger.error(f"Error stopping degen monitoring: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/degen/monitoring/status', methods=['GET'])
def get_degen_monitoring_status():
    """
    Get degen mode monitoring status
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        wallet_address = request.args.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        # Get status
        status = degen_monitoring_service.get_monitoring_status(wallet_address)

        return jsonify({
            'status': 'success',
            'data': status
        })

    except Exception as e:
        logger.error(f"Error getting degen monitoring status: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/degen/config', methods=['PATCH'])
def update_degen_config():
    """
    Update degen mode configuration (threshold)
    """
    if not DATABASE_ENABLED:
        return jsonify({
            'status': 'error',
            'message': 'Database features not enabled'
        }), 503

    try:
        data = request.get_json()
        wallet_address = data.get('walletAddress')
        threshold = data.get('threshold')

        if not wallet_address or threshold is None:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address and threshold are required'
            }), 400

        # Validate threshold
        if threshold <= 0 or threshold > 100:
            return jsonify({
                'status': 'error',
                'message': 'Threshold must be between 0.1 and 100'
            }), 400

        # Update threshold
        success = degen_monitoring_service.update_threshold(wallet_address, threshold)

        if success:
            logger.info(f"Updated degen threshold to {threshold}% for {wallet_address}")
            return jsonify({
                'status': 'success',
                'message': 'Threshold updated successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to update threshold'
            }), 400

    except Exception as e:
        logger.error(f"Error updating degen config: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/api/wallet/balance', methods=['GET'])
def get_wallet_balance():
    """
    Get SOL and USDC balance for a wallet address
    """
    try:
        wallet_address = request.args.get('walletAddress')

        if not wallet_address:
            return jsonify({
                'status': 'error',
                'message': 'Wallet address is required'
            }), 400

        from solana.rpc.api import Client
        from solders.pubkey import Pubkey

        # Initialize Solana RPC client
        rpc_url = os.getenv('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
        client = Client(rpc_url)

        # Get SOL balance
        pubkey = Pubkey.from_string(wallet_address)
        sol_balance_lamports = client.get_balance(pubkey).value
        sol_balance = sol_balance_lamports / 1e9  # Convert lamports to SOL

        # Get USDC balance
        # USDC mint address on Solana mainnet
        usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

        # Get token accounts for this wallet
        from solana.rpc.commitment import Confirmed
        from solana.rpc.types import TokenAccountOpts

        response = client.get_token_accounts_by_owner(
            pubkey,
            TokenAccountOpts(mint=Pubkey.from_string(usdc_mint)),
            commitment=Confirmed
        )

        usdc_balance = 0
        if response.value:
            for account in response.value:
                # Parse token account data
                import base64
                data = base64.b64decode(account.account.data)
                # Token amount is at offset 64, 8 bytes (little-endian)
                if len(data) >= 72:
                    amount = int.from_bytes(data[64:72], byteorder='little')
                    usdc_balance += amount / 1e6  # USDC has 6 decimals

        return jsonify({
            'status': 'success',
            'data': {
                'sol': sol_balance,
                'usdc': usdc_balance
            }
        })

    except Exception as e:
        logger.error(f"Error fetching wallet balance: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


def start_telegram_bot():
    """Start Telegram bot in background thread"""
    try:
        logger.info("Starting Telegram bot in background...")
        telegram_bot_handler.start_polling()
    except Exception as e:
        logger.error(f"Error starting Telegram bot: {e}")


def initialize_app():
    """Initialize application components"""
    try:
        # Create performance indexes
        db = get_db()
        create_performance_indexes(db)
        db.close()

        # Load active capital rotation monitors from database
        logger.info("Loading active capital rotation monitors from database...")
        monitoring_service.load_active_monitors()

        # Load active degen mode monitors from database
        logger.info("Loading active degen mode monitors from database...")
        degen_monitoring_service.load_active_monitors()

        # Start Telegram bot in background thread
        # Note: This only works with use_reloader=False (see bottom of file)
        bot_thread = threading.Thread(target=start_telegram_bot, daemon=True)
        bot_thread.start()
        logger.info("Telegram bot thread started")

        # Clean up expired auth codes
        db = get_db()
        cleaned = cleanup_expired_auth_codes(db)
        db.close()
        logger.info(f"Cleaned up {cleaned} expired auth codes")

        logger.info("Application initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing application: {e}")


# Initialize app when module is imported (works with Gunicorn)
# This ensures monitoring services and Telegram bot start correctly
if DATABASE_ENABLED:
    initialize_app()
else:
    logger.info("Skipping database initialization (analytics-only mode)")


if __name__ == '__main__':
    # Warm up the cache on startup to avoid cold start delays
    logger.info("Warming up pool cache on startup...")
    try:
        pools = get_pools_from_cache(force_refresh=True)
        logger.info(f"✅ Cache warmed successfully with {len(pools)} pools")
    except Exception as e:
        logger.error(f"⚠️ Failed to warm cache on startup: {e}")
        logger.warning("App will start anyway, but first request may be slow")

    # Start Flask server
    port = int(os.environ.get('PORT', 5000))
    # Note: use_reloader=False to avoid Telegram bot threading issues
    # Set to True if you need auto-reload during development (but bot won't work)
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)