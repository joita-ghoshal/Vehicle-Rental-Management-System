"""ZELVORA API server. Run with:  python server.py

Uses only Python's built-in http.server. It is meant for local demos,
not for the public internet.
"""
import json
import mimetypes
import os
import posixpath
import re
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import mysql.connector

import admin
import auth
import bookings
import vehicles
import demo_access
from demo_safety import require_demo_database
from health import health
from config import (ALLOWED_ORIGINS, API_HOST, API_PORT, COOKIE_SECURE,
                    DEMO_MODE, STATIC_DIR)
from utils import ApiError, JsonEncoder

MAX_BODY = 1_000_000

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("application/json", ".json")

_connect_src = " ".join(ALLOWED_ORIGINS)
CSP = (
    "default-src 'self'; script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: https:; "
    f"connect-src 'self'{(' ' + _connect_src) if _connect_src else ''}; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)

# (method, path pattern, handler)
ROUTES = [
    ("GET", r"/api/health", health),
    ("GET", r"/api/demo/credentials", demo_access.credentials),
    ("POST", r"/api/auth/register", auth.register),
    ("POST", r"/api/auth/login", auth.login),
    ("POST", r"/api/auth/logout", auth.logout),
    ("GET", r"/api/auth/me", auth.current_user),
    ("PUT", r"/api/profile", auth.update_profile),
    ("GET", r"/api/vehicles", vehicles.list_vehicles),
    ("GET", r"/api/vehicles/(?P<id>\d+)", vehicles.get_vehicle),
    ("GET", r"/api/vehicles/(?P<id>\d+)/availability", vehicles.check_availability),
    ("POST", r"/api/bookings", bookings.create_booking),
    ("GET", r"/api/bookings/mine", bookings.my_bookings),
    ("POST", r"/api/bookings/(?P<id>\d+)/cancel", bookings.cancel_booking),
    ("GET", r"/api/admin/dashboard", admin.dashboard),
    ("GET", r"/api/admin/vehicles", admin.list_vehicles),
    ("POST", r"/api/admin/vehicles", admin.add_vehicle),
    ("GET", r"/api/admin/vehicles/(?P<id>\d+)", admin.get_vehicle),
    ("PUT", r"/api/admin/vehicles/(?P<id>\d+)", admin.edit_vehicle),
    ("POST", r"/api/admin/vehicles/(?P<id>\d+)/archive", admin.archive_vehicle),
    ("POST", r"/api/admin/vehicles/(?P<id>\d+)/restore", admin.restore_vehicle),
    ("GET", r"/api/admin/customers", admin.list_customers),
    ("GET", r"/api/admin/bookings", admin.list_bookings),
    ("POST", r"/api/admin/bookings/(?P<id>\d+)/approve", admin.approve_booking),
    ("POST", r"/api/admin/bookings/(?P<id>\d+)/reject", admin.reject_booking),
    ("POST", r"/api/admin/bookings/(?P<id>\d+)/complete", admin.complete_booking),
    ("PUT", r"/api/admin/bookings/(?P<id>\d+)/payment", admin.update_payment),
]
COMPILED = [(m, re.compile("^" + p + "$"), h) for m, p, h in ROUTES]


class Context:
    """What a handler needs to know about one request."""

    def __init__(self):
        self.query = {}
        self.params = {}
        self.body = {}
        self.token = None
        self.user = None
        self.set_cookie = None


class Handler(BaseHTTPRequestHandler):
    server_version = "Zelvora"

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, fmt, *args):
        try:
            path = urlparse(getattr(self, 'path', '')).path
        except ValueError:
            path = '<invalid request target>'
        print(f"{getattr(self, 'command', '')} {path} -> {args[1] if len(args) > 1 else ''}")

    def _cors_origin(self):
        origin = self.headers.get("Origin")
        return origin if origin and origin in ALLOWED_ORIGINS else None

    def _security_headers(self):
        headers = [
            ("X-Content-Type-Options", "nosniff"),
            ("Referrer-Policy", "strict-origin-when-cross-origin"),
            ("X-Frame-Options", "DENY"),
            ("Permissions-Policy", "geolocation=(), microphone=(), camera=()"),
        ]
        if COOKIE_SECURE:
            headers.append(("Strict-Transport-Security", "max-age=31536000; includeSubDomains"))
        return headers

    def _cors_headers(self):
        origin = self._cors_origin()
        if not origin:
            return []
        return [
            ("Access-Control-Allow-Origin", origin),
            ("Access-Control-Allow-Credentials", "true"),
            ("Vary", "Origin"),
        ]

    def _send(self, status, payload, cookie=None):
        body = json.dumps(payload, cls=JsonEncoder, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in self._security_headers() + self._cors_headers():
            self.send_header(name, value)
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _read_body(self):
        lengths = self.headers.get_all('Content-Length', [])
        if self.headers.get('Transfer-Encoding') or len(lengths) > 1:
            raise ApiError(400, "Unsupported request framing.")
        raw_length = self.headers.get('Content-Length', '0')
        if not re.fullmatch(r'[0-9]{1,10}', raw_length):
            raise ApiError(400, "Invalid Content-Length.")
        length = int(raw_length)
        if length > MAX_BODY:
            raise ApiError(413, "The request is too large.")
        if length == 0:
            return {}
        if (self.headers.get("Content-Type") or "").split(';', 1)[0].strip().lower() != 'application/json':
            raise ApiError(415, "Requests must be sent as JSON.")
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError('Incomplete body')
            def reject_constant(value):
                raise ValueError('Non-finite JSON number')
            data = json.loads(raw.decode("utf-8"), parse_constant=reject_constant)
            # Reject lone escaped surrogates and exponent overflow (1e999)
            # before strings/numbers can reach password hashing or MySQL.
            json.dumps(data, ensure_ascii=False, allow_nan=False).encode('utf-8')
        except (ValueError, UnicodeError, RecursionError):
            raise ApiError(400, "The request body is not valid JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "The request body must be a JSON object.")
        return data

    def _static_not_found(self):
        self._send(404, {"error": "Not found."})

    def _serve_static(self, url_path):
        """Serve the built React app, with a 200 SPA fallback for deep links."""
        rel = posixpath.normpath(url_path.lstrip("/"))
        if rel in ("", "."):
            rel = "index.html"
        parts = rel.split("/")
        if rel.startswith("..") or rel.startswith("/") or any(part.startswith(".") for part in parts):
            return self._static_not_found()
        static_root = os.path.realpath(STATIC_DIR)
        full = os.path.realpath(os.path.join(static_root, rel))
        try:
            inside = os.path.normcase(os.path.commonpath([full, static_root])) == os.path.normcase(static_root)
        except ValueError:
            inside = False
        if not inside:
            return self._static_not_found()
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
            rel = posixpath.join(rel, "index.html")
        if not os.path.isfile(full):
            # Extensionless paths are React routes; real missing assets stay 404.
            if "." not in rel.rsplit("/", 1)[-1]:
                full, rel = os.path.join(static_root, "index.html"), "index.html"
            else:
                return self._static_not_found()
        if not os.path.isfile(full):
            return self._static_not_found()
        try:
            with open(full, "rb") as handle:
                data = handle.read()
        except OSError:
            return self._static_not_found()
        content_type = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in (
            "application/javascript", "application/json", "image/svg+xml"
        ):
            content_type += "; charset=utf-8"
        if rel.startswith("assets/"):
            cache = "public, max-age=31536000, immutable"
        elif rel in ("index.html", "404.html"):
            cache = "no-cache"
        else:
            cache = "public, max-age=3600"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache)
        for name, value in self._security_headers() + self._cors_headers():
            self.send_header(name, value)
        if content_type.startswith("text/html"):
            self.send_header("Content-Security-Policy", CSP)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _handle(self, method):
        ctx = Context()
        try:
            auth.cleanup_auth_state()
            try:
                url = urlparse(self.path)
            except ValueError:
                raise ApiError(400, 'Invalid request target.')
            raw_path = url.path or "/"
            is_api = raw_path == "/api" or raw_path.startswith("/api/")
            if not is_api and STATIC_DIR:
                if method not in ("GET", "HEAD"):
                    raise ApiError(405, "Method not allowed.")
                return self._serve_static(raw_path)
            path = raw_path.rstrip("/") or "/"
            handler = None
            path_known = False
            for route_method, pattern, func in COMPILED:
                match = pattern.match(path)
                if match:
                    path_known = True
                    if route_method == method:
                        handler, ctx.params = func, match.groupdict()
                        break
            if not handler:
                raise ApiError(405 if path_known else 404, "Method not allowed." if path_known else "Not found.")

            if method != "GET" and self.headers.get("X-Requested-With") != "ZELVORA":
                raise ApiError(403, "Missing security header.")
            ctx.query = {k: v[0] for k, v in parse_qs(url.query).items()}
            ctx.body = self._read_body() if method != "GET" else {}
            # Readiness must remain observable even with a stale session cookie
            # while MySQL is down. No user lookup is needed for this endpoint.
            if path == '/api/health':
                status, payload = handler(ctx)
                self._send(status, payload)
                return
            if DEMO_MODE:
                try:
                    require_demo_database()
                except RuntimeError:
                    raise ApiError(503, "The demo environment is unavailable.")
            cookies = SimpleCookie(self.headers.get("Cookie") or "")
            ctx.token = cookies["zelvora_session"].value if "zelvora_session" in cookies else None
            ctx.user = auth.get_user_for_token(ctx.token)

            status, payload = handler(ctx)
            self._send(status, payload, ctx.set_cookie)
        except ApiError as e:
            self._send(e.status, {"error": e.message, "fields": e.fields})
        except mysql.connector.Error:
            print("Database request failed; no connection details are logged.")
            self._send(503, {"error": "The database is temporarily unavailable. Please try again later."})
        except CookieError:
            self._send(400, {"error": "Invalid session cookie."})
        except TimeoutError:
            self._send(408, {"error": "The request timed out."})
        except Exception as e:
            print(f"Unexpected request failure: {type(e).__name__}")
            self._send(500, {"error": "Something went wrong on the server."})

    def do_GET(self): self._handle("GET")
    def do_POST(self): self._handle("POST")
    def do_PUT(self): self._handle("PUT")
    def do_HEAD(self): self._handle("HEAD")

    def do_OPTIONS(self):
        origin = self._cors_origin()
        if not origin:
            self._send(403, {"error": "Origin not allowed."})
            return
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")
        self.send_header("Access-Control-Max-Age", "600")
        for name, value in self._security_headers() + self._cors_headers():
            self.send_header(name, value)
        self.end_headers()


if __name__ == "__main__":
    try:
        from database import get_connection
        get_connection().close()
        if DEMO_MODE:
            from demo_safety import require_demo_database
            require_demo_database()
        if STATIC_DIR and not os.path.isdir(STATIC_DIR):
            raise RuntimeError(f"ZELVORA_STATIC_DIR is not a directory: {STATIC_DIR}")
        print("MySQL connection OK.")
    except (mysql.connector.Error, RuntimeError) as e:
        print(f"Startup readiness failed ({type(e).__name__}). Check local configuration and MySQL; no secrets are logged.")
        raise SystemExit(1)
    httpd = ThreadingHTTPServer((API_HOST, API_PORT), Handler)
    mode = "single-origin app + API" if STATIC_DIR else "API only"
    print(f"ZELVORA {mode} running at http://{API_HOST}:{API_PORT}  (press Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
