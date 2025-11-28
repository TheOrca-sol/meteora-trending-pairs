"""
Liquidity Management API Routes
Handles adding/removing liquidity, position management, and automation
"""

from flask import Blueprint, request, jsonify
from models import (
    get_db, LiquidityPosition, PositionAutomationRules,
    AutomationConfig, LiquidityTransaction, PoolFavorite
)
from sqlalchemy import desc
from datetime import datetime
import logging
import os
import requests

logger = logging.getLogger(__name__)

# Create Blueprint
liquidity_bp = Blueprint('liquidity', __name__, url_prefix='/api/liquidity')


# ============================================
# POSITIONS ENDPOINTS
# ============================================

@liquidity_bp.route('/positions', methods=['GET'])
def get_positions():
    """Get all positions for a wallet with live data from Meteora"""
    try:
        wallet_address = request.args.get('walletAddress')
        if not wallet_address:
            return jsonify({'error': 'walletAddress is required'}), 400

        status_filter = request.args.get('status', 'active')  # 'active', 'closed', 'all'

        db = get_db()
        try:
            query = db.query(LiquidityPosition).filter_by(wallet_address=wallet_address)

            if status_filter != 'all':
                query = query.filter_by(status=status_filter)

            positions = query.order_by(desc(LiquidityPosition.created_at)).all()

            # Fetch live data for each position from Meteora service
            result = []
            meteora_service_url = os.getenv('METEORA_SERVICE_URL', 'http://localhost:3002')

            for position in positions:
                pos_dict = position.to_dict()

                # Get automation rules
                rules = db.query(PositionAutomationRules).filter_by(
                    position_address=position.position_address
                ).first()
                pos_dict['automation_rules'] = rules.to_dict() if rules else None

                # Fetch live position data from Meteora service
                try:
                    response = requests.post(
                        f'{meteora_service_url}/position/data',
                        json={
                            'positionAddress': position.position_address,
                            'poolAddress': position.pool_address
                        },
                        timeout=5
                    )

                    if response.status_code == 200:
                        live_data = response.json()

                        # Update current amounts
                        pos_dict['current_amount_x'] = live_data['currentAmountX']
                        pos_dict['current_amount_y'] = live_data['currentAmountY']
                        pos_dict['fees_earned_x'] = live_data['feesEarnedX']
                        pos_dict['fees_earned_y'] = live_data['feesEarnedY']

                        # Fetch token prices from Jupiter
                        try:
                            price_response = requests.get(
                                f'https://api.jup.ag/price/v2?ids={position.token_x_mint},{position.token_y_mint}',
                                timeout=3
                            )
                            if price_response.status_code == 200:
                                prices = price_response.json().get('data', {})
                                price_x = prices.get(position.token_x_mint, {}).get('price', 0)
                                price_y = prices.get(position.token_y_mint, {}).get('price', 0)

                                # Calculate USD values
                                current_liquidity_usd = (live_data['currentAmountX'] * price_x) + (live_data['currentAmountY'] * price_y)
                                fees_earned_usd = (live_data['feesEarnedX'] * price_x) + (live_data['feesEarnedY'] * price_y)
                                initial_liquidity_usd = (position.initial_amount_x * price_x) + (position.initial_amount_y * price_y)

                                pos_dict['current_liquidity_usd'] = current_liquidity_usd
                                pos_dict['fees_earned_usd'] = fees_earned_usd
                                pos_dict['unrealized_pnl_usd'] = current_liquidity_usd - initial_liquidity_usd + fees_earned_usd

                        except Exception as price_error:
                            logger.error(f"Error fetching prices: {str(price_error)}")

                except Exception as meteora_error:
                    logger.error(f"Error fetching live data for position {position.position_address}: {str(meteora_error)}")
                    # Keep using database values if live fetch fails

                result.append(pos_dict)

            return jsonify({
                'success': True,
                'positions': result
            })

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        return jsonify({'error': str(e)}), 500


