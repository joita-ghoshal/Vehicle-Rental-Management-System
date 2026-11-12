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


def _column_type(cur, table, column):
    cur.execute(
        "SELECT DATA_TYPE FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = %s LIMIT 1",
        (table, column),
    )
    row = cur.fetchone()
    return row[0].lower() if row else None


def ensure_integer_money_columns(verbose=True):
    """Convert legacy DECIMAL money columns to whole-rupee INT without losing rows.

    Existing fractional values (if any) are rounded to the nearest rupee before
    the column type changes. All rows and constraints are kept.
    """
    money_columns = (("vehicles", "price_per_day"), ("bookings", "total_amount"))
    conn = get_connection()
    try:
        cur = conn.cursor()
        changed = False
        for table, column in money_columns:
            data_type = _column_type(cur, table, column)
            if data_type is None:
                raise RuntimeError(f"Missing money column {table}.{column}.")
            if data_type in ("tinyint", "smallint", "mediumint", "int", "bigint"):
                if verbose:
                    print(f"{table}.{column} already whole-rupee integer - nothing to do.")
                continue
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {column} <> FLOOR({column})")
            fractional = cur.fetchone()[0]
            if fractional:
                cur.execute(f"UPDATE {table} SET {column} = ROUND({column})")
                if verbose:
                    print(f"Rounded {fractional} fractional {table}.{column} value(s) to whole rupees.")
            cur.execute(f"ALTER TABLE {table} MODIFY {column} INT UNSIGNED NOT NULL")
            changed = True
            if verbose:
                print(f"Converted {table}.{column} to whole-rupee INT.")
        if changed:
            conn.commit()
        return changed
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
