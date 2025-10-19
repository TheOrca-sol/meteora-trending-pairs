#!/usr/bin/env python3
"""
Test Supabase database connection
Run this to verify your DATABASE_URL is correct before starting the app
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in .env file")
    exit(1)

print("🔍 Testing database connection...")
print(f"📍 Host: {DATABASE_URL.split('@')[1].split('/')[0]}")

try:
    # Create engine with short timeout for testing
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        connect_args={
            'connect_timeout': 5,
            'options': '-c timezone=utc'
        }
    )

    # Test connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]

        print("\n✅ Connection successful!")
        print(f"📊 PostgreSQL version: {version.split(',')[0]}")

        # Check if tables exist
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('users', 'monitoring_configs', 'telegram_auth_codes', 'opportunity_snapshots')
            ORDER BY table_name
        """))

        tables = [row[0] for row in result]

        if len(tables) == 4:
            print(f"✅ All required tables exist: {', '.join(tables)}")
        elif len(tables) > 0:
            print(f"⚠️  Some tables exist: {', '.join(tables)}")
            print("   Missing tables - you may need to run the schema SQL")
        else:
            print("❌ No tables found - you need to run supabase_schema.sql")

    print("\n🎉 Database is ready to use!")

except Exception as e:
    print(f"\n❌ Connection failed!")
    print(f"Error: {e}")
    print("\n💡 Troubleshooting:")
    print("1. Check your DATABASE_URL in .env file")
    print("2. Make sure password special characters are URL-encoded (@→%40, #→%23, etc)")
    print("3. Use connection pooler (port 6543) instead of direct connection (port 5432)")
    print("4. See GET_SUPABASE_CONNECTION.md for detailed instructions")
    exit(1)
