from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import logging
import os
import gc

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://www.imded.fun", "https://imded.fun", "http://localhost:3000", "http://localhost:5000"]}})

def process_pairs_data(data, page=1, limit=50, search_term=None, min_liquidity=0, sort_by='fees_24h'):
    try:
        # Clear memory
        gc.collect()
        
        logger.info(f"Processing {len(data)} pairs with filters: page={page}, limit={limit}, search={search_term}, min_liquidity={min_liquidity}")
        
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
        
        # Sort data
        def safe_float(value, default=0.0):
            """Safely convert value to float, handling empty strings and None"""
            if value is None or value == '':
                return default
            try:
                return float(value)
            except (ValueError, TypeError):
                return default
        
        sort_key = {
            'fees_24h': lambda x: safe_float(x.get('fees_24h', 0)),
            'liquidity': lambda x: safe_float(x.get('liquidity', 0)),
            'apr': lambda x: safe_float(x.get('apr', 0)),
            'volume': lambda x: safe_float(x.get('cumulative_trade_volume', 0)),
            'name': lambda x: str(x.get('name', ''))
        }.get(sort_by, lambda x: safe_float(x.get('fees_24h', 0)))
        
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
                processed_pair = {
                    'address': pair.get('address', ''),
                    'pairName': pair.get('name', ''),
                    'price': safe_float(pair.get('current_price', 0)),
                    'fees24h': safe_float(pair.get('fees_24h', 0)),
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
        
        sort_by = request.args.get('sort_by', 'fees_24h')
        
        logger.info(f"API request: page={page}, limit={limit}, search='{search_term}', min_liquidity={min_liquidity}, sort_by={sort_by}")
        
        # Fetch data
        logger.info("Fetching data from Meteora API...")
        response = requests.get(
            "https://dlmm-api.meteora.ag/pair/all",
            headers={"accept": "application/json"},
            timeout=15
        )
        response.raise_for_status()
        
        # Get full data and process with pagination
        data = response.json()
        logger.info(f"Received {len(data)} pairs from Meteora API")
        
        # Process data with pagination and filtering
        result = process_pairs_data(data, page, limit, search_term, min_liquidity, sort_by)
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

        # Fetch all pools from Meteora API
        logger.info("Fetching pools from Meteora API...")
        pools_response = requests.get(
            "https://dlmm-api.meteora.ag/pair/all",
            headers={"accept": "application/json"},
            timeout=15
        )
        pools_response.raise_for_status()
        all_pools = pools_response.json()
        logger.info(f"Loaded {len(all_pools)} pools")

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

        # Fetch all pools from Meteora
        response = requests.get(
            "https://dlmm-api.meteora.ag/pair/all",
            headers={"accept": "application/json"},
            timeout=15
        )
        response.raise_for_status()
        all_pools = response.json()

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)