@liquidity_bp.route('/positions/<position_address>', methods=['GET'])
def get_position_details(position_address):
    """Get detailed information for a specific position"""
    try:
        db = get_db()
        try:
            position = db.query(LiquidityPosition).filter_by(
                position_address=position_address
            ).first()

            if not position:
                return jsonify({'error': 'Position not found'}), 404

            pos_dict = position.to_dict()

            # Get automation rules
            rules = db.query(PositionAutomationRules).filter_by(
                position_address=position_address
            ).first()

            pos_dict['automation_rules'] = rules.to_dict() if rules else None

            # Get transaction history for this position
            transactions = db.query(LiquidityTransaction).filter_by(
                position_address=position_address
            ).order_by(desc(LiquidityTransaction.created_at)).all()

            pos_dict['transactions'] = [tx.to_dict() for tx in transactions]

            return jsonify({
                'success': True,
                'position': pos_dict
            })

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error fetching position details: {str(e)}")
        return jsonify({'error': str(e)}), 500


@liquidity_bp.route('/positions', methods=['POST'])
def create_position():
    """
    Create a new liquidity position
    This is called AFTER the user signs the transaction on frontend
    """
    try:
        data = request.json

        required_fields = [
            'walletAddress', 'poolAddress', 'positionAddress',
            'tokenXMint', 'tokenYMint', 'amountX', 'amountY',
            'lowerPrice', 'upperPrice', 'lowerBinId', 'upperBinId',
            'transactionSignature'
        ]

        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        db = get_db()
        try:
            # Create position record
            # Handle amounts - use 0 if not provided or 0 (not None)
            amount_x = data.get('amountX', 0) if data.get('amountX') is not None else 0
            amount_y = data.get('amountY', 0) if data.get('amountY') is not None else 0

            position = LiquidityPosition(
                position_address=data['positionAddress'],
                wallet_address=data['walletAddress'],
                pool_address=data['poolAddress'],
                token_x_mint=data['tokenXMint'],
                token_y_mint=data['tokenYMint'],
                token_x_symbol=data.get('tokenXSymbol'),
                token_y_symbol=data.get('tokenYSymbol'),
                initial_amount_x=amount_x,
                initial_amount_y=amount_y,
                initial_liquidity_usd=data.get('liquidityUsd', 0),
                current_amount_x=amount_x,
                current_amount_y=amount_y,
                current_liquidity_usd=data.get('liquidityUsd', 0),
                lower_price=data['lowerPrice'],
                upper_price=data['upperPrice'],
                lower_bin_id=data['lowerBinId'],
                upper_bin_id=data['upperBinId'],
                active_bin_id_at_creation=data.get('activeBinId'),
                strategy_name=data.get('strategyName'),
                creation_tx_signature=data['transactionSignature'],
                position_type=data.get('positionType', 'manual'),
                status='active'
            )

            db.add(position)

            # Create transaction record
            transaction = LiquidityTransaction(
                wallet_address=data['walletAddress'],
                pool_address=data['poolAddress'],
                position_address=data['positionAddress'],
                transaction_type='add_liquidity',
                amount_x=amount_x,
                amount_y=amount_y,
                amount_usd=data.get('liquidityUsd', 0),
                transaction_signature=data['transactionSignature'],
                status='confirmed',
                execution_mode='manual',
                triggered_by='user',
                confirmed_at=datetime.utcnow(),
                metadata=data.get('metadata')
            )

            db.add(transaction)

            # Create automation rules if provided
            automation_rules_data = data.get('automationRules')
            if automation_rules_data:
                rules = PositionAutomationRules(
                    position_address=data['positionAddress'],
                    wallet_address=data['walletAddress'],
                    take_profit_enabled=automation_rules_data.get('takeProfitEnabled', False),
                    take_profit_type=automation_rules_data.get('takeProfitType'),
                    take_profit_value=automation_rules_data.get('takeProfitValue'),
                    stop_loss_enabled=automation_rules_data.get('stopLossEnabled', False),
                    stop_loss_type=automation_rules_data.get('stopLossType'),
                    stop_loss_value=automation_rules_data.get('stopLossValue'),
                    auto_compound_enabled=automation_rules_data.get('autoCompoundEnabled', False),
                    compound_frequency_hours=automation_rules_data.get('compoundFrequencyHours', 24),
                    compound_min_threshold_usd=automation_rules_data.get('compoundMinThresholdUsd', 10.0),
                    rebalancing_enabled=automation_rules_data.get('rebalancingEnabled', False),
                    rebalance_triggers=automation_rules_data.get('rebalanceTriggers', [])
                )
                db.add(rules)

            db.commit()

            logger.info(f"Position created: {data['positionAddress']} for wallet {data['walletAddress']}")

            return jsonify({
                'success': True,
                'position': position.to_dict()
            })

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error creating position: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================
# AUTOMATION RULES ENDPOINTS
# ============================================

