#!/usr/bin/env python3
"""
Manually trigger a monitoring check (for testing)
"""

from dotenv import load_dotenv
load_dotenv()

from models import get_db, MonitoringConfig
from monitoring_service import monitoring_service

db = get_db()
configs = db.query(MonitoringConfig).filter(MonitoringConfig.enabled == True).all()
db.close()

if not configs:
    print("❌ No enabled monitoring configs found")
else:
    for config in configs:
        wallet_short = f"{config.wallet_address[:8]}...{config.wallet_address[-6:]}"
        print(f"\n🔄 Manually triggering check for {wallet_short}...")
        monitoring_service._check_opportunities(config.wallet_address)
        print("✅ Check complete")
