"""Only publish credentials that actually match this isolated demo database."""
from auth import verify_password
from config import DEMO_MODE
from database import run_query
from demo_accounts import DEMO_ACCOUNTS
from demo_safety import require_demo_database


def credentials(ctx):
    if not DEMO_MODE:
        return 200, {"enabled": False, "accounts": []}
    require_demo_database()
    accounts = []
    for account in DEMO_ACCOUNTS:
        row = run_query("SELECT role, is_demo, password_hash FROM users WHERE email = %s",
                        (account["email"],), one=True)
        if row and row["is_demo"] and row["role"] == account["role"] and verify_password(account["password"], row["password_hash"]):
            accounts.append({k: account[k] for k in ("role", "email", "password")})
    return 200, {"enabled": True, "accounts": accounts}
