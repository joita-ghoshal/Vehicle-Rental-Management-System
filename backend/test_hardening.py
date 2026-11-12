"""Phase 3 unit/fault-injection checks; never writes to MySQL."""
import http.client
import json
import socket
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch

import mysql.connector

import auth
import demo_safety
import server
import vehicles
from utils import ApiError, money_value, parse_date, whole_number


class ManagedTestCase(unittest.TestCase):
    def enterContext(self, context):
        # Match unittest's newer helper while retaining the project's Python 3.10 minimum.
        value = context.__enter__()
        self.addCleanup(context.__exit__, None, None, None)
        return value


class ValidationTests(ManagedTestCase):
    def test_integer_inputs_are_strict(self):
        for value in (True, False, 1.2, 1.0, None, [], {}, '1.5', '-1', '1e2', '9' * 100, 4294967296):
            with self.subTest(value=value), self.assertRaises(ValueError):
                whole_number(value)
        self.assertEqual(whole_number(' 005 '), 5)

    def test_money_is_whole_rupees_only(self):
        for value in (True, False, None, [], {}, 'NaN', 'sNaN', 'Infinity', float('inf'),
                      2.5, 2.0, Decimal('2.68'), '-1', '1000001', '1e999999', '2.675', '500.00'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                money_value(value)
        self.assertEqual(money_value('500'), 500)
        self.assertEqual(money_value(500), 500)
        self.assertEqual(money_value(' 005 '), 5)

    def test_date_format_is_strict(self):
        for value in ('20261110', '2026-W46-2', '2026-02-30', [], True, '2026-1-01'):
            with self.subTest(value=value), self.assertRaises(ApiError):
                parse_date(value, 'Pickup', 'pickup_date')

    def test_malformed_hashes_do_not_raise_or_allocate_unbounded_scrypt(self):
        for value in (None, '', 'broken', 'scrypt$999999999999999$8$1$aa$bb',
                      'scrypt$16384$8$1$aa$bb', 'scrypt$16384$8$1$zz$zz'):
            with self.subTest(value=value):
                self.assertFalse(auth.verify_password('Password123', value))


class AuthStateTests(ManagedTestCase):
    def setUp(self):
        self.enterContext(patch.dict(auth._sessions, {}, clear=True))
        self.enterContext(patch.dict(auth._failed_logins, {}, clear=True))
        self.enterContext(patch('auth._last_cleanup', 0))

    def test_global_cleanup_prunes_expired_sessions_and_login_emails(self):
        now = time.time()
        auth._sessions.update(expired={'expires': now}, live={'expires': now + 100})
        auth._failed_logins.update(old=[now - 601], mixed=[now - 601, now - 10], empty=[])
        auth.cleanup_auth_state()
        self.assertEqual(set(auth._sessions), {'live'})
        self.assertEqual(auth._failed_logins, {'mixed': [now - 10]})

    def test_expiry_boundary_is_exclusive(self):
        token = 'boundary'
        now = time.time()
        auth._sessions[auth._key(token)] = {'user_id': 1, 'password_stamp': 'unused', 'expires': now}
        with patch('auth.time.time', return_value=now), patch('auth.run_query') as query:
            self.assertIsNone(auth.get_user_for_token(token))
            query.assert_not_called()

    def test_logout_revokes_token_not_just_browser_cookie(self):
        with patch('auth.run_query', return_value={'password_hash': 'test-hash'}):
            token = auth.create_session(123)
        auth.destroy_session(token)
        with patch('auth.run_query') as query:
            self.assertIsNone(auth.get_user_for_token(token))
            query.assert_not_called()

    def test_long_session_tokens_skip_database(self):
        with patch('auth.run_query') as query:
            self.assertIsNone(auth.get_user_for_token('x' * 201))
            query.assert_not_called()

    def test_long_login_password_skips_database(self):
        ctx = SimpleNamespace(body={'email': 'synthetic@test.local', 'password': 'x' * 129})
        with patch('auth.run_query') as query, self.assertRaises(ApiError) as error:
            auth.login(ctx)
        self.assertEqual(error.exception.status, 400)
        query.assert_not_called()

    def test_concurrent_wrong_passwords_cannot_bypass_limit(self):
        ctx = SimpleNamespace(body={'email': 'concurrent@test.local', 'password': 'WrongPass1'})
        def attempt(_):
            try:
                auth.login(ctx)
            except ApiError as error:
                return error.status
        with patch('auth.run_query', return_value={'id': 1, 'is_demo': 0, 'password_hash': 'unused'}), patch('auth.verify_password', return_value=False):
            with ThreadPoolExecutor(max_workers=12) as pool:
                statuses = list(pool.map(attempt, range(12)))
        self.assertEqual(sorted(statuses), [401] * 5 + [429] * 7)
        self.assertEqual(len(auth._failed_logins['concurrent@test.local']), 5)

    def test_login_email_map_is_bounded(self):
        now = time.time()
        auth._failed_logins['existing@test.local'] = [now]
        ctx = SimpleNamespace(body={'email': 'new@test.local', 'password': 'WrongPass1'})
        with patch('auth.MAX_LOGIN_EMAILS', 1), self.assertRaises(ApiError) as error:
            auth.login(ctx)
        self.assertEqual(error.exception.status, 429)
        self.assertEqual(len(auth._failed_logins), 1)

    def test_new_session_for_deleted_account_is_401(self):
        with patch('auth.run_query', return_value=None), self.assertRaises(ApiError) as error:
            auth.create_session(123)
        self.assertEqual(error.exception.status, 401)

    def test_password_reset_race_does_not_issue_a_session(self):
        with patch('auth.run_query', return_value={'password_hash': 'new-hash'}), self.assertRaises(ApiError) as error:
            auth.create_session(123, expected_hash='old-hash')
        self.assertEqual(error.exception.status, 401)
        self.assertEqual(auth._sessions, {})

    def test_database_outage_does_not_consume_login_limit(self):
        ctx = SimpleNamespace(body={'email': 'outage@test.local', 'password': 'WrongPass1'})
        with patch('auth.run_query', side_effect=mysql.connector.Error('test outage')), self.assertRaises(mysql.connector.Error):
            auth.login(ctx)
        self.assertEqual(auth._failed_logins, {})


class IsolationGuardTests(ManagedTestCase):
    def test_non_reserved_email_in_demo_fails_closed(self):
        with patch('demo_safety.DEMO_MODE', True), patch.dict(demo_safety.DB_CONFIG, database='zelvora_demo_db'), patch('demo_safety.run_query', side_effect=[{'purpose': 'synthetic-only-v1'}, {'n': 1}]):
            with self.assertRaises(RuntimeError):
                demo_safety.require_demo_database()


class HttpHardeningTests(ManagedTestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def setUp(self):
        self.enterContext(patch('server.DEMO_MODE', False))
        self.enterContext(patch('health.DEMO_MODE', False))
        self.user_lookup = self.enterContext(patch('auth.get_user_for_token', return_value=None))

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=15)
        try:
            conn.request(method, path, body=body, headers={'X-Requested-With': 'ZELVORA', 'Content-Type': 'application/json', **(headers or {})})
            response = conn.getresponse()
            return response.status, json.loads(response.read())
        finally:
            conn.close()

    def test_health_reports_database_ok_without_user_lookup(self):
        with patch('health.run_query', return_value={'ready': 1}):
            status, payload = self.request('GET', '/api/health', headers={'Cookie': 'zelvora_session=stale'})
        self.assertEqual((status, payload), (200, {'status': 'ok', 'database': 'ok'}))
        self.user_lookup.assert_not_called()

    def test_health_db_failure_is_503_without_secrets_even_with_cookie(self):
        with patch('health.run_query', side_effect=mysql.connector.Error('SECRET_SENTINEL')):
            status, payload = self.request('GET', '/api/health', headers={'Cookie': 'zelvora_session=stale'})
        self.assertEqual(status, 503)
        self.assertEqual(payload, {'status': 'unavailable', 'database': 'unavailable'})
        self.assertNotIn('SECRET_SENTINEL', json.dumps(payload))
        self.user_lookup.assert_not_called()

    def test_health_rejects_invalid_demo_marker(self):
        with patch('health.DEMO_MODE', True), patch('health.run_query', return_value={'ready': 1}), patch('health.require_demo_database', side_effect=RuntimeError('SECRET_SENTINEL')):
            status, payload = self.request('GET', '/api/health')
        self.assertEqual(status, 503)
        self.assertNotIn('SECRET_SENTINEL', json.dumps(payload))

    def test_demo_request_checks_marker_before_user_data(self):
        with patch('server.DEMO_MODE', True), patch('server.require_demo_database', side_effect=RuntimeError('invalid marker')):
            status, _ = self.request('GET', '/api/admin/customers')
        self.assertEqual(status, 503)
        self.user_lookup.assert_not_called()

    def test_business_database_failure_has_generic_503(self):
        with patch('vehicles.run_query', side_effect=mysql.connector.Error('SECRET_SENTINEL')):
            status, payload = self.request('GET', '/api/vehicles')
        self.assertEqual(status, 503)
        self.assertNotIn('SECRET_SENTINEL', json.dumps(payload))

    def test_malformed_json_and_non_objects_are_400(self):
        for body in ('{bad', '[]', 'null', '42', '{"password":NaN}', '{"password":Infinity}',
                     '{"price":1e999}', r'{"name":"\ud800"}', '{"nested":' + '[' * 1100 + '0' + ']' * 1100 + '}'):
            with self.subTest(body=body):
                self.assertEqual(self.request('POST', '/api/auth/login', body)[0], 400)

    def test_bad_content_lengths_are_400(self):
        for length in ('-1', 'nope', '+3'):
            with self.subTest(length=length):
                self.assertEqual(self.request('POST', '/api/auth/login', headers={'Content-Length': length})[0], 400)

    def test_oversized_body_is_413_before_read(self):
        self.assertEqual(self.request('POST', '/api/auth/login', headers={'Content-Length': '1000001'})[0], 413)

    def test_unsupported_content_type_is_415(self):
        for content_type in ('text/plain', 'application/json-fake'):
            with self.subTest(content_type=content_type):
                self.assertEqual(self.request('POST', '/api/auth/login', '{}', {'Content-Type': content_type})[0], 415)

    def test_chunked_request_is_400(self):
        self.assertEqual(self.request('POST', '/api/auth/login', '{}', {'Transfer-Encoding': 'chunked'})[0], 400)

    def test_duplicate_lengths_are_400(self):
        conn = http.client.HTTPConnection('127.0.0.1', self.httpd.server_port, timeout=15)
        try:
            conn.putrequest('POST', '/api/auth/login')
            conn.putheader('X-Requested-With', 'ZELVORA')
            conn.putheader('Content-Length', '0')
            conn.putheader('Content-Length', '1')
            conn.endheaders()
            response = conn.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
        finally:
            conn.close()

    def test_unknown_routes_and_methods_are_not_500(self):
        self.assertEqual(self.request('GET', '/api/not-a-route')[0], 404)
        self.assertEqual(self.request('PUT', '/api/health', '{}')[0], 405)
        with socket.create_connection(('127.0.0.1', self.httpd.server_port), timeout=15) as sock:
            sock.sendall(b'GET http://[invalid/path HTTP/1.1\r\nHost: localhost\r\n\r\n')
            response = http.client.HTTPResponse(sock)
            response.begin()
            self.assertEqual(response.status, 400)
            response.read()


if __name__ == '__main__':
    unittest.main()
