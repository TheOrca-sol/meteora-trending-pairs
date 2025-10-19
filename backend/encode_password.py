#!/usr/bin/env python3
"""
Helper script to URL-encode database passwords for use in DATABASE_URL
Run this if your Supabase password contains special characters like @ # $ % etc.
"""

from urllib.parse import quote_plus
import sys

if len(sys.argv) > 1:
    password = sys.argv[1]
else:
    password = input("Enter your database password: ")

encoded = quote_plus(password)

print("\n" + "="*60)
print("Original password:", password)
print("Encoded password:", encoded)
print("="*60)
print("\nUse the encoded password in your DATABASE_URL:")
print(f"postgresql://postgres:{encoded}@db.YOUR_PROJECT.supabase.co:5432/postgres")
print("="*60 + "\n")
