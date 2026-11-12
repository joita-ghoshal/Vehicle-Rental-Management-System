"""Small, idempotent database migrations.

The project has no migration framework. Each function checks the current
schema first, so running it repeatedly is safe.
"""
from database import get_connection


def _column_exists(cur, table, column):
    cur.execute(
        "SELECT 1 FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s LIMIT 1",
        (table, column),
    )
    return cur.fetchone() is not None


def ensure_is_demo_column(verbose=True):
    """Add users.is_demo when it is missing. Returns True if it was added."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        if _column_exists(cur, "users", "is_demo"):
            if verbose:
                print("users.is_demo already exists - nothing to do.")
            return False
        cur.execute("ALTER TABLE users ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER role")
        conn.commit()
        if verbose:
            print("Added users.is_demo.")
        return True
    finally:
        conn.close()


def ensure_sessions_table(verbose=True):
    """Create the optional persistent-session table. Returns True if created."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM information_schema.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions' LIMIT 1"
        )
        if cur.fetchone() is not None:
            if verbose:
                print("sessions table already exists - nothing to do.")
            return False
        cur.execute(
            "CREATE TABLE IF NOT EXISTS sessions ("
            " token_hash CHAR(64) NOT NULL,"
            " user_id INT UNSIGNED NOT NULL,"
            " expires_at DOUBLE NOT NULL,"
            " password_stamp CHAR(64) NOT NULL,"
            " created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"
            " PRIMARY KEY (token_hash),"
            " KEY idx_sessions_expires (expires_at),"
            " KEY idx_sessions_user (user_id)"
            ") ENGINE=InnoDB"
        )
        conn.commit()
        if verbose:
            print("Added sessions table.")
        return True
    finally:
        conn.close()
