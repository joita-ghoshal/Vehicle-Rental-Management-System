"""MySQL helpers. Every query uses %s placeholders (parameterized SQL)."""
from contextlib import contextmanager

import mysql.connector

from config import DB_CONFIG


def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


def run_query(sql, params=(), one=False):
    """Run a SELECT and return a list of dicts (or one dict / None)."""
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        rows = cur.fetchall()
        return (rows[0] if rows else None) if one else rows
    finally:
        conn.close()


def run_write(sql, params=()):
    """Run one INSERT/UPDATE and return (last_insert_id, affected_rows)."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return cur.lastrowid, cur.rowcount
    finally:
        conn.close()


@contextmanager
def transaction():
    """Several statements that succeed or fail together.

    Use SELECT ... FOR UPDATE inside it to lock rows so two requests cannot
    change the same vehicle or booking at the same time.
    """
    conn = get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
