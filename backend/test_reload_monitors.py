#!/usr/bin/env python3
"""
Test reloading active monitors
"""

from dotenv import load_dotenv
load_dotenv()

from monitoring_service import monitoring_service
import time

print("🔄 Testing monitor reload...")
print(f"Scheduler running: {monitoring_service.scheduler.running}")
print(f"Jobs before reload: {len(monitoring_service.scheduler.get_jobs())}")

print("\n📥 Loading active monitors...")
monitoring_service.load_active_monitors()

print(f"Jobs after reload: {len(monitoring_service.scheduler.get_jobs())}")

jobs = monitoring_service.scheduler.get_jobs()
for job in jobs:
    print(f"\n✅ Job: {job.id}")
    print(f"   Next run: {job.next_run_time}")
    print(f"   Trigger: {job.trigger}")
    print(f"   Function: {job.func.__name__}")