@liquidity_bp.route('/positions/<position_address>/automation', methods=['PUT'])
def update_automation_rules(position_address):
    """Update automation rules for a position"""
    try:
        data = request.json

        db = get_db()
        try:
            # Check if position exists
            position = db.query(LiquidityPosition).filter_by(
                position_address=position_address
            ).first()

            if not position:
                return jsonify({'error': 'Position not found'}), 404

            # Get or create automation rules
            rules = db.query(PositionAutomationRules).filter_by(
                position_address=position_address
            ).first()

            if not rules:
                rules = PositionAutomationRules(
                    position_address=position_address,
                    wallet_address=position.wallet_address
                )
                db.add(rules)

            # Update fields
            if 'takeProfitEnabled' in data:
                rules.take_profit_enabled = data['takeProfitEnabled']
            if 'takeProfitType' in data:
                rules.take_profit_type = data['takeProfitType']
            if 'takeProfitValue' in data:
                rules.take_profit_value = data['takeProfitValue']

            if 'stopLossEnabled' in data:
                rules.stop_loss_enabled = data['stopLossEnabled']
            if 'stopLossType' in data:
                rules.stop_loss_type = data['stopLossType']
            if 'stopLossValue' in data:
                rules.stop_loss_value = data['stopLossValue']

            if 'autoCompoundEnabled' in data:
                rules.auto_compound_enabled = data['autoCompoundEnabled']
            if 'compoundFrequencyHours' in data:
                rules.compound_frequency_hours = data['compoundFrequencyHours']
            if 'compoundMinThresholdUsd' in data:
                rules.compound_min_threshold_usd = data['compoundMinThresholdUsd']

            if 'rebalancingEnabled' in data:
                rules.rebalancing_enabled = data['rebalancingEnabled']
            if 'rebalanceTriggers' in data:
                rules.rebalance_triggers = data['rebalanceTriggers']

            db.commit()

            return jsonify({
                'success': True,
                'automation_rules': rules.to_dict()
            })

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error updating automation rules: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================
# GLOBAL AUTOMATION CONFIG ENDPOINTS
# ============================================

@liquidity_bp.route('/automation/config', methods=['GET'])
def get_automation_config():
    """Get global automation config for a wallet"""
    try:
        wallet_address = request.args.get('walletAddress')
        if not wallet_address:
            return jsonify({'error': 'walletAddress is required'}), 400

        db = get_db()
        try:
            config = db.query(AutomationConfig).filter_by(
                wallet_address=wallet_address
            ).first()

            if not config:
                # Return default config
                return jsonify({
                    'success': True,
                    'config': {
                        'wallet_address': wallet_address,
                        'automation_enabled': False,
                        'default_strategy': 'Follow the Herd',
                        'max_position_size_percentage': 10.0,
                        'min_rugcheck_score': 50,
                        'auto_close_on_security_drop': True,
                        'security_drop_threshold': 30,
                        'default_take_profit_percentage': 50.0,
                        'default_stop_loss_percentage': -25.0,
                        'default_auto_compound': True,
                        'default_compound_frequency_hours': 24,
                        'default_compound_threshold_usd': 10.0,
                        'default_rebalancing_enabled': True,
                        'default_rebalance_triggers': [{'type': 'price_drift', 'value': 10}],
                        'notify_on_open': True,
                        'notify_on_close': True,
                        'notify_on_take_profit': True,
                        'notify_on_stop_loss': True,
                        'notify_on_compound': False,
                        'notify_on_rebalance': True
                    }
                })

            return jsonify({
                'success': True,
                'config': config.to_dict()
            })

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error fetching automation config: {str(e)}")
        return jsonify({'error': str(e)}), 500


