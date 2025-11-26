#!/usr/bin/env python3
"""
Development server runner with test environment
Loads .env.local for test Telegram bot and local database
"""

import os
import sys
from pathlib import Path

# Load .env.local if it exists, otherwise fall back to .env
env_file = Path(__file__).parent / '.env.local'
if env_file.exists():
    print(f"✅ Loading test environment from {env_file}")
    from dotenv import load_dotenv
    load_dotenv(env_file)
else:
    print("⚠️  .env.local not found, using default .env")
    print("   Create .env.local with your test bot credentials for development")

# Print which bot we're using (without exposing full token)
bot_token = os.getenv('TELEGRAM_BOT_TOKEN', '')
bot_username = os.getenv('TELEGRAM_BOT_USERNAME', 'not set')
if bot_token:
    masked_token = bot_token[:8] + '...' + bot_token[-8:]
    print(f"🤖 Using Telegram bot: @{bot_username}")
    print(f"   Token: {masked_token}")
else:
    print("❌ TELEGRAM_BOT_TOKEN not set!")

db_url = os.getenv('DATABASE_URL', 'not set')
if 'sqlite' in db_url:
    print(f"💾 Using local SQLite database: {db_url}")
else:
    print(f"💾 Using database: {db_url}")

print("\n" + "="*60)
print("Starting development server...")
print("="*60 + "\n")

# Now import and run the app
from app import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True,
        use_reloader=False  # Prevent Telegram bot threading issues
    )
