"""Provision a NEW synthetic-only database; never clone or import private rows."""
from pathlib import Path

import mysql.connector

from config import DB_CONFIG, DEMO_DB_NAME, DEMO_MODE
from demo_safety import require_demo_database
from migrations import ensure_integer_money_columns, ensure_sessions_table


def execute_sql(cur, path):
    # These checked-in scripts have no stored procedures or semicolons in strings.
    text = "\n".join(line for line in path.read_text(encoding="utf-8").splitlines()
                     if not line.lstrip().startswith("--"))
    text = text.replace("zelvora_db", DEMO_DB_NAME)
    for statement in text.split(";"):
        if statement.strip():
            cur.execute(statement)


def main():
    if not DEMO_MODE or DB_CONFIG["database"] != DEMO_DB_NAME:
        raise SystemExit("Run python demo.py setup instead.")
    root = Path(__file__).resolve().parent.parent
    settings = {k: v for k, v in DB_CONFIG.items() if k != "database"}
    with mysql.connector.connect(**settings) as conn:
        with conn.cursor(dictionary=True) as cur:
            cur.execute("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = %s", (DEMO_DB_NAME,))
            exists = cur.fetchone() is not None
            if exists:
                # Fail closed if someone already uses this name for private data.
                require_demo_database()
            else:
                execute_sql(cur, root / "database" / "database.sql")
                cur.execute("CREATE TABLE demo_environment (id INT PRIMARY KEY, purpose VARCHAR(40) NOT NULL)")
                cur.execute("INSERT INTO demo_environment VALUES (1, 'synthetic-only-v1')")
                conn.commit()
            # Source-controlled, fictitious vehicles only; no private DB reads.
            execute_sql(cur, root / "database" / "sample_data.sql")
            conn.commit()
    ensure_integer_money_columns(verbose=False)
    ensure_sessions_table(verbose=False)
    from seed_demo import main as seed
    seed()
    print("Isolated synthetic demo ready. Start with: python demo.py serve")


if __name__ == "__main__":
    main()
