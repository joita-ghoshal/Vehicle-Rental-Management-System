"""Isolated local demo commands. Never changes the owner's .env/database."""
import argparse
import os
import runpy
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("setup", "serve", "seed", "reset-main", "test", "regression", "audit", "phase3", "phase5", "phase7"))
    args = parser.parse_args()
    os.environ["ZELVORA_DB_NAME"] = "zelvora_demo_db"
    os.environ["ZELVORA_DEMO_MODE"] = "1"
    scripts = {"setup": "setup_demo.py", "serve": "server.py", "seed": "seed_demo.py",
               "reset-main": "create_admin.py", "test": "test_phase2.py", "regression": "test_api.py",
               "audit": "audit_demo.py", "phase3": "test_phase3.py", "phase5": "test_phase5.py",
               "phase7": "test_phase7.py"}
    import sys
    sys.argv = [scripts[args.command]] + (["--reset-main"] if args.command == "reset-main" else [])
    runpy.run_path(str(Path(__file__).parent / scripts[args.command]), run_name="__main__")


if __name__ == "__main__":
    main()
