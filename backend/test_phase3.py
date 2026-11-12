"""Phase 3 real-MySQL integration + unit/fault-injection tests.

Run with the isolated backend running: python demo.py phase3
Only individually tracked temporary rows are removed; never resets demo data.
"""
import datetime
import json
import threading
import unittest
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.cookiejar import CookieJar

from auth import hash_password
from config import API_HOST, API_PORT, DB_CONFIG, DEMO_MODE
from database import run_query, run_write, transaction
from demo_accounts import account_for_role
from demo_safety import require_demo_database
from test_hardening import AuthStateTests, HttpHardeningTests, IsolationGuardTests, ValidationTests


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

    def call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(f'http://{API_HOST}:{API_PORT}' + path, method=method, data=data,
                                         headers={'Content-Type': 'application/json', 'X-Requested-With': 'ZELVORA'})
        try:
            response = self.opener.open(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def login(self, account):
        return self.call('POST', '/api/auth/login', {k: account[k] for k in ('email', 'password')})


def date(offset):
    return (datetime.date.today() + datetime.timedelta(days=offset)).isoformat()


class MysqlIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not DEMO_MODE or DB_CONFIG['database'] != 'zelvora_demo_db':
            raise RuntimeError('Use python demo.py phase3; private databases must not be mutated by tests.')
        require_demo_database()
        cls.users, cls.vehicles = [], []
        cls.addClassCleanup(cls.cleanup)
        cls.main, cls.demo_customer = Client(), Client()
        assert cls.main.login(account_for_role('admin'))[0] == 200
        assert cls.demo_customer.login(account_for_role('customer'))[0] == 200
        cls.normal_admin, cls.customer = Client(), Client()
        for role, client in (('admin', cls.normal_admin), ('customer', cls.customer)):
            account = {'email': f'phase3.{uuid.uuid4().hex}@test.local', 'password': 'SyntheticPass123'}
            uid, _ = run_write("INSERT INTO users (name,email,phone,password_hash,role,is_demo) VALUES (%s,%s,%s,%s,%s,0)",
                               ('TEST Phase3 ' + role, account['email'], '9000000000', hash_password(account['password']), role))
            cls.users.append(uid)
            assert client.login(account)[0] == 200

    @classmethod
    def cleanup(cls):
        with transaction() as cur:
            if cls.vehicles:
                fmt = ','.join(['%s'] * len(cls.vehicles))
                cur.execute(f'DELETE FROM bookings WHERE vehicle_id IN ({fmt})', cls.vehicles)
                cur.execute(f'DELETE FROM vehicles WHERE id IN ({fmt})', cls.vehicles)
            if cls.users:
                fmt = ','.join(['%s'] * len(cls.users))
                cur.execute(f'DELETE FROM bookings WHERE user_id IN ({fmt})', cls.users)
                cur.execute(f'DELETE FROM users WHERE id IN ({fmt})', cls.users)

    def payload(self, **changes):
        value = {'name': 'TEST Phase3 Car', 'brand': 'Synthetic', 'model': 'P3', 'category': 'Car',
                 'registration_number': 'P3 ' + uuid.uuid4().hex[:20].upper(), 'fuel_type': 'Petrol',
                 'transmission': 'Manual', 'seats': 5, 'price_per_day': '999', 'image_url': '',
                 'description': 'Fictional vehicle for temporary Phase 3 tests.', 'status': 'Active'}
        value.update(changes)
        return value

    def setUp(self):
        self.vehicle_payload = self.payload()
        status, data = self.main.call('POST', '/api/admin/vehicles', self.vehicle_payload)
        self.assertEqual(status, 201, data)
        self.vehicle = data['vehicle']['id']
        self.vehicles.append(self.vehicle)

    def book(self, start=10, end=11, client=None):
        status, data = (client or self.customer).call('POST', '/api/bookings',
            {'vehicle_id': self.vehicle, 'pickup_date': date(start), 'return_date': date(end)})
        self.assertEqual(status, 201, data)
        return data['booking']['id']

    def test_health_checks_real_mysql(self):
        self.assertEqual(Client().call('GET', '/api/health'), (200, {'status': 'ok', 'database': 'ok'}))

    def test_anonymous_customer_demo_customer_admin_demo_admin_roles(self):
        self.assertEqual(Client().call('GET', '/api/admin/customers')[0], 401)
        for client in (self.customer, self.demo_customer):
            self.assertEqual(client.call('GET', '/api/admin/customers')[0], 403)
        for client in (self.main, self.normal_admin):
            self.assertEqual(client.call('GET', '/api/admin/customers')[0], 200)

    def test_session_role_changes_are_rechecked_by_backend(self):
        run_write("UPDATE users SET role='customer' WHERE id=%s", (self.users[0],))
        try:
            self.assertEqual(self.normal_admin.call('GET', '/api/admin/customers')[0], 403)
        finally:
            run_write("UPDATE users SET role='admin' WHERE id=%s", (self.users[0],))
        self.assertEqual(self.normal_admin.call('GET', '/api/admin/customers')[0], 200)

    def test_runtime_marker_corruption_blocks_real_demo_requests(self):
        run_write("UPDATE demo_environment SET purpose='temporary-phase3-test' WHERE id=1")
        try:
            self.assertEqual(self.main.call('GET', '/api/admin/customers')[0], 503)
            self.assertEqual(Client().call('GET', '/api/health')[0], 503)
        finally:
            run_write("UPDATE demo_environment SET purpose='synthetic-only-v1' WHERE id=1")
        self.assertEqual(self.main.call('GET', '/api/admin/customers')[0], 200)

    def test_non_reserved_import_blocks_requests_without_returning_data(self):
        uid, _ = run_write("INSERT INTO users (name,email,phone,password_hash,role,is_demo) VALUES (%s,%s,%s,%s,'customer',1)",
                           ('TEST Unsafe Domain', uuid.uuid4().hex + '@synthetic.invalid', '9000000000', hash_password('SyntheticOnly123')))
        self.users.append(uid)
        try:
            status, payload = self.main.call('GET', '/api/admin/customers')
            self.assertEqual(status, 503)
            self.assertNotIn('customers', payload)
        finally:
            run_write('DELETE FROM users WHERE id=%s', (uid,))
        self.assertEqual(self.main.call('GET', '/api/admin/customers')[0], 200)

    def test_registration_ignores_role_escalation_fields(self):
        client = Client()
        status, payload = client.call('POST', '/api/auth/register', {
            'name': 'TEST Escalation Customer', 'email': uuid.uuid4().hex + '@test.local', 'phone': '9000000000',
            'password': 'SyntheticOnly123', 'confirm_password': 'SyntheticOnly123', 'role': 'admin', 'is_demo': 0,
        })
        self.assertEqual(status, 201, payload)
        self.users.append(payload['user']['id'])
        self.assertEqual(payload['user']['role'], 'customer')
        self.assertEqual(payload['user']['is_demo'], 1)
        self.assertEqual(client.call('GET', '/api/admin/dashboard')[0], 403)

    def test_profile_update_cannot_change_someone_else_or_own_role(self):
        original = run_query('SELECT name,phone FROM users WHERE id=%s', (self.users[0],), one=True)
        status, payload = self.customer.call('PUT', '/api/profile', {
            'name': 'TEST Updated Customer', 'phone': '9000000099', 'id': self.users[0], 'role': 'admin',
        })
        self.assertEqual(status, 200, payload)
        self.assertEqual(payload['user']['id'], self.users[1])
        self.assertEqual(payload['user']['role'], 'customer')
        self.assertEqual(run_query('SELECT name,phone FROM users WHERE id=%s', (self.users[0],), one=True), original)

    def test_fractional_and_boolean_vehicle_ids_are_400(self):
        for value in (True, False, self.vehicle + 0.9, float(self.vehicle), None, [], {}, '1.1', '1e999', -1, 4294967296):
            with self.subTest(value=value):
                status, data = self.customer.call('POST', '/api/bookings',
                    {'vehicle_id': value, 'pickup_date': date(5), 'return_date': date(6)})
                self.assertEqual(status, 400, data)

    def test_seats_and_prices_reject_malformed_values_without_500(self):
        for field, values in {'seats': [True, 2.5, 5.0, [], {}, 13],
                              'price_per_day': [True, [], {}, 2.5, 2.0, 'nan', 'inf', '1e999', '0.001', '999.99', '1000001'],
                              'category': [[], {}], 'image_url': [[], 123]}.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    status, data = self.main.call('PUT', f'/api/admin/vehicles/{self.vehicle}', {**self.vehicle_payload, field: value})
                    self.assertEqual(status, 400, data)
                    self.assertIn(field, data['fields'])

    def test_filters_reject_nonfinite_negative_and_reversed_prices(self):
        for query in ('min_price=NaN', 'min_price=Infinity', 'max_price=-1', 'min_price=1000001', 'min_price=20&max_price=10'):
            with self.subTest(query=query):
                self.assertEqual(Client().call('GET', '/api/vehicles?' + query)[0], 400)

    def test_whole_rupee_total_and_server_calculation(self):
        self.assertEqual(self.main.call('PUT', f'/api/admin/vehicles/{self.vehicle}',
                         {**self.vehicle_payload, 'price_per_day': '250'})[0], 200)
        bid = self.book(start=10, end=12)
        row = run_query('SELECT total_amount FROM bookings WHERE id=%s', (bid,), one=True)
        self.assertEqual(row['total_amount'], 750)
        self.assertIsInstance(row['total_amount'], int)
        status, data = Client().call('GET', f'/api/vehicles/{self.vehicle}/availability?pickup={date(10)}&return={date(12)}')
        self.assertEqual((status, data['total_amount']), (200, 750))

    def test_rental_date_boundaries_today_60_days_and_one_year(self):
        for start, end, expected in ((0, 0, 200), (0, 59, 200), (0, 60, 400), (365, 365, 200), (366, 366, 400), (-1, 0, 400), (2, 1, 400)):
            with self.subTest(start=start, end=end):
                status, data = Client().call('GET', f'/api/vehicles/{self.vehicle}/availability?pickup={date(start)}&return={date(end)}')
                self.assertEqual(status, expected, data)
        self.book(start=0, end=59)
        self.book(start=365, end=365)

    def test_noncanonical_date_format_is_400(self):
        for pickup in (date(5).replace('-', ''), '2026-W46-2', [], True):
            with self.subTest(pickup=pickup):
                self.assertEqual(self.customer.call('POST', '/api/bookings',
                    {'vehicle_id': self.vehicle, 'pickup_date': pickup, 'return_date': date(6)})[0], 400)

    def test_cancellation_today_and_past_are_409(self):
        today_booking = self.book(start=0, end=0)
        self.assertEqual(self.customer.call('POST', f'/api/bookings/{today_booking}/cancel')[0], 409)
        for days_ago in (1, 2):
            with transaction() as cur:
                cur.execute("INSERT INTO bookings (user_id,vehicle_id,pickup_date,return_date,total_amount,booking_status) VALUES (%s,%s,%s,%s,1,'Confirmed')",
                            (self.users[1], self.vehicle, date(-days_ago), date(-days_ago)))
                bid = cur.lastrowid
            self.assertEqual(self.customer.call('POST', f'/api/bookings/{bid}/cancel')[0], 409)

    def test_confirmed_cancellation_before_pickup_is_allowed(self):
        bid = self.book()
        self.assertEqual(self.main.call('POST', f'/api/admin/bookings/{bid}/approve')[0], 200)
        self.assertEqual(self.customer.call('POST', f'/api/bookings/{bid}/cancel')[0], 200)

    def test_pending_and_cancelled_payment_transitions_are_blocked(self):
        bid = self.book()
        self.assertEqual(self.main.call('PUT', f'/api/admin/bookings/{bid}/payment', {'payment_status': 'Paid'})[0], 409)
        self.customer.call('POST', f'/api/bookings/{bid}/cancel')
        self.assertEqual(self.main.call('PUT', f'/api/admin/bookings/{bid}/payment', {'payment_status': 'Paid'})[0], 409)
        self.assertEqual(self.main.call('PUT', f'/api/admin/bookings/{bid}/payment', {'payment_status': 'Refunded'})[0], 400)

    def test_approval_rechecks_inactive_vehicle_and_past_pickup(self):
        bid = self.book()
        self.main.call('PUT', f'/api/admin/vehicles/{self.vehicle}', {**self.vehicle_payload, 'status': 'Inactive'})
        self.assertEqual(self.main.call('POST', f'/api/admin/bookings/{bid}/approve')[0], 409)
        self.main.call('PUT', f'/api/admin/vehicles/{self.vehicle}', self.vehicle_payload)
        run_write('UPDATE bookings SET pickup_date=%s, return_date=%s WHERE id=%s', (date(-2), date(-1), bid))
        self.assertEqual(self.main.call('POST', f'/api/admin/bookings/{bid}/approve')[0], 409)

    def test_public_registrations_masked_but_booking_admin_data_intact(self):
        status, data = Client().call('GET', f'/api/vehicles/{self.vehicle}')
        self.assertEqual((status, data['vehicle']['registration_number']), (200, 'Hidden for privacy'))
        _, catalog = Client().call('GET', '/api/vehicles')
        self.assertTrue(all(v['registration_number'] == 'Hidden for privacy' for v in catalog['vehicles']))
        bid = self.book()
        _, history = self.customer.call('GET', '/api/bookings/mine')
        self.assertEqual(next(b for b in history['bookings'] if b['id'] == bid)['registration_number'], self.vehicle_payload['registration_number'])
        _, data = self.main.call('GET', f'/api/admin/vehicles/{self.vehicle}')
        self.assertEqual(data['vehicle']['registration_number'], self.vehicle_payload['registration_number'])

    def test_injection_strings_remain_literal_data(self):
        self.assertEqual(Client().call('GET', '/api/vehicles?q=%27%20OR%201%3D1%20--')[1]['vehicles'], [])
        self.assertEqual(self.main.call('GET', '/api/admin/bookings?status=Pending%27%20OR%201%3D1')[0], 400)
        self.assertEqual(self.customer.call('POST', '/api/bookings', {'vehicle_id': '1 OR 1=1', 'pickup_date': date(5), 'return_date': date(6)})[0], 400)

    def test_concurrent_approval_archive_and_create_preserve_invariants(self):
        # Creating a pending booking and archiving serialize on the same vehicle.
        barrier = threading.Barrier(2)
        def archive():
            barrier.wait()
            return self.main.call('POST', f'/api/admin/vehicles/{self.vehicle}/archive')[0]
        def book():
            barrier.wait()
            return self.customer.call('POST', '/api/bookings', {'vehicle_id': self.vehicle, 'pickup_date': date(40), 'return_date': date(41)})[0]
        with ThreadPoolExecutor(max_workers=2) as pool:
            a, b = pool.submit(archive), pool.submit(book)
            outcomes = a.result(), b.result()
        self.assertIn(outcomes, ((200, 404), (409, 201)))
        row = run_query("SELECT v.is_archived, COUNT(b.id) AS open_bookings FROM vehicles v LEFT JOIN bookings b ON b.vehicle_id=v.id AND b.booking_status IN ('Pending','Confirmed') WHERE v.id=%s GROUP BY v.id", (self.vehicle,), one=True)
        self.assertFalse(row['is_archived'] and row['open_bookings'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
