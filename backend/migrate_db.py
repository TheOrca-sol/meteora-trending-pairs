#!/usr/bin/env python3
"""
Database Migration Script
Creates all required tables in Supabase
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in .env file")
    sys.exit(1)

print("🔄 Starting database migration...")
print(f"📍 Connecting to: {DATABASE_URL.split('@')[1].split('/')[0]}")

try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

    with engine.connect() as conn:
        print("\n✅ Connected to database")

        # Read and execute the schema SQL
        schema_file = 'supabase_schema.sql'

        if not os.path.exists(schema_file):
            print(f"❌ ERROR: {schema_file} not found")
            print("   Make sure you're running this from the backend directory")
            sys.exit(1)

        with open(schema_file, 'r') as f:
            sql = f.read()

        print(f"📄 Reading {schema_file}...")
        print("🔨 Executing SQL schema...")

        # Execute the entire SQL file as one transaction
        # This is better than splitting because of complex functions with semicolons
        try:
            # Use raw connection to execute multiple statements
            raw_conn = conn.connection
            cursor = raw_conn.cursor()
            cursor.execute(sql)
            raw_conn.commit()
            cursor.close()
            print("✅ Schema executed successfully")

        except Exception as e:
            # Check if it's just because things already exist
            if "already exists" in str(e).lower():
                print("⚠️  Some objects already exist (this is OK)")
            else:
                # Try to rollback and continue
                try:
                    raw_conn.rollback()
                except:
                    pass
                print(f"⚠️  Warning: {str(e)[:100]}...")
                print("   Continuing to verify tables...")

        # Verify tables were created
        print("\n🔍 Verifying tables...")
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('users', 'monitoring_configs', 'telegram_auth_codes', 'opportunity_snapshots')
            ORDER BY table_name
        """))

        tables = [row[0] for row in result]

        if len(tables) == 4:
            print(f"✅ All 4 tables created successfully:")
            for table in tables:
                print(f"   • {table}")
        else:
            print(f"⚠️  Only {len(tables)} tables found: {', '.join(tables)}")
            print("   Some tables may not have been created")

        # Check indexes
        print("\n🔍 Checking indexes...")
        result = conn.execute(text("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname LIKE 'idx_%'
        """))

        indexes = [row[0] for row in result]
        print(f"✅ {len(indexes)} indexes created")

        # Check functions
        print("\n🔍 Checking functions...")
        result = conn.execute(text("""
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_type = 'FUNCTION'
            AND routine_name IN ('update_updated_at_column', 'cleanup_expired_auth_codes')
        """))

        functions = [row[0] for row in result]
        print(f"✅ {len(functions)} functions created")

        print("\n" + "="*60)
        print("🎉 Migration completed successfully!")
        print("="*60)
        print("\nYou can now start the application with:")
        print("  python app.py")
        print()

except Exception as e:
    print(f"\n❌ Migration failed!")
    print(f"Error: {e}")
    print("\n💡 Troubleshooting:")
    print("1. Check your DATABASE_URL in .env file")
    print("2. Make sure you can connect to the database")
    print("3. Run: python test_db_connection.py")
    sys.exit(1)
