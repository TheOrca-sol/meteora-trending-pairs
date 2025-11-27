#!/usr/bin/env python3
"""
Quick script to check Degen Mode database status
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from models import get_db, DegenConfig

def check_degen_status():
    db = get_db()
    try:
        # Get all degen configs
        configs = db.query(DegenConfig).all()

        print(f"\n{'='*60}")
        print(f"DEGEN MODE DATABASE STATUS")
        print(f"{'='*60}\n")

        if not configs:
            print("❌ No Degen Mode configs found in database")
            print("   User needs to set up a wallet first!\n")
            return

        print(f"Found {len(configs)} Degen Mode config(s):\n")

        for config in configs:
            wallet_short = f"{config.wallet_address[:8]}...{config.wallet_address[-6:]}"
            degen_wallet_short = f"{config.degen_wallet_address[:8]}...{config.degen_wallet_address[-6:]}"

            print(f"Wallet: {wallet_short}")
            print(f"  Degen Wallet: {degen_wallet_short}")
            print(f"  Type: {config.wallet_type}")
            print(f"  Enabled: {'✅ YES' if config.enabled else '❌ NO'}")
            print(f"  Threshold: {config.min_fee_rate_threshold}%")
            print(f"  Check Interval: {config.check_interval_minutes} min")
            print(f"  Last Check: {config.last_check or 'Never'}")
            print(f"  Next Check: {config.next_check or 'Not scheduled'}")
            print()

        # Summary
        enabled_count = sum(1 for c in configs if c.enabled)
        print(f"Summary: {enabled_count}/{len(configs)} configs are ENABLED")

        if enabled_count == 0:
            print("\n⚠️  WARNING: No Degen Mode monitors are enabled!")
            print("   Enable Degen Mode from the frontend to start monitoring.\n")

    except Exception as e:
        print(f"❌ Error checking database: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    check_degen_status()
