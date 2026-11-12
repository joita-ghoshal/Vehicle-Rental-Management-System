"""Create or refresh isolated demo accounts.   Run:  python demo.py seed

The script is idempotent:
  * a missing demo account is created;
  * an existing demo account is updated back to the documented demo details;
  * an existing non-demo account with the same email is never modified.

The admin entry is the ZELVORA **Main Admin**. It receives the same full
administrative permissions as any other ``admin`` account - there is no
read-only mode. The customer entry is the public Demo Customer.

Passwords are stored only as salted scrypt hashes. The two passwords below are
public demo credentials shown on the login page - they are not production
secrets and give no access to the owner's real admin account.
"""
import mysql.connector

from auth import hash_password
from database import run_query, run_write
from demo_accounts import DEMO_ACCOUNTS
from migrations import ensure_is_demo_column, ensure_sessions_table
from demo_safety import require_demo_database


def _seed(account):
    email = account["email"]
    row = run_query("SELECT id, role, is_demo FROM users WHERE email = %s", (email,), one=True)

    if row:
        # Never take over an account that was not created by this seed script.
        if not row["is_demo"]:
            raise SystemExit(
                f"Refusing to modify {email}: it already exists and is not a demo account.\n"
                "Use different demo email addresses in demo_accounts.py if needed."
            )
        if row["role"] != account["role"]:
            raise SystemExit(
                f"Refusing to modify {email}: the account role is {row['role']}, "
                f"but the demo definition expects {account['role']}."
            )
        run_write(
            "UPDATE users SET name = %s, phone = %s, password_hash = %s, is_demo = 1 WHERE id = %s",
            (account["name"], account["phone"], hash_password(account["password"]), row["id"]),
        )
        return "updated"

    run_write(
        "INSERT INTO users (name, email, phone, password_hash, role, is_demo) "
        "VALUES (%s, %s, %s, %s, %s, 1)",
        (account["name"], email, account["phone"], hash_password(account["password"]), account["role"]),
    )
    return "created"


def main():
    require_demo_database()
    print("ZELVORA demo account seed")
    try:
        ensure_is_demo_column(verbose=False)
        ensure_sessions_table(verbose=False)
        for account in DEMO_ACCOUNTS:
            result = _seed(account)
            print(f"  {result:8} {account['role']:8} {account['email']}")
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")

    print("\nDemo credentials (public, local demo only):")
    for account in DEMO_ACCOUNTS:
        label = "MAIN ADMIN" if account["role"] == "admin" else "customer"
        print(f"  {label:10}  {account['email']}  /  {account['password']}")
    print("\nThe admin account above has full control: vehicles, customers, bookings,")
    print("approvals, rejections, completion, payments and revenue.")
    print("Owner admin reset:  python create_admin.py --reset")
    print("Main Admin reset:   python demo.py reset-main")


if __name__ == "__main__":
    main()
