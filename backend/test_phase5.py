"""Local HTTP/MySQL recovery and log-privacy checks: python demo.py phase5.

Runs its own loopback server, never stops MySQL or changes application rows.
Fault injection and shortened sessions exist only in this test process.
"""
import contextlib
import http.client
import io
import json
import socket
import threading
import time
import unittest
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import auth
import server
from config import DB_CONFIG, DEMO_MODE
from demo_accounts import account_for_role
from demo_safety import require_demo_database


class RecoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not DEMO_MODE or DB_CONFIG['database'] != 'zelvora_demo_db':
            raise RuntimeError('Use python demo.py phase5; no private database testing.')
        require_demo_database()

    def setUp(self):
        self.logs = io.StringIO()
        redirect = contextlib.redirect_stdout(self.logs)
        redirect.__enter__()
        self.addCleanup(redirect.__exit__, None, None, None)
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.stop)
        self.cookie = ''

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()

    def request(self, method, path, body=None, cookie=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=15)
        try:
            connection.request(method, path, body=json.dumps(body) if body is not None else None,
                               headers={'Content-Type': 'application/json', 'X-Requested-With': 'ZELVORA',
                                        'Cookie': self.cookie if cookie is None else cookie})
            response = connection.getresponse()
            payload = json.loads(response.read())
            if response.getheader('Set-Cookie'):
                parsed = SimpleCookie(response.getheader('Set-Cookie'))
                self.cookie = 'zelvora_session=' + parsed['zelvora_session'].value
            return response.status, payload
        finally:
            connection.close()

    def login(self):
        account = account_for_role('customer')
        self.assertEqual(self.request('POST', '/api/auth/login', {k: account[k] for k in ('email', 'password')})[0], 200)

    def test_real_connection_refusal_503_and_recovery_preserve_session(self):
        self.login()
        # Reserve a non-listening local port, guaranteeing this is not MySQL.
        # Only this process's connection configuration changes, never .env/service.
        with socket.socket() as refused:
            refused.bind(('127.0.0.1', 0))
            with patch.dict(DB_CONFIG, port=refused.getsockname()[1], connection_timeout=1):
                for endpoint in ('/api/health', '/api/vehicles', '/api/bookings/mine', '/api/auth/me'):
                    with self.subTest(endpoint=endpoint):
                        status, payload = self.request('GET', endpoint)
                        self.assertEqual(status, 503)
                        self.assertNotIn('user', payload)
                        self.assertNotIn('vehicles', payload)
                        self.assertNotIn('bookings', payload)
        self.assertEqual(self.request('GET', '/api/health'), (200, {'status': 'ok', 'database': 'ok'}))
        self.assertIsNotNone(self.request('GET', '/api/auth/me')[1]['user'])
        self.assertEqual(self.request('GET', '/api/bookings/mine')[0], 200)
        self.assertNotIn('Traceback', self.logs.getvalue())
        self.assertNotIn('Access denied', self.logs.getvalue())

    def test_expired_real_mysql_session_is_401_over_http(self):
        self.login()
        token = SimpleCookie(self.cookie)['zelvora_session'].value
        auth._sessions[auth._key(token)]['expires'] = time.time() - 1
        self.assertEqual(self.request('GET', '/api/bookings/mine')[0], 401)
        self.assertIsNone(self.request('GET', '/api/auth/me')[1]['user'])
        self.login()
        self.assertEqual(self.request('GET', '/api/bookings/mine')[0], 200)

    def test_revoked_token_cannot_be_replayed_over_http(self):
        self.login()
        old_cookie = self.cookie
        self.assertEqual(self.request('POST', '/api/auth/logout')[0], 200)
        self.assertEqual(self.request('GET', '/api/bookings/mine', cookie=old_cookie)[0], 401)

    def test_lost_in_memory_session_requires_reauthentication(self):
        self.login()
        # Models a process restart without restarting the user's active backend.
        with patch.dict(auth._sessions, {}, clear=True):
            self.assertIsNone(self.request('GET', '/api/auth/me')[1]['user'])
            self.assertEqual(self.request('GET', '/api/bookings/mine')[0], 401)
            self.login()
            self.assertEqual(self.request('GET', '/api/bookings/mine')[0], 200)

    def test_request_logs_exclude_body_query_cookies_and_password_hash(self):
        sentinel = 'P5_PRIVATE_SENTINEL_91'
        self.request('POST', '/api/auth/login?token=' + sentinel,
                     {'email': 'logprobe@test.local', 'password': sentinel}, cookie='zelvora_session=' + sentinel)
        self.login()
        token = SimpleCookie(self.cookie)['zelvora_session'].value
        self.request('GET', '/api/bookings/mine?secret=' + sentinel)
        logs = self.logs.getvalue()
        self.assertIn('POST /api/auth/login -> 401', logs)
        self.assertIn('GET /api/bookings/mine -> 200', logs)
        for secret in (sentinel, token, account_for_role('customer')['password'], 'scrypt$', DB_CONFIG.get('password')):
            if secret:
                self.assertNotIn(secret, logs)


if __name__ == '__main__':
    unittest.main(verbosity=2)
