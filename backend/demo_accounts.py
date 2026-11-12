"""Public demo accounts used by the local demonstration.

These credentials are intentionally public: they are shown on the login page
and only exist for the local demo database. They are NOT production secrets.
Real administrator passwords must never be stored here.

The admin entry is the ZELVORA **Main Admin**. It has exactly the same full
administrative permissions as any other account with the ``admin`` role: it can
manage vehicles, customers, bookings, approvals, payments and revenue. It is
not a read-only account.

The login panel obtains matching credentials from the demo-only API.
"""

MAIN_ADMIN_EMAIL = "demo.admin@zelvora.example"

DEMO_ACCOUNTS = (
    {
        "role": "customer",
        "name": "Demo Customer",
        "email": "demo.customer@zelvora.example",
        "phone": "9000000001",
        "password": "ZelvoraDemo#2026",
    },
    {
        "role": "admin",
        "name": "ZELVORA Main Admin",
        "email": MAIN_ADMIN_EMAIL,
        "phone": "9000000002",
        "password": "ZelvoraAdmin#2026",
    },
)


def account_for_role(role):
    """Return the public demo definition for a role (customer or admin)."""
    return next(account for account in DEMO_ACCOUNTS if account["role"] == role)
