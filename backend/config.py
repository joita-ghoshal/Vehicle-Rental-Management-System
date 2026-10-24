"""Settings for the ZELVORA backend.

Values come from environment variables or from a file called ".env" in this
folder (copy ".env.example" to ".env" and edit it). Nothing secret is stored
in the code and nothing here is ever sent to the browser.
"""
import os

_here = os.path.dirname(os.path.abspath(__file__))


def _load_env_file():
    path = os.path.join(_here, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            # Real environment variables win over the file.
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file()

DB_CONFIG = {
    "host": os.environ.get("ZELVORA_DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("ZELVORA_DB_PORT", "3306")),
    "user": os.environ.get("ZELVORA_DB_USER", "root"),
    "password": os.environ.get("ZELVORA_DB_PASSWORD", ""),
    "database": os.environ.get("ZELVORA_DB_NAME", "zelvora_db"),
}

API_HOST = "127.0.0.1"          # only this computer can reach the API
API_PORT = int(os.environ.get("ZELVORA_API_PORT", "8000"))
SESSION_SECONDS = 8 * 60 * 60   # a login lasts 8 hours
