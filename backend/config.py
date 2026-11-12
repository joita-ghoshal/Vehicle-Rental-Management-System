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
    "connection_timeout": 5,
}


def _bool_env(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


# Hosted MySQL commonly requires TLS. Keep local defaults unchanged.
_ssl_ca = os.environ.get("ZELVORA_DB_SSL_CA", "").strip()
if _ssl_ca:
    DB_CONFIG["ssl_ca"] = _ssl_ca
_ssl_disabled = os.environ.get("ZELVORA_DB_SSL_DISABLED")
if _ssl_disabled is not None:
    DB_CONFIG["ssl_disabled"] = _bool_env("ZELVORA_DB_SSL_DISABLED", False)


ENVIRONMENT = os.environ.get("ZELVORA_ENV", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# Local safety default stays loopback-only. Hosting must opt in explicitly
# (the Docker image sets ZELVORA_API_HOST=0.0.0.0). Render/Heroku-style hosts
# also inject PORT; it wins over ZELVORA_API_PORT when present.
API_HOST = os.environ.get("ZELVORA_API_HOST", "127.0.0.1").strip() or "127.0.0.1"
API_PORT = int(os.environ.get("PORT") or os.environ.get("ZELVORA_API_PORT", "8000"))
SESSION_SECONDS = 8 * 60 * 60   # a login lasts 8 hours

# Production serves the built React app from this folder (single origin).
# Empty means "API only", which is the local development behaviour.
_static = os.environ.get("ZELVORA_STATIC_DIR", "").strip()
STATIC_DIR = os.path.abspath(os.path.join(_here, _static)) if _static else None

# Split-origin deployments only. Single-origin needs no CORS at all.
def parse_origins(value):
    origins = []
    for item in (value or "").split(","):
        origin = item.strip().rstrip("/")
        if not origin:
            continue
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise RuntimeError(f"Invalid ZELVORA_ALLOWED_ORIGINS entry: {origin!r}")
        if parsed.path or parsed.query or parsed.fragment:
            raise RuntimeError("ZELVORA_ALLOWED_ORIGINS entries must be origins only (no path).")
        if origin not in origins:
            origins.append(origin)
    return tuple(origins)


ALLOWED_ORIGINS = parse_origins(os.environ.get("ZELVORA_ALLOWED_ORIGINS", ""))

COOKIE_SECURE = _bool_env("ZELVORA_COOKIE_SECURE", IS_PRODUCTION)
COOKIE_SAMESITE = os.environ.get("ZELVORA_COOKIE_SAMESITE", "Lax").strip().capitalize()
COOKIE_DOMAIN = os.environ.get("ZELVORA_COOKIE_DOMAIN", "").strip() or None
if COOKIE_SAMESITE not in ("Lax", "Strict", "None"):
    raise RuntimeError("ZELVORA_COOKIE_SAMESITE must be Lax, Strict or None.")
if COOKIE_SAMESITE == "None" and not COOKIE_SECURE:
    raise RuntimeError("SameSite=None cookies require ZELVORA_COOKIE_SECURE=1 (HTTPS).")

# memory = existing local behaviour; db = sessions survive process restarts.
SESSION_STORE = os.environ.get("ZELVORA_SESSION_STORE", "memory").strip().lower()
if SESSION_STORE not in ("memory", "db"):
    raise RuntimeError("ZELVORA_SESSION_STORE must be 'memory' or 'db'.")

# Public credentials must never authenticate against the owner's database.
DEMO_MODE = os.environ.get("ZELVORA_DEMO_MODE", "0") == "1"
DEMO_DB_NAME = "zelvora_demo_db"
if DEMO_MODE and DB_CONFIG["database"] != DEMO_DB_NAME:
    raise RuntimeError("Demo mode requires the separate zelvora_demo_db database.")