@liquidity_bp.route('/automation/config', methods=['PUT'])
def update_automation_config():
    """Update global automation config for a wallet"""
    try:
        data = request.json

        wallet_address = data.get('walletAddress')
        if not wallet_address:
            return jsonify({'error': 'walletAddress is required'}), 400

        db = get_db()
        try:
            # Get or create config
            config = db.query(AutomationConfig).filter_by(
                wallet_address=wallet_address
            ).first()

            if not config:
                config = AutomationConfig(wallet_address=wallet_address)
                db.add(config)

            # Update fields
            updateable_fields = [
                'automation_enabled', 'default_strategy', 'max_position_size_percentage',
                'min_rugcheck_score', 'auto_close_on_security_drop', 'security_drop_threshold',
                'default_take_profit_percentage', 'default_stop_loss_percentage',
                'default_auto_compound', 'default_compound_frequency_hours',
                'default_compound_threshold_usd', 'default_rebalancing_enabled',
                'default_rebalance_triggers', 'notify_on_open', 'notify_on_close',
                'notify_on_take_profit', 'notify_on_stop_loss', 'notify_on_compound',
                'notify_on_rebalance'
            ]

            for field in updateable_fields:
                # Convert camelCase to snake_case for matching
                snake_case_field = ''.join(['_' + c.lower() if c.isupper() else c for c in field]).lstrip('_')
                camel_case_field = field[0].lower() + field[1:]  # Convert first char to lowercase

                if camel_case_field in data:
                    setattr(config, snake_case_field, data[camel_case_field])

            db.commit()

            return jsonify({
                'success': True,
                'config': config.to_dict()
            })

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error updating automation config: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================
# TRANSACTIONS ENDPOINTS
# ============================================

@liquidity_bp.route('/transactions', methods=['GET'])
def get_transactions():
    """Get transaction history for a wallet"""
    try:
        wallet_address = request.args.get('walletAddress')
        if not wallet_address:
            return jsonify({'error': 'walletAddress is required'}), 400

        transaction_type = request.args.get('type')  # Optional filter
        limit = int(request.args.get('limit', 50))

        db = get_db()
        try:
            query = db.query(LiquidityTransaction).filter_by(
                wallet_address=wallet_address
            )

            if transaction_type:
                query = query.filter_by(transaction_type=transaction_type)

            transactions = query.order_by(
                desc(LiquidityTransaction.created_at)
            ).limit(limit).all()

            return jsonify({
                'success': True,
                'transactions': [tx.to_dict() for tx in transactions]
            })

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error fetching transactions: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ============================================
# POOL FAVORITES ENDPOINTS
# ============================================

@liquidity_bp.route('/favorites', methods=['GET'])
def get_favorites():
    """Get favorite pools for a wallet"""
    try:
        wallet_address = request.args.get('walletAddress')
        if not wallet_address:
            return jsonify({'error': 'walletAddress is required'}), 400

        db = get_db()
        try:
            favorites = db.query(PoolFavorite).filter_by(
                wallet_address=wallet_address
            ).order_by(desc(PoolFavorite.created_at)).all()

            return jsonify({
                'success': True,
                'favorites': [fav.to_dict() for fav in favorites]
            })

        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error fetching favorites: {str(e)}")
        return jsonify({'error': str(e)}), 500


@liquidity_bp.route('/favorites', methods=['POST'])
def add_favorite():
    """Add a pool to favorites"""
    try:
        data = request.json

        required_fields = ['walletAddress', 'poolAddress']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400

        db = get_db()
        try:
            # Check if already favorited
            existing = db.query(PoolFavorite).filter_by(
                wallet_address=data['walletAddress'],
                pool_address=data['poolAddress']
            ).first()

            if existing:
                return jsonify({'error': 'Pool already favorited'}), 400

            favorite = PoolFavorite(
                wallet_address=data['walletAddress'],
                pool_address=data['poolAddress'],
                pair_name=data.get('pairName'),
                token_x_mint=data.get('tokenXMint'),
                token_y_mint=data.get('tokenYMint'),
                token_x_symbol=data.get('tokenXSymbol'),
                token_y_symbol=data.get('tokenYSymbol')
            )

            db.add(favorite)
            db.commit()

            return jsonify({
                'success': True,
                'favorite': favorite.to_dict()
            })

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error adding favorite: {str(e)}")
        return jsonify({'error': str(e)}), 500


@liquidity_bp.route('/favorites/<int:favorite_id>', methods=['DELETE'])
def remove_favorite(favorite_id):
    """Remove a pool from favorites"""
    try:
        db = get_db()
        try:
            favorite = db.query(PoolFavorite).filter_by(id=favorite_id).first()

            if not favorite:
                return jsonify({'error': 'Favorite not found'}), 404

            db.delete(favorite)
            db.commit()

            return jsonify({'success': True})

        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Error removing favorite: {str(e)}")
        return jsonify({'error': str(e)}), 500
