"""ZELVORA API server. Run with:  python server.py

Uses only Python's built-in http.server. It is meant for local demos,
not for the public internet.
"""
import json
import re
import traceback
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import mysql.connector

import admin
import auth
import bookings
import vehicles
from config import API_HOST, API_PORT
from utils import ApiError, JsonEncoder

MAX_BODY = 1_000_000

# (method, path pattern, handler)
ROUTES = [
    ("GET", r"/api/health", lambda ctx: (200, {"status": "ok"})),
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

    def log_message(self, fmt, *args):
        print(f"{self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    def _send(self, status, payload, cookie=None):
        body = json.dumps(payload, cls=JsonEncoder).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "The request is too large.")
        if length == 0:
            return {}
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            raise ApiError(415, "Requests must be sent as JSON.")
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "The request body is not valid JSON.")
        if not isinstance(data, dict):
            raise ApiError(400, "The request body must be a JSON object.")
        return data

    def _handle(self, method):
        ctx = Context()
        try:
            url = urlparse(self.path)
            path = url.path.rstrip("/") or "/"
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
            cookies = SimpleCookie(self.headers.get("Cookie") or "")
            ctx.token = cookies["zelvora_session"].value if "zelvora_session" in cookies else None
            ctx.user = auth.get_user_for_token(ctx.token)

            status, payload = handler(ctx)
            self._send(status, payload, ctx.set_cookie)
        except ApiError as e:
            self._send(e.status, {"error": e.message, "fields": e.fields})
        except mysql.connector.Error:
            traceback.print_exc()
            self._send(500, {"error": "The database is not responding. Check that MySQL is running and the settings are right."})
        except Exception:
            traceback.print_exc()
            self._send(500, {"error": "Something went wrong on the server."})

    def do_GET(self): self._handle("GET")
    def do_POST(self): self._handle("POST")
    def do_PUT(self): self._handle("PUT")


if __name__ == "__main__":
    try:
        from database import get_connection
        get_connection().close()
        print("MySQL connection OK.")
    except mysql.connector.Error as e:
        print(f"Could not connect to MySQL: {e}\nCheck backend/.env and that MySQL is running.")
        raise SystemExit(1)
    httpd = ThreadingHTTPServer((API_HOST, API_PORT), Handler)
    print(f"ZELVORA API running at http://{API_HOST}:{API_PORT}  (press Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
