"""Database-level demo separation, not a restricted administrator role."""
from config import DB_CONFIG, DEMO_DB_NAME, DEMO_MODE
from database import run_query


def require_demo_database():
    if not DEMO_MODE or DB_CONFIG["database"] != DEMO_DB_NAME:
        raise RuntimeError("Use python demo.py setup/seed/serve for the isolated demo database.")
    marker = run_query("SELECT purpose FROM demo_environment WHERE id = 1", one=True)
    if not marker or marker["purpose"] != "synthetic-only-v1":
        raise RuntimeError("Database is not provisioned as a synthetic-only demo. Refusing access.")
    unsafe = run_query("SELECT COUNT(*) AS n FROM users WHERE email NOT LIKE %s AND email NOT LIKE %s AND email NOT LIKE %s",
                       ('%.example', '%.test', '%.local'), one=True)
    if unsafe['n']:
        raise RuntimeError('Non-synthetic email domains detected. Stop demo access and investigate.')
