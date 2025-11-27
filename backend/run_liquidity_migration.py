#!/usr/bin/env python3
"""
Run liquidity management migration on Supabase
Executes the SQL migration file to create all necessary tables
"""

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

print("=" * 60)
print("LIQUIDITY MANAGEMENT MIGRATION")
print("=" * 60)
print(f"Database: {DATABASE_URL.split('@')[1].split('/')[0] if '@' in DATABASE_URL else 'Unknown'}")
print("=" * 60)

# Create engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Read migration SQL
migration_file = os.path.join(os.path.dirname(__file__), 'migrations', 'add_liquidity_management.sql')

if not os.path.exists(migration_file):
    raise FileNotFoundError(f"Migration file not found: {migration_file}")

print(f"\n📄 Reading migration file: {migration_file}")

with open(migration_file, 'r') as f:
    sql_content = f.read()

print(f"✅ Migration file loaded ({len(sql_content)} bytes)")

# Execute migration
print("\n🚀 Running migration...")

try:
    with engine.begin() as conn:
        # Execute the entire SQL file as one statement
        # PostgreSQL can handle multiple statements in a single execute
        print("   Executing migration SQL...\n")

        conn.execute(text(sql_content))

        print("   ✅ All statements executed successfully")

    print("\n" + "=" * 60)
    print("✅ MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 60)

    # Verify tables were created
    print("\n🔍 Verifying tables...")
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN (
                'liquidity_positions',
                'position_automation_rules',
                'automation_configs',
                'pool_automation_overrides',
                'liquidity_transactions',
                'pool_favorites',
                'position_monitoring_queue'
            )
            ORDER BY table_name
        """))

        tables = [row[0] for row in result]

        expected_tables = [
            'automation_configs',
            'liquidity_positions',
            'liquidity_transactions',
            'pool_automation_overrides',
            'pool_favorites',
            'position_automation_rules',
            'position_monitoring_queue'
        ]

        print("\nTables created:")
        for table in expected_tables:
            if table in tables:
                print(f"   ✅ {table}")
            else:
                print(f"   ❌ {table} (NOT FOUND)")

        print(f"\n📊 Total: {len(tables)}/{len(expected_tables)} tables")

    print("\n" + "=" * 60)
    print("🎉 Database is ready for liquidity management!")
    print("=" * 60)

except Exception as e:
    print("\n" + "=" * 60)
    print("❌ MIGRATION FAILED")
    print("=" * 60)
    print(f"\nError: {str(e)}")
    print("\nPlease check the error message above and try again.")
    raise

finally:
    engine.dispose()
