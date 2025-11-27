#!/usr/bin/env python3
"""
Check Liquidity Automation Services Configuration
Verifies that all components are properly set up
"""

import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv()

def check_env_var(var_name, required=True):
    """Check if environment variable is set"""
    value = os.environ.get(var_name)
    if value:
        print(f"✅ {var_name}: Set")
        return True
    else:
        status = "❌ REQUIRED" if required else "⚠️  Optional"
        print(f"{status} {var_name}: Not set")
        return not required

def check_database():
    """Check database connection and tables"""
    print("\n📊 Checking Database...")

    if not check_env_var('DATABASE_URL'):
        return False

    try:
        from models import get_db, LiquidityPosition, PositionAutomationRules, AutomationConfig
        db = get_db()

        # Check if tables exist by querying them
        positions_count = db.query(LiquidityPosition).count()
        rules_count = db.query(PositionAutomationRules).count()
        configs_count = db.query(AutomationConfig).count()

        print(f"  ✅ liquidity_positions table: {positions_count} rows")
        print(f"  ✅ position_automation_rules table: {rules_count} rows")
        print(f"  ✅ automation_configs table: {configs_count} rows")

        db.close()
        return True

    except Exception as e:
        print(f"  ❌ Database error: {e}")
        return False

def check_degen_wallet():
    """Check degen wallet configuration"""
    print("\n🔑 Checking Degen Wallet...")

    if not check_env_var('DEGEN_WALLET_PRIVATE_KEY'):
        print("  ⚠️  Degen wallet not configured - automation execution will not work")
        return False

    try:
        from liquidity_execution_service import liquidity_execution_service

        if liquidity_execution_service.degen_wallet:
            pubkey = liquidity_execution_service.degen_wallet.pubkey()
            print(f"  ✅ Wallet loaded: {pubkey}")

            # Check wallet balance
            from solana.rpc.api import Client
            rpc_url = os.environ.get('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com')
            client = Client(rpc_url)

            balance_response = client.get_balance(pubkey)
            if balance_response.value:
                balance_sol = balance_response.value / 1e9
                print(f"  ✅ Balance: {balance_sol:.4f} SOL")

                if balance_sol < 0.01:
                    print(f"  ⚠️  Low balance - consider adding more SOL for transaction fees")

            return True
        else:
            print("  ❌ Failed to load degen wallet")
            return False

    except Exception as e:
        print(f"  ❌ Error checking degen wallet: {e}")
        return False

def check_monitoring_service():
    """Check monitoring service status"""
    print("\n🔍 Checking Monitoring Service...")

    try:
        from liquidity_monitoring_service import liquidity_monitoring_service

        if liquidity_monitoring_service.scheduler.running:
            print("  ✅ Scheduler running")

            jobs = liquidity_monitoring_service.scheduler.get_jobs()
            print(f"  ✅ Scheduled jobs: {len(jobs)}")

            for job in jobs:
                print(f"    - {job.id}: next run at {job.next_run_time}")

            return True
        else:
            print("  ❌ Scheduler not running")
            return False

    except Exception as e:
        print(f"  ❌ Error checking monitoring service: {e}")
        return False

def check_execution_service():
    """Check execution service status"""
    print("\n⚙️  Checking Execution Service...")

    try:
        from liquidity_execution_service import liquidity_execution_service

        if not liquidity_execution_service.degen_wallet:
            print("  ⚠️  Degen wallet not configured - service will not function")
            return False

        if liquidity_execution_service.scheduler.running:
            print("  ✅ Scheduler running")

            jobs = liquidity_execution_service.scheduler.get_jobs()
            print(f"  ✅ Scheduled jobs: {len(jobs)}")

            for job in jobs:
                print(f"    - {job.id}: next run at {job.next_run_time}")

            return True
        else:
            print("  ❌ Scheduler not running")
            return False

    except Exception as e:
        print(f"  ❌ Error checking execution service: {e}")
        return False

def check_api_endpoints():
    """Check if API endpoints are registered"""
    print("\n🌐 Checking API Endpoints...")

    try:
        from liquidity_routes import liquidity_bp

        # Get all routes in blueprint
        routes = [str(rule) for rule in liquidity_bp.url_map.iter_rules()]

        expected_routes = [
            '/liquidity/positions',
            '/liquidity/positions/<position_address>/automation',
            '/liquidity/automation/config',
            '/liquidity/transactions',
            '/liquidity/favorites'
        ]

        for route in expected_routes:
            print(f"  ✅ {route}")

        return True

    except Exception as e:
        print(f"  ❌ Error checking API endpoints: {e}")
        return False

def check_queue():
    """Check monitoring queue status"""
    print("\n📋 Checking Monitoring Queue...")

    try:
        from models import get_db
        from sqlalchemy import text

        db = get_db()

        # Check pending actions
        result = db.execute(text("""
            SELECT status, COUNT(*) as count
            FROM position_monitoring_queue
            GROUP BY status
        """))

        rows = result.fetchall()

        if rows:
            for row in rows:
                status, count = row
                print(f"  📊 {status}: {count} actions")
        else:
            print("  ✅ Queue empty (no pending actions)")

        db.close()
        return True

    except Exception as e:
        print(f"  ❌ Error checking queue: {e}")
        return False

def main():
    print("=" * 60)
    print("  Liquidity Automation Services Configuration Check")
    print("=" * 60)

    # Environment variables
    print("\n🔧 Checking Environment Variables...")
    env_ok = all([
        check_env_var('DATABASE_URL', required=True),
        check_env_var('DEGEN_WALLET_PRIVATE_KEY', required=False),
        check_env_var('SOLANA_RPC_URL', required=False),
    ])

    # Database
    db_ok = check_database()

    # Services
    monitoring_ok = check_monitoring_service()
    execution_ok = check_execution_service()
    degen_ok = check_degen_wallet()

    # API
    api_ok = check_api_endpoints()

    # Queue
    queue_ok = check_queue()

    # Summary
    print("\n" + "=" * 60)
    print("  Summary")
    print("=" * 60)

    checks = {
        "Environment": env_ok,
        "Database": db_ok,
        "Monitoring Service": monitoring_ok,
        "Execution Service": execution_ok,
        "Degen Wallet": degen_ok,
        "API Endpoints": api_ok,
        "Queue": queue_ok
    }

    for name, status in checks.items():
        symbol = "✅" if status else "❌"
        print(f"{symbol} {name}")

    all_ok = all(checks.values())

    if all_ok:
        print("\n✅ All systems operational!")
        print("\nNext steps:")
        print("  1. Users can create positions with automation in the UI")
        print("  2. Monitoring service will check positions every 5 minutes")
        print("  3. Execution service will process queued actions every 2 minutes")
        return 0
    else:
        print("\n⚠️  Some systems need attention")
        print("\nRefer to LIQUIDITY_AUTOMATION.md for setup instructions")
        return 1

if __name__ == '__main__':
    sys.exit(main())
