"""Phase 7 production-configuration checks (no owner/private data).

Run from backend:  python demo.py phase7
"""
import http.client
import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

import auth
import config
import server


class ConfigTests(unittest.TestCase):
    def test_origins_are_normalised(self):
        self.assertEqual(
            config.parse_origins(" https://a.example/ , http://b.example:8080 "),
            ("https://a.example", "http://b.example:8080"),
        )
        self.assertEqual(config.parse_origins(""), ())

    def test_origin_paths_and_schemes_are_rejected(self):
        for bad in ("https://a.example/path", "ftp://a.example", "not-an-origin"):
            with self.assertRaises(RuntimeError):
                config.parse_origins(bad)

    def test_cookie_flags(self):
        old = (auth.COOKIE_SECURE, auth.COOKIE_SAMESITE, auth.COOKIE_DOMAIN)
        try:
            auth.COOKIE_SECURE = True
            auth.COOKIE_SAMESITE = "None"
            auth.COOKIE_DOMAIN = ".example.com"
            cookie = auth.session_cookie("token", 60)
            self.assertIn("HttpOnly", cookie)
            self.assertIn("SameSite=None", cookie)
            self.assertIn("Secure", cookie)
            self.assertIn("Domain=.example.com", cookie)
            auth.COOKIE_SECURE = False
            auth.COOKIE_SAMESITE = "Lax"
            auth.COOKIE_DOMAIN = None
            cookie = auth.session_cookie("token", 60)
            self.assertNotIn("Secure", cookie)
            self.assertNotIn("Domain=", cookie)
        finally:
            auth.COOKIE_SECURE, auth.COOKIE_SAMESITE, auth.COOKIE_DOMAIN = old


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        root = Path(cls.tmp.name)
        static = root / "static"
        static.mkdir()
        (static / "assets").mkdir()
        (static / "images").mkdir()
        (static / "index.html").write_text("<!doctype html><title>ZELVORA TEST</title>", encoding="utf-8")
        (static / "assets" / "app.js").write_text("console.log('ok')", encoding="utf-8")
        (static / "images" / "car.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>", encoding="utf-8")
        (static / ".env").write_text("SECRET=should-not-leak", encoding="utf-8")
        (root / "secret.txt").write_text("should-not-leak", encoding="utf-8")
        cls.old_static, cls.old_origins = server.STATIC_DIR, server.ALLOWED_ORIGINS
        server.STATIC_DIR = str(static)
        server.ALLOWED_ORIGINS = ("https://app.example",)
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        server.STATIC_DIR, server.ALLOWED_ORIGINS = cls.old_static, cls.old_origins
        cls.tmp.cleanup()

    def request(self, method, path, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        try:
            conn.request(method, path, headers=headers or {})
            response = conn.getresponse()
            return response, response.read()
        finally:
            conn.close()

    def test_index_and_spa_fallback(self):
        for path in ("/", "/vehicles", "/admin/bookings"):
            response, body = self.request("GET", path)
            self.assertEqual(response.status, 200, path)
            self.assertIn(b"ZELVORA TEST", body)
            self.assertEqual(response.getheader("X-Frame-Options"), "DENY")
            self.assertEqual(response.getheader("X-Content-Type-Options"), "nosniff")
            self.assertIn("default-src 'self'", response.getheader("Content-Security-Policy"))
            self.assertEqual(response.getheader("Cache-Control"), "no-cache")

    def test_hashed_assets_are_cached(self):
        response, body = self.request("GET", "/assets/app.js")
        self.assertEqual(response.status, 200)
        self.assertIn("javascript", response.getheader("Content-Type"))
        self.assertIn("immutable", response.getheader("Cache-Control"))
        self.assertEqual(body, b"console.log('ok')")

    def test_svg_and_missing_assets(self):
        response, _ = self.request("GET", "/images/car.svg")
        self.assertEqual(response.status, 200)
        self.assertIn("image/svg+xml", response.getheader("Content-Type"))
        response, _ = self.request("GET", "/assets/missing.js")
        self.assertEqual(response.status, 404)

    def test_traversal_and_dotfiles_are_blocked(self):
        for path in ("/.env", "/%2e%2e/secret.txt", "/..%2fsecret.txt"):
            response, body = self.request("GET", path)
            self.assertEqual(response.status, 404, path)
            self.assertNotIn(b"should-not-leak", body)

    def test_unknown_api_is_json_404(self):
        response, body = self.request("GET", "/api/not-a-route")
        self.assertEqual(response.status, 404)
        self.assertIn(b"Not found", body)
        self.assertIn("application/json", response.getheader("Content-Type"))

    def test_head_static_has_no_body(self):
        response, body = self.request("HEAD", "/")
        self.assertEqual(response.status, 200)
        self.assertEqual(body, b"")

    def test_cors_preflight_allowed(self):
        response, _ = self.request("OPTIONS", "/api/health", {
            "Origin": "https://app.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-requested-with",
        })
        self.assertEqual(response.status, 204)
        self.assertEqual(response.getheader("Access-Control-Allow-Origin"), "https://app.example")
        self.assertEqual(response.getheader("Access-Control-Allow-Credentials"), "true")
        self.assertIn("POST", response.getheader("Access-Control-Allow-Methods"))
        self.assertIn("X-Requested-With", response.getheader("Access-Control-Allow-Headers"))
        self.assertEqual(response.getheader("Vary"), "Origin")

    def test_cors_rejects_unknown_origin(self):
        response, body = self.request("OPTIONS", "/api/health", {"Origin": "https://evil.example"})
        self.assertEqual(response.status, 403)
        self.assertIsNone(response.getheader("Access-Control-Allow-Origin"))
        self.assertIn(b"Origin not allowed", body)

    def test_cors_headers_on_api_response(self):
        response, _ = self.request("GET", "/api/health", {"Origin": "https://app.example"})
        self.assertEqual(response.getheader("Access-Control-Allow-Origin"), "https://app.example")
        self.assertIn(response.status, (200, 503))

    def test_plain_request_has_no_cors_headers(self):
        response, _ = self.request("GET", "/api/health")
        self.assertIsNone(response.getheader("Access-Control-Allow-Origin"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
