from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import requests
import pandas as pd
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# More detailed CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": ["https://www.imded.fun", "https://imded.fun", "http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "max_age": 600
    }
})

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    return response

def process_pairs_data(data):
    try:
        logger.info(f"Processing {len(data)} pairs")
        
        # Log sample of raw data to see the actual field names
        if data:
            logger.info(f"Sample raw pair data fields: {list(data[0].keys())}")
        
        df = pd.DataFrame(data)
        
        selected_columns = [
            'address',
            'name',
            'current_price',
            'volume',
            'fees_24h',
            'fees',
            'apr',
            'liquidity',
            'cumulative_trade_volume',
            'fee_tvl_ratio',
            'bin_step',
            'base_fee_percentage',
            'is_blacklisted',
            'mint_x',  # Changed from tokenX to mint_x
            'mint_y'   # Changed from tokenY to mint_y
        ]
        
        df_selected = df[selected_columns]
        
        # Get 30-minute volume and fees
        df_selected['volume_30min'] = df_selected['volume'].apply(lambda x: x.get('min_30', 0) if isinstance(x, dict) else 0)
        df_selected['fees_30min'] = df_selected['fees'].apply(lambda x: x.get('min_30', 0) if isinstance(x, dict) else 0)
        df_selected['fee_tvl_30min'] = df_selected['fee_tvl_ratio'].apply(lambda x: x.get('min_30', 0) if isinstance(x, dict) else 0)
        
        df_selected = df_selected.rename(columns={
            'address': 'address',
            'name': 'pairName',
            'current_price': 'price',
            'volume_30min': 'volume30min',
            'fees_30min': 'fees30min',
            'fees_24h': 'fees24h',
            'apr': 'apr',
            'liquidity': 'totalLiquidity',
            'cumulative_trade_volume': 'totalVolume',
            'fee_tvl_30min': 'feeTvlRatio30min',
            'bin_step': 'binStep',
            'base_fee_percentage': 'baseFee',
            'is_blacklisted': 'is_blacklisted',
            'mint_x': 'tokenX',  # Rename mint_x to tokenX
            'mint_y': 'tokenY'   # Rename mint_y to tokenY
        })
        
        # Drop unnecessary columns
        df_selected = df_selected.drop(['volume', 'fee_tvl_ratio', 'fees'], axis=1)
        
        # Format numeric columns
        df_selected['price'] = df_selected['price'].round(6)
        df_selected['volume30min'] = df_selected['volume30min'].round(2)
        df_selected['fees30min'] = df_selected['fees30min'].round(2)
        df_selected['fees24h'] = df_selected['fees24h'].round(2)
        df_selected['apr'] = df_selected['apr'].round(2)
        df_selected['totalLiquidity'] = df_selected['totalLiquidity'].round(2)
        df_selected['totalVolume'] = df_selected['totalVolume'].round(2)
        df_selected['feeTvlRatio30min'] = df_selected['feeTvlRatio30min'].round(6)
        df_selected['baseFee'] = df_selected['baseFee'].round(2)
        
        processed_data = df_selected.to_dict('records')
        
        # Log a sample of processed data to verify token addresses
        if processed_data:
            logger.info(f"Sample processed pair with token addresses: {processed_data[0]}")
            
        return processed_data
    except Exception as e:
        logger.error(f"Error processing data: {str(e)}")
        raise

@app.route('/api/pairs', methods=['GET'])
def get_pairs():
    try:
        url = "https://dlmm-api.meteora.ag/pair/all"
        headers = {
            "accept": "application/json",
            "Cache-Control": "no-cache"  # Prevent caching
        }
        
        logger.info(f"Fetching data from {url}")
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        logger.info(f"Received {len(data)} pairs from API")
        
        # Process the data
        processed_data = process_pairs_data(data)
        
        return jsonify({
            'status': 'success',
            'data': processed_data,
            'count': len(processed_data),
            'timestamp': pd.Timestamp.now().isoformat()
        })
    except requests.RequestException as e:
        logger.error(f"API request error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"API request failed: {str(e)}"
        }), 500
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f"Server error: {str(e)}"
        }), 500

@app.route('/api/pairs/search', methods=['GET'])
def search_pairs():
    try:
        # Get search parameters
        search_term = request.args.get('q', '').upper()
        min_volume = float(request.args.get('min_volume', 0))
        min_apr = float(request.args.get('min_apr', 0))
        
        logger.info(f"Searching pairs with term: {search_term}, min_volume: {min_volume}, min_apr: {min_apr}")
        
        # Fetch data from API
        url = "https://dlmm-api.meteora.ag/pair/all"
        response = requests.get(url, headers={"accept": "application/json"})
        data = response.json()
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Apply filters
        if search_term:
            df = df[df['name'].str.contains(search_term, na=False)]
            logger.info(f"Found {len(df)} pairs matching search term: {search_term}")
            
        if min_volume > 0:
            df = df[df['volume'].apply(lambda x: x.get('min_30', 0) if isinstance(x, dict) else 0) >= min_volume]
            logger.info(f"Found {len(df)} pairs with minimum volume: {min_volume}")
            
        if min_apr > 0:
            df = df[df['apr'] >= min_apr]
            logger.info(f"Found {len(df)} pairs with minimum APR: {min_apr}")
            
        # Process and return filtered data
        processed_data = process_pairs_data(df.to_dict('records'))
        
        return jsonify({
            'status': 'success',
            'data': processed_data,
            'count': len(processed_data),
            'filters': {
                'search_term': search_term,
                'min_volume': min_volume,
                'min_apr': min_apr
            },
            'timestamp': pd.Timestamp.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': pd.Timestamp.now().isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)