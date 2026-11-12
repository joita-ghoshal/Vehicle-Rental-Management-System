"""Create, inspect or reset ZELVORA admin passwords.

    python create_admin.py               Create a new owner admin account
    python create_admin.py --reset       Set a new password for an existing owner admin
    python demo.py reset-main            Set a new password for the public Main Admin
    python create_admin.py --list        List admin accounts (no password data)

Passwords are typed in the terminal (hidden) and stored only as salted scrypt
hashes. Nothing is written to a file, and nothing changes automatically:
--reset and --reset-main only update the named account after you confirm the
new password.

--reset is for the owner's private admin account and refuses demo accounts.
--reset-main is the secure, explicit way to change the public Main Admin
password. If you change it, update backend/demo_accounts.py and restart the
demo backend so the login-page panel stays accurate. Private passwords never go there.
"""
import argparse
import getpass

import mysql.connector

from auth import check_password_rules, hash_password
from database import run_query, run_write
from demo_accounts import DEMO_ACCOUNTS, MAIN_ADMIN_EMAIL
from demo_safety import require_demo_database
from migrations import ensure_is_demo_column
from utils import EMAIL_RE


def _prompt_password(public_demo=False):
    password = getpass.getpass("New password (8+ characters, letters and numbers): ")
    errors = {}
    check_password_rules(password, errors)
    if errors:
        raise SystemExit(errors["password"] + " Nothing was changed.")
    if not public_demo and any(password == a["password"] for a in DEMO_ACCOUNTS):
        raise SystemExit("Private admins must not reuse public demo passwords. Nothing was changed.")
    if password != getpass.getpass("Confirm new password: "):
        raise SystemExit("Passwords do not match. Nothing was changed.")
    return password


def _apply_password(user_id, password):
    """Hash and store a new password. The plain value never leaves memory."""
    run_write("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(password), user_id))


def create_admin():
    print("Create a ZELVORA admin account")
    name = input("Full name: ").strip() or "ZELVORA Admin"
    email = input("Email: ").strip().lower()
    if not EMAIL_RE.match(email):
        raise SystemExit("That email does not look right. Nothing was created.")
    if run_query("SELECT id FROM users WHERE email = %s", (email,), one=True):
        raise SystemExit("An account with this email already exists. Nothing was created.")
    phone = input("Phone (10-14 digits): ").strip()
    password = _prompt_password()
    try:
        run_write(
            "INSERT INTO users (name, email, phone, password_hash, role, is_demo) "
            "VALUES (%s, %s, %s, %s, 'admin', 0)",
            (name, email, phone or "0000000000", hash_password(password)),
        )
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")
    print(f"Admin account created for {email}. You can now log in on the website.")


def reset_admin():
    print("Reset a ZELVORA admin password")
    email = input("Admin email: ").strip().lower()
    if not EMAIL_RE.match(email):
        raise SystemExit("That email does not look right. Nothing was changed.")
    row = run_query("SELECT id, role, is_demo FROM users WHERE email = %s", (email,), one=True)
    if not row:
        raise SystemExit("No account with that email. Nothing was changed.")
    if row["role"] != "admin":
        raise SystemExit("That account is not an admin. Nothing was changed.")
    if row["is_demo"]:
        raise SystemExit(
            "That is a public demo admin account. Use python create_admin.py --reset-main "
            "to change the Main Admin password. Nothing was changed."
        )

    password = _prompt_password()
    try:
        _apply_password(row["id"], password)
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")
    print(f"Password updated for {email}. Previous sessions are invalid on their next request.")


def reset_main_admin():
    """Securely reset the public Main Admin password (full-control admin)."""
    require_demo_database()
    print("Reset the public ZELVORA Main Admin password")
    print(f"Account: {MAIN_ADMIN_EMAIL}")
    row = run_query("SELECT id, role, is_demo FROM users WHERE email = %s", (MAIN_ADMIN_EMAIL,), one=True)
    if not row:
        raise SystemExit(
            f"No account exists for {MAIN_ADMIN_EMAIL}. Run python seed_demo.py first. "
            "Nothing was changed."
        )
    if row["role"] != "admin" or not row["is_demo"]:
        raise SystemExit(
            f"{MAIN_ADMIN_EMAIL} is not the seeded public Main Admin account. Nothing was changed."
        )

    password = _prompt_password(public_demo=True)
    try:
        _apply_password(row["id"], password)
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")
    print(f"Password updated for the Main Admin ({MAIN_ADMIN_EMAIL}).")
    print("Previous sessions are invalid on their next request.")
    print("\nTo publish the new public demo password, update backend/demo_accounts.py and restart the demo backend.")
    print("The demo panel hides credentials that no longer match. Never put a private password in code.")


def list_admins():
    rows = run_query(
        "SELECT email, name, is_demo, created_at FROM users WHERE role = 'admin' ORDER BY id"
    )
    if not rows:
        print("No admin accounts found.")
        return
    print(f"{'Email':40} {'Name':24} {'Kind':10} Created")
    for row in rows:
        if row["email"] == MAIN_ADMIN_EMAIL:
            kind = "main"
        elif row["is_demo"]:
            kind = "demo"
        else:
            kind = "owner"
        created = row["created_at"].strftime("%Y-%m-%d") if row["created_at"] else ""
        print(f"{row['email']:40} {row['name'][:24]:24} {kind:10} {created}")


def main():
    parser = argparse.ArgumentParser(description="Create, reset or list ZELVORA admin accounts.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset", action="store_true", help="set a new password for an existing owner admin")
    group.add_argument("--reset-main", action="store_true", help="set a new password for the public Main Admin")
    group.add_argument("--list", action="store_true", help="list admin accounts")
    args = parser.parse_args()

    try:
        ensure_is_demo_column(verbose=False)
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")

    if args.list:
        list_admins()
    elif args.reset:
        reset_admin()
    elif args.reset_main:
        reset_main_admin()
    else:
        create_admin()


if __name__ == "__main__":
    main()
