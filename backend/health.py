"""Database-aware readiness without database names, identities or secrets."""
import mysql.connector

from config import DEMO_MODE
from database import run_query
from demo_safety import require_demo_database


def health(ctx):
    try:
        row = run_query('SELECT 1 AS ready', one=True)
        if not row or row['ready'] != 1:
            return 503, {'status': 'unavailable', 'database': 'unavailable'}
        if DEMO_MODE:
            require_demo_database()
    except (mysql.connector.Error, RuntimeError):
        return 503, {'status': 'unavailable', 'database': 'unavailable'}
    return 200, {'status': 'ok', 'database': 'ok'}
