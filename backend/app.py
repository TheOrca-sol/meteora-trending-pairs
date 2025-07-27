from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import pandas as pd
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
        
        # Take only first 25 pairs to ensure we stay within memory limits
        limited_data = data[:25]
        
        # Convert to DataFrame with minimal columns
        df = pd.DataFrame(limited_data)[['address', 'name', 'current_price', 'fees_24h', 'apr', 'liquidity', 'bin_step', 'base_fee_percentage', 'is_blacklisted', 'mint_x', 'mint_y']]
        
        # Rename columns
        df = df.rename(columns={
            'name': 'pairName',
            'current_price': 'price',
            'liquidity': 'totalLiquidity',
            'bin_step': 'binStep',
            'base_fee_percentage': 'baseFee'
        })
        
        # Convert to records
        result = df.to_dict('records')
        
        # Clear memory
        del df
        gc.collect()
        
        return result
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        raise

@app.route('/api/pairs', methods=['GET'])
def get_pairs():
    try:
        # Fetch data
        response = requests.get(
            "https://dlmm-api.meteora.ag/pair/all",
            headers={"accept": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        
        # Process data
        data = response.json()
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