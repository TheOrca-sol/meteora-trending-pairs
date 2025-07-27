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
CORS(app, resources={r"/*": {"origins": "https://www.imded.fun"}})

def process_pairs_data(data):
    try:
        # Clear memory
        gc.collect()
        
        # Take only first 10 pairs to minimize memory usage
        limited_data = data[:10]
        
        # Process data without pandas
        processed_pairs = []
        for pair in limited_data:
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
        
        return processed_pairs
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        raise

@app.route('/api/pairs', methods=['GET'])
def get_pairs():
    try:
        # Fetch data with minimal timeout
        response = requests.get(
            "https://dlmm-api.meteora.ag/pair/all",
            headers={"accept": "application/json"},
            timeout=15
        )
        response.raise_for_status()
        
        # Get data and immediately limit it
        data = response.json()[:10]  # Limit before processing
        
        # Process data
        processed_data = process_pairs_data(data)
        
        # Clear memory
        del data
        gc.collect()
        
        return jsonify({
            'status': 'success',
            'data': processed_data,
            'count': len(processed_data)
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