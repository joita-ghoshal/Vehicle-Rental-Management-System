"""Production entrypoint: optional migrations, then the API/static server.

Local development keeps using `python server.py` or `python demo.py serve`.
Hosting sets ZELVORA_AUTO_MIGRATE=1 so a fresh database gets the optional
sessions table before the first request.
"""
import os
import runpy
import sys

from config import SESSION_STORE, STATIC_DIR
from migrations import ensure_integer_money_columns, ensure_is_demo_column, ensure_sessions_table


def main():
    if os.environ.get("ZELVORA_PROVISION_DEMO", "0") == "1":
        print("Provisioning the isolated synthetic demo database (first deploy only).")
        runpy.run_path(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "setup_demo.py"),
            run_name="__main__",
        )
    if os.environ.get("ZELVORA_AUTO_MIGRATE", "0") == "1":
        ensure_is_demo_column(verbose=False)
        ensure_integer_money_columns(verbose=False)
        ensure_sessions_table(verbose=False)
        print("Database migrations applied.")
    if SESSION_STORE == "db":
        from database import run_query
        try:
            run_query("SELECT 1 FROM sessions LIMIT 1")
        except Exception:
            raise SystemExit(
                "ZELVORA_SESSION_STORE=db requires the sessions table. "
                "Run `python migrate_db.py` (or set ZELVORA_AUTO_MIGRATE=1)."
            )
    if STATIC_DIR:
        print(f"Serving built frontend from {STATIC_DIR}")
    sys.argv = [os.path.join(os.path.dirname(os.path.abspath(__file__)), "server.py")]
    runpy.run_path(sys.argv[0], run_name="__main__")


if __name__ == "__main__":
    main()
