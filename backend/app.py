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
            filtered_data = [
                pair for pair in filtered_data 
                if float(pair.get('liquidity', 0) or 0) >= min_liquidity
            ]
            logger.info(f"After liquidity filter: {len(filtered_data)} pairs")
        
        # Sort data
        sort_key = {
            'fees_24h': lambda x: float(x.get('fees_24h', 0) or 0),
            'liquidity': lambda x: float(x.get('liquidity', 0) or 0),
            'apr': lambda x: float(x.get('apr', 0) or 0),
            'volume': lambda x: float(x.get('cumulative_trade_volume', 0) or 0),
            'name': lambda x: str(x.get('name', ''))
        }.get(sort_by, lambda x: float(x.get('fees_24h', 0) or 0))
        
        sorted_data = sorted(filtered_data, key=sort_key, reverse=True)
        
        # Calculate pagination
        total_pairs = len(sorted_data)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        
        # Get the page slice
        page_data = sorted_data[start_idx:end_idx]
        logger.info(f"Page {page}: showing {len(page_data)} pairs (total: {total_pairs})")
        
        # Process only the page data
        processed_pairs = []
        for pair in page_data:
            try:
                processed_pair = {
                    'address': pair.get('address', ''),
                    'pairName': pair.get('name', ''),
                    'price': float(pair.get('current_price', 0) or 0),
                    'fees24h': float(pair.get('fees_24h', 0) or 0),
                    'apr': float(pair.get('apr', 0) or 0),
                    'totalLiquidity': float(pair.get('liquidity', 0) or 0),
                    'binStep': int(pair.get('bin_step', 0) or 0),
                    'baseFee': float(pair.get('base_fee_percentage', 0) or 0),
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
        # Get pagination and filter parameters
        page = int(request.args.get('page', 1))
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 per page
        search_term = request.args.get('search', '')
        min_liquidity = float(request.args.get('min_liquidity', 0))
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)