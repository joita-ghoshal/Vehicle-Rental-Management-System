"""Create the local admin account.   Run:  python create_admin.py

The password is typed in the terminal (hidden), then stored only as a salted
scrypt hash. Nothing is written to any file.
"""
import getpass

import mysql.connector

from auth import check_password_rules, hash_password
from database import run_query, run_write
from utils import EMAIL_RE


def main():
    print("Create a ZELVORA admin account")
    name = input("Full name: ").strip() or "ZELVORA Admin"
    email = input("Email: ").strip().lower()
    if not EMAIL_RE.match(email):
        raise SystemExit("That email does not look right. Nothing was created.")
    if run_query("SELECT id FROM users WHERE email = %s", (email,), one=True):
        raise SystemExit("An account with this email already exists. Nothing was created.")
    phone = input("Phone (10-14 digits): ").strip()
    password = getpass.getpass("Password (8+ characters, letters and numbers): ")
    errors = {}
    check_password_rules(password, errors)
    if errors:
        raise SystemExit(errors["password"])
    if password != getpass.getpass("Confirm password: "):
        raise SystemExit("Passwords do not match. Nothing was created.")
    try:
        run_write("INSERT INTO users (name, email, phone, password_hash, role) VALUES (%s, %s, %s, %s, 'admin')",
                  (name, email, phone or "0000000000", hash_password(password)))
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")
    print(f"Admin account created for {email}. You can now log in on the website.")


if __name__ == "__main__":
    main()
