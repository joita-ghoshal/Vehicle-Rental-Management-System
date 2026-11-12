"""Apply pending local database migrations.   Run:  python migrate_db.py

Safe to run more than once: every migration checks the schema first.
"""
import mysql.connector

from migrations import ensure_is_demo_column, ensure_sessions_table


def main():
    try:
        ensure_is_demo_column()
        ensure_sessions_table()
    except mysql.connector.Error as e:
        raise SystemExit(f"Database error: {e}")
    print("Database migrations are up to date.")


if __name__ == "__main__":
    main()
