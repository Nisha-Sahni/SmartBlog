#!/usr/bin/env python3
"""
SmartBlog — Secure CLI Tool to Create or Promote an Administrator Account.
Usage:
    python create_admin.py
    python create_admin.py --email admin@example.com --password mysecretpass --name "Administrator"
"""

import sys
import os
import argparse
import getpass
import re

# Ensure Backend can be imported
sys.path.insert(0, os.path.abspath("Backend"))

from werkzeug.security import generate_password_hash
import mysql.connector

def get_db():
    db_password = os.getenv("SMARTBLOG_DB_PASSWORD", "nishasahni@2626")
    return mysql.connector.connect(
        host=os.getenv("SMARTBLOG_DB_HOST", "localhost"),
        user=os.getenv("SMARTBLOG_DB_USER", "root"),
        password=db_password,
        database=os.getenv("SMARTBLOG_DB_NAME", "smartblog")
    )

def is_valid_email(email):
    return re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email) is not None

def main():
    parser = argparse.ArgumentParser(description="Create or promote an administrator account for SmartBlog.")
    parser.add_argument("--name", help="Full name of the administrator")
    parser.add_argument("--email", help="Administrator email address")
    parser.add_argument("--password", help="Administrator password (min. 8 characters)")

    args = parser.parse_args()

    print("==================================================")
    print("  SMARTBLOG — SECURE ADMIN ACCOUNT PROVISIONING   ")
    print("==================================================")

    name = args.name
    email = args.email
    password = args.password

    # Interactive prompts if arguments not provided
    if not name:
        name = input("Enter Admin Full Name: ").strip()
    if not email:
        email = input("Enter Admin Email: ").strip()
    if not password:
        password = getpass.getpass("Enter Admin Password (min. 8 chars): ").strip()
        confirm = getpass.getpass("Confirm Admin Password: ").strip()
        if password != confirm:
            print("\n[ERROR] Passwords do not match. Aborted.")
            sys.exit(1)

    # Validations
    if not name or len(name) < 2:
        print("\n[ERROR] Name must be at least 2 characters long.")
        sys.exit(1)

    email = email.lower()
    if not is_valid_email(email):
        print("\n[ERROR] Invalid email address format.")
        sys.exit(1)

    if len(password) < 8:
        print("\n[ERROR] Password must be at least 8 characters long.")
        sys.exit(1)

    try:
        cnx = get_db()
        cursor = cnx.cursor(dictionary=True)

        # Check if user already exists
        cursor.execute("SELECT user_id, name, email, is_admin, status FROM users WHERE email = %s", (email,))
        existing = cursor.fetchone()

        hashed_password = generate_password_hash(password)

        if existing:
            cursor.execute("""
                UPDATE users
                SET name = %s, password = %s, is_admin = 1, status = 'active'
                WHERE user_id = %s
            """, (name, hashed_password, existing["user_id"]))
            action = "Promoted existing user to Administrator"
            user_id = existing["user_id"]
        else:
            cursor.execute("""
                INSERT INTO users (name, email, password, is_admin, status, reputation_points)
                VALUES (%s, %s, %s, 1, 'active', 100)
            """, (name, email, hashed_password))
            action = "Created new Administrator account"
            user_id = cursor.lastrowid

        cnx.commit()
        cursor.close()
        cnx.close()

        print(f"\n[SUCCESS] {action} successfully!")
        print(f"  - User ID : {user_id}")
        print(f"  - Name    : {name}")
        print(f"  - Email   : {email}")
        print(f"  - Role    : Administrator (is_admin = 1)")
        print(f"  - Status  : active")
        print("\nYou can now log in at: http://127.0.0.1:5000/admin/login")

    except Exception as e:
        print(f"\n[ERROR] Failed to provision admin account: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

