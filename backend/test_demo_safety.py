"""Non-mutating isolation tests. Run: python -m unittest test_demo_safety -v"""
import os
import subprocess
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import auth
import demo_access
import demo_safety
import seed_demo
from demo_accounts import DEMO_ACCOUNTS
from utils import ApiError


class DemoSafetyTests(unittest.TestCase):
    def test_private_environment_never_publishes_credentials(self):
        with patch('demo_access.DEMO_MODE', False), patch('demo_access.run_query') as query:
            self.assertEqual(demo_access.credentials(None), (200, {'enabled': False, 'accounts': []}))
            query.assert_not_called()

    def test_private_environment_refuses_public_account_login(self):
        account = DEMO_ACCOUNTS[1]
        ctx = SimpleNamespace(body={'email': account['email'], 'password': account['password']}, token=None)
        with patch('auth.DEMO_MODE', False), patch('auth.run_query', return_value={'id': 1, 'is_demo': 1, 'password_hash': auth.hash_password(account['password'])}):
            with self.assertRaises(ApiError) as error:
                auth.login(ctx)
            self.assertEqual(error.exception.status, 401)

    def test_legacy_demo_session_rejected_in_private_environment(self):
        stored = auth.hash_password('Synthetic123')
        with patch('auth.run_query', side_effect=[{'password_hash': stored}, {'id': 1, 'is_demo': 1, 'password_hash': stored}]), patch('auth.DEMO_MODE', False):
            token = auth.create_session(1)
            self.assertIsNone(auth.get_user_for_token(token))
            auth.destroy_session(token)

    def test_seed_refuses_private_database_before_any_write(self):
        with patch('demo_safety.DEMO_MODE', False), patch('seed_demo.run_write') as write:
            with self.assertRaises(RuntimeError):
                seed_demo.main()
            write.assert_not_called()

    def test_seed_refuses_to_take_over_non_demo_account(self):
        with patch('seed_demo.run_query', return_value={'id': 1, 'is_demo': 0, 'role': 'admin'}), patch('seed_demo.run_write') as write:
            with self.assertRaises(SystemExit):
                seed_demo._seed(DEMO_ACCOUNTS[1])
            write.assert_not_called()

    def test_seed_refuses_role_mismatch(self):
        with patch('seed_demo.run_query', return_value={'id': 1, 'is_demo': 1, 'role': 'customer'}), patch('seed_demo.run_write') as write:
            with self.assertRaises(SystemExit):
                seed_demo._seed(DEMO_ACCOUNTS[1])
            write.assert_not_called()

    def test_missing_marker_fails_closed(self):
        with patch('demo_safety.DEMO_MODE', True), patch.dict(demo_safety.DB_CONFIG, database='zelvora_demo_db'), patch('demo_safety.run_query', return_value=None):
            with self.assertRaises(RuntimeError):
                demo_safety.require_demo_database()

    def test_changed_password_is_not_advertised(self):
        with patch('demo_access.DEMO_MODE', True), patch('demo_access.require_demo_database'), patch('demo_access.run_query', return_value={'role': 'admin', 'is_demo': 1, 'password_hash': auth.hash_password('ChangedSecret123')}):
            self.assertEqual(demo_access.credentials(None)[1]['accounts'], [])

    def test_demo_mode_cannot_point_to_private_database(self):
        env = dict(os.environ, ZELVORA_DEMO_MODE='1', ZELVORA_DB_NAME='zelvora_db')
        result = subprocess.run([sys.executable, '-c', 'import config'], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('separate zelvora_demo_db', result.stderr)


if __name__ == '__main__':
    unittest.main()
