#!/usr/bin/env python3
"""
Debug script to check monitoring status
"""

from dotenv import load_dotenv
load_dotenv()

from models import get_db, MonitoringConfig, User, OpportunitySnapshot
from monitoring_service import monitoring_service
from datetime import datetime

db = get_db()

print("="*70)
print("MONITORING DEBUG INFO")
print("="*70)

# Check users
users = db.query(User).all()
print(f"\n📱 Total Users: {len(users)}")
for user in users:
    print(f"   • Wallet: {user.wallet_address[:8]}...{user.wallet_address[-6:]}")
    print(f"     Telegram: @{user.telegram_username} (chat_id: {user.telegram_chat_id})")

# Check monitoring configs
configs = db.query(MonitoringConfig).all()
print(f"\n⚙️  Total Monitoring Configs: {len(configs)}")
for config in configs:
    print(f"\n   Wallet: {config.wallet_address[:8]}...{config.wallet_address[-6:]}")
    print(f"   Enabled: {'✅ YES' if config.enabled else '❌ NO'}")
    print(f"   Interval: {config.interval_minutes} minutes")
    print(f"   Last Check: {config.last_check or 'Never'}")
    print(f"   Next Check: {config.next_check or 'Not scheduled'}")
    print(f"   Whitelist: {len(config.whitelist)} tokens")
    print(f"   Min Fees 30min: ${float(config.min_fees_30min)}")
    print(f"   Threshold: {float(config.threshold_multiplier)}x")

# Check scheduler jobs
print(f"\n🕐 APScheduler Jobs:")
jobs = monitoring_service.scheduler.get_jobs()
print(f"   Total jobs: {len(jobs)}")
for job in jobs:
    print(f"   • {job.id}")
    print(f"     Next run: {job.next_run_time}")
    print(f"     Trigger: {job.trigger}")

# Check opportunity snapshots
snapshots = db.query(OpportunitySnapshot).all()
print(f"\n📊 Opportunity Snapshots: {len(snapshots)}")
for snapshot in snapshots[:5]:  # Show last 5
    print(f"   • Wallet: {snapshot.wallet_address[:8]}...{snapshot.wallet_address[-6:]}")
    print(f"     Created: {snapshot.created_at}")
    print(f"     Opportunities: {len(snapshot.opportunities)}")

print("\n" + "="*70)

# Check if scheduler is running
print(f"\n🔄 Scheduler Status:")
print(f"   Running: {'✅ YES' if monitoring_service.scheduler.running else '❌ NO'}")
print(f"   State: {monitoring_service.scheduler.state}")

db.close()
