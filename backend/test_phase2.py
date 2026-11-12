"""Phase 2 tests: demo accounts, Main Admin full control and authentication.

Start the isolated backend first (python demo.py serve), then run:
    python demo.py test

The test logs in as the public Demo Customer and the full-control Main Admin.
It creates temporary customers/vehicles/bookings for the admin-operation checks
and removes everything it created with an exit handler. It never changes the
owner admin account or the documented demo credentials.
"""
import atexit
import datetime
import json
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from unittest.mock import patch

import auth
import create_admin
from config import API_HOST, API_PORT, DB_CONFIG, DEMO_MODE, SESSION_SECONDS
from database import get_connection, run_query, run_write
from demo_accounts import DEMO_ACCOUNTS, MAIN_ADMIN_EMAIL

BASE = f"http://{API_HOST}:{API_PORT}"
RUN = str(int(time.time()))
CUSTOMER = next(a for a in DEMO_ACCOUNTS if a["role"] == "customer")
ADMIN = next(a for a in DEMO_ACCOUNTS if a["role"] == "admin")
results = []
created_users, created_vehicles = [], []


def cleanup():
    # Registered before any mutation, including exceptions halfway through a run.
    with get_connection() as conn:
        with conn.cursor() as cur:
            if created_users:
                fmt = ','.join(['%s'] * len(created_users))
                cur.execute(f"DELETE FROM bookings WHERE user_id IN ({fmt})", created_users)
            if created_vehicles:
                fmt = ','.join(['%s'] * len(created_vehicles))
                cur.execute(f"DELETE FROM bookings WHERE vehicle_id IN ({fmt})", created_vehicles)
                cur.execute(f"DELETE FROM vehicles WHERE id IN ({fmt})", created_vehicles)
            if created_users:
                cur.execute(f"DELETE FROM users WHERE id IN ({','.join(['%s'] * len(created_users))})", created_users)
            conn.commit()


if not DEMO_MODE or DB_CONFIG['database'] != 'zelvora_demo_db':
    raise SystemExit('Run python demo.py test; tests must not touch the private database.')
atexit.register(cleanup)


class Client:
    def __init__(self):
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method, path, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        h = {"Content-Type": "application/json", "X-Requested-With": "ZELVORA"}
        h.update(headers or {})
        req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
        try:
            with self.opener.open(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def cookies(self):
        return list(self.jar)


def check(name, condition, detail=""):
    results.append((name, bool(condition)))
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"   -> {detail}"))


def d(offset):
    return (datetime.date.today() + datetime.timedelta(days=offset)).isoformat()


def login(client, account, password=None):
    return client.call("POST", "/api/auth/login",
                       {"email": account["email"], "password": password or account["password"]})


def vehicle_payload(**kw):
    payload = {
        "name": "TEST Phase2 Car", "brand": "Testco", "model": "P2", "category": "Car",
        "registration_number": f"TST P2 {RUN}", "fuel_type": "Petrol", "transmission": "Manual",
        "seats": 5, "price_per_day": 1500, "image_url": "",
        "description": "Temporary vehicle created by the Phase 2 Main Admin test.", "status": "Active",
    }
    payload.update(kw)
    return payload


print("\n== Account seed and password storage ==")
for account in DEMO_ACCOUNTS:
    row = run_query("SELECT id, role, is_demo, password_hash FROM users WHERE email = %s",
                    (account["email"],), one=True)
    check(f"{account['role']} demo account exists", row is not None, account["email"])
    if row:
        check(f"{account['role']} demo account has the expected role", row["role"] == account["role"], row)
        check(f"{account['role']} demo account is flagged is_demo", row["is_demo"] == 1, row)
        check(f"{account['role']} password verifies against the scrypt hash",
              auth.verify_password(account["password"], row["password_hash"]))
        check(f"{account['role']} password is not stored in plain text",
              row["password_hash"].startswith("scrypt$") and account["password"] not in row["password_hash"])
        check(f"{account['role']} password rejects a wrong value",
              not auth.verify_password(account["password"] + "x", row["password_hash"]))

main_row = run_query("SELECT id, name, role, is_demo FROM users WHERE email = %s", (MAIN_ADMIN_EMAIL,), one=True)
check("Main Admin has the admin role", main_row is not None and main_row["role"] == "admin", main_row)
check("Main Admin display name is not the old read-only label",
      main_row is not None and "Main Admin" in main_row["name"], main_row)
check("No private user emails were copied into the demo database",
      all(u['email'].endswith(('.example', '.local', '.test')) for u in run_query('SELECT email FROM users')))
anon = Client()
s, r = anon.call('GET', '/api/demo/credentials')
check('Demo panel advertises both working demo credentials', s == 200 and r['enabled'] and len(r['accounts']) == 2, r)
s, r = anon.call('POST', '/api/auth/register', {'name': 'Fictitious Customer', 'email': 'person@gmail.com',
    'phone': '9000000000', 'password': 'Secret123', 'confirm_password': 'Secret123'})
check('Demo registration refuses non-synthetic email domains', s == 400 and 'email' in r['fields'], r)

print("\n== Demo customer ==")
cust = Client()
s, r = login(cust, CUSTOMER, "DefinitelyWrong9")
check("Demo customer rejects a wrong password", s == 401, r)
s, r = login(cust, CUSTOMER)
check("Demo customer logs in", s == 200 and r["user"]["role"] == "customer", r)
check("Customer login response exposes the is_demo flag", r["user"].get("is_demo") == 1, r)
check("Customer login response never contains a password hash", "password_hash" not in json.dumps(r))
customer_id = r["user"]["id"]
s, r = cust.call("GET", "/api/auth/me")
check("Demo customer session persists across requests", r["user"] and r["user"]["id"] == customer_id, r)
s, r = cust.call("GET", "/api/bookings/mine")
check("Demo customer can load own bookings", s == 200 and all(b["user_id"] == customer_id for b in r["bookings"]), r)
s, r = cust.call("GET", "/api/admin/dashboard")
check("Demo customer blocked from the admin API (403)", s == 403, r)
s, r = cust.call("GET", "/api/admin/customers")
check("Demo customer cannot read the customer list (403)", s == 403, r)
cookie = next((c for c in cust.cookies() if c.name == "zelvora_session"), None)
check("Session cookie is HttpOnly", cookie is not None and cookie.has_nonstandard_attr("HttpOnly"), cookie)
check("Session cookie uses SameSite=Lax",
      cookie is not None and (cookie._rest.get("SameSite") or "").lower() == "lax", cookie)
s, r = cust.call("POST", "/api/auth/logout")
check("Demo customer logout succeeds", s == 200, r)
s, r = cust.call("GET", "/api/auth/me")
check("Demo customer logout ends the session", r["user"] is None, r)

print("\n== Main Admin authentication ==")
admin = Client()
s, r = login(admin, ADMIN, "DefinitelyWrong9")
check("Main Admin rejects a wrong password", s == 401, r)
s, r = login(admin, ADMIN)
check("Main Admin logs in", s == 200 and r["user"]["role"] == "admin", r)
check("Main Admin login response never contains a password hash", "password_hash" not in json.dumps(r))
admin_id = r["user"]["id"]
s, r = admin.call("GET", "/api/auth/me")
check("Main Admin session persists across requests", r["user"] and r["user"]["id"] == admin_id and r["user"]["role"] == "admin", r)
check('Main Admin session survives a fresh client using the saved cookie',
      json.loads(urllib.request.build_opener(urllib.request.HTTPCookieProcessor(admin.jar)).open(BASE + '/api/auth/me').read())['user']['id'] == admin_id)

print("\n== Main Admin dashboard, customers and vehicles ==")
s, r = admin.call("GET", "/api/admin/dashboard")
check("Main Admin loads the dashboard", s == 200 and "summary" in r and "recent_bookings" in r, r)
dashboard_before = r["summary"]
s, r = admin.call("GET", "/api/admin/customers")
check("Main Admin can read customer records", s == 200 and isinstance(r.get("customers"), list), r)
check("Customer list contains no password hashes", "password_hash" not in json.dumps(r))
check("Customer list contains the demo customer", any(c["email"] == CUSTOMER["email"] for c in r["customers"]), r)
s, r = admin.call("GET", "/api/admin/vehicles")
check("Main Admin can list active vehicles", s == 200 and isinstance(r.get("vehicles"), list), r)

s, r = admin.call("POST", "/api/admin/vehicles", vehicle_payload())
check("Main Admin can add a vehicle", s == 201 and r["vehicle"]["name"] == "TEST Phase2 Car", r)
vehicle_id = r["vehicle"]["id"]
created_vehicles.append(vehicle_id)
check("Added vehicle is saved in MySQL",
      run_query("SELECT name FROM vehicles WHERE id = %s", (vehicle_id,), one=True)["name"] == "TEST Phase2 Car")
s, r = admin.call("GET", f"/api/admin/vehicles/{vehicle_id}")
check("Main Admin can load one vehicle for editing", s == 200 and r["vehicle"]["id"] == vehicle_id, r)
s, r = admin.call("PUT", f"/api/admin/vehicles/{vehicle_id}", vehicle_payload(name="TEST Phase2 Car Edited", price_per_day=1800))
check("Main Admin can edit a vehicle", s == 200 and r["vehicle"]["name"] == "TEST Phase2 Car Edited", r)
check("Vehicle edit is saved in MySQL",
      run_query("SELECT price_per_day FROM vehicles WHERE id = %s", (vehicle_id,), one=True)["price_per_day"] == 1800)
s, r = admin.call("PUT", f"/api/admin/vehicles/{vehicle_id}", vehicle_payload(name="TEST Phase2 Car Edited", price_per_day=1800, status="Maintenance"))
check("Main Admin can change vehicle status", s == 200 and r["vehicle"]["status"] == "Maintenance", r)
s, r = admin.call("PUT", f"/api/admin/vehicles/{vehicle_id}", vehicle_payload(name="TEST Phase2 Car Edited", price_per_day=1800, status="Active"))
check("Main Admin can return a vehicle to Active", s == 200 and r["vehicle"]["status"] == "Active", r)
s, r = admin.call("POST", "/api/admin/vehicles", vehicle_payload())
check("Duplicate registration is rejected", s == 409, r)
s, r = admin.call("POST", "/api/admin/vehicles", vehicle_payload(registration_number=f"TST P2 BAD {RUN}", category="Truck", seats=0, price_per_day=-1))
check("Invalid vehicle data is rejected", s == 400 and {"category", "seats", "price_per_day"} <= set(r["fields"]), r)

login(cust, CUSTOMER)
s, r = cust.call('POST', '/api/bookings', {'vehicle_id': vehicle_id, 'pickup_date': d(5), 'return_date': d(6)})
check('Seeded Demo Customer can create a real booking request', s == 201, r)
demo_booking = r['booking']['id']
s, r = cust.call('GET', '/api/bookings/mine')
check('Seeded Demo Customer sees its new booking', s == 200 and any(b['id'] == demo_booking for b in r['bookings']), r)
s, r = cust.call('POST', f'/api/bookings/{demo_booking}/cancel')
check('Seeded Demo Customer can cancel its booking', s == 200, r)

print("\n== Main Admin booking management ==")
temp_email = f"phase2.admin.check.{RUN}@zelvora.example"
temp = Client()
s, r = temp.call("POST", "/api/auth/register", {
    "name": "TEST Phase2 Customer", "email": temp_email, "phone": "9876500000",
    "password": "TempPass123", "confirm_password": "TempPass123",
})
check("Temporary customer registers", s == 201 and r["user"]["role"] == "customer", r)
temp_customer_id = r["user"]["id"]
created_users.append(temp_customer_id)

s, r = temp.call("POST", "/api/bookings", {"vehicle_id": vehicle_id, "pickup_date": d(20), "return_date": d(21)})
check("Temporary customer can request a booking", s == 201 and r["booking"]["booking_status"] == "Pending", r)
booking_complete = r["booking"]["id"]
booking_total = r["booking"]["total_amount"]

s, r = temp.call("POST", "/api/bookings", {"vehicle_id": vehicle_id, "pickup_date": d(30), "return_date": d(31)})
check("Temporary customer can request a second booking", s == 201, r)
booking_reject = r["booking"]["id"]

s, r = admin.call("GET", "/api/admin/bookings")
check("Main Admin can list all bookings", s == 200 and isinstance(r.get("bookings"), list), r)
row = next((b for b in r["bookings"] if b["id"] == booking_complete), None)
check("Main Admin can see customer name, email and phone",
      row is not None and row["customer_email"] == temp_email and row["customer_name"] == "TEST Phase2 Customer" and bool(row["customer_phone"]), row)
s, r = admin.call("GET", "/api/admin/bookings?status=Pending")
check("Main Admin can filter bookings by status", s == 200 and all(b["booking_status"] == "Pending" for b in r["bookings"]), r)

s, r = admin.call("POST", f"/api/admin/bookings/{booking_complete}/approve")
check("Main Admin can approve a pending booking", s == 200, r)
check("Approval is saved as Confirmed in MySQL",
      run_query("SELECT booking_status FROM bookings WHERE id = %s", (booking_complete,), one=True)["booking_status"] == "Confirmed")
s, r = admin.call("PUT", f"/api/admin/bookings/{booking_complete}/payment", {"payment_status": "Paid"})
check("Main Admin can record a payment", s == 200, r)
check("Payment is saved as Paid in MySQL",
      run_query("SELECT payment_status FROM bookings WHERE id = %s", (booking_complete,), one=True)["payment_status"] == "Paid")
s, r = admin.call("POST", f"/api/admin/bookings/{booking_complete}/complete")
check("Main Admin can complete a booking", s == 200, r)
s, r = admin.call('PUT', f'/api/admin/bookings/{booking_complete}/payment', {'payment_status': 'Unpaid'})
check('Main Admin can correct payment on a completed booking', s == 200, r)
check("Completion is saved as Completed in MySQL",
      run_query("SELECT booking_status FROM bookings WHERE id = %s", (booking_complete,), one=True)["booking_status"] == "Completed")
s, r = admin.call("POST", f"/api/admin/bookings/{booking_complete}/complete")
check("A completed booking cannot be completed twice (409)", s == 409, r)

s, r = admin.call("POST", f"/api/admin/bookings/{booking_reject}/reject")
check("Main Admin can reject a pending booking", s == 200, r)
check("Rejection is saved as Rejected in MySQL",
      run_query("SELECT booking_status FROM bookings WHERE id = %s", (booking_reject,), one=True)["booking_status"] == "Rejected")
s, r = admin.call("POST", f"/api/admin/bookings/{booking_reject}/approve")
check("A rejected booking cannot be approved (409)", s == 409, r)

print("\n== Main Admin revenue and archive ==")
s, r = admin.call("GET", "/api/admin/dashboard")
after = r["summary"]
check("Dashboard completed count increased", after["completed_bookings"] == dashboard_before["completed_bookings"] + 1, (dashboard_before, after))
check("Dashboard revenue increased by the completed booking total",
      after["completed_revenue"] == dashboard_before["completed_revenue"] + booking_total,
      (dashboard_before, after, booking_total))
db = run_query("SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS rev FROM bookings WHERE booking_status='Completed'", one=True)
check("Dashboard totals match direct SQL", after["completed_bookings"] == db["n"] and after["completed_revenue"] == float(db["rev"]), (after, db))

s, r = temp.call("POST", "/api/bookings", {"vehicle_id": vehicle_id, "pickup_date": d(40), "return_date": d(41)})
check("Third booking created for archive protection test", s == 201, r)
booking_open = r["booking"]["id"]
s, r = admin.call("POST", f"/api/admin/vehicles/{vehicle_id}/archive")
check("Archive is blocked while a booking is open (409)", s == 409, r)
s, r = admin.call("POST", f"/api/admin/bookings/{booking_open}/reject")
check("Third booking rejected", s == 200, r)
s, r = admin.call("POST", f"/api/admin/vehicles/{vehicle_id}/archive")
check("Main Admin can archive a vehicle", s == 200, r)
check("Archive is a soft delete in MySQL",
      run_query("SELECT is_archived FROM vehicles WHERE id = %s", (vehicle_id,), one=True)["is_archived"] == 1)
s, r = admin.call("GET", "/api/admin/vehicles?archived=1")
check("Main Admin can see archived vehicles", s == 200 and vehicle_id in [v["id"] for v in r["vehicles"]], r)
s, r = temp.call("GET", f"/api/vehicles/{vehicle_id}")
check("Archived vehicle is hidden from customers (404)", s == 404, r)
s, r = admin.call("POST", f"/api/admin/vehicles/{vehicle_id}/restore")
check("Main Admin can restore an archived vehicle", s == 200, r)
check("Restore is saved in MySQL",
      run_query("SELECT is_archived FROM vehicles WHERE id = %s", (vehicle_id,), one=True)["is_archived"] == 0)

print("\n== Role boundaries and logout ==")
routes = [('GET', '/api/admin/dashboard'), ('GET', '/api/admin/customers'),
          ('GET', '/api/admin/vehicles'), ('GET', f'/api/admin/vehicles/{vehicle_id}'),
          ('POST', '/api/admin/vehicles'), ('PUT', f'/api/admin/vehicles/{vehicle_id}'),
          ('POST', f'/api/admin/vehicles/{vehicle_id}/archive'),
          ('POST', f'/api/admin/vehicles/{vehicle_id}/restore'), ('GET', '/api/admin/bookings'),
          *[('POST', f'/api/admin/bookings/{booking_open}/{action}') for action in ('approve', 'reject', 'complete')],
          ('PUT', f'/api/admin/bookings/{booking_open}/payment')]
for method, path in routes:
    check(f'Customer denied {method} {path}', temp.call(method, path, {} if method != 'GET' else None)[0] == 403)
    check(f'Anonymous denied {method} {path}', Client().call(method, path, {} if method != 'GET' else None)[0] == 401)
s, r = temp.call("GET", "/api/admin/dashboard")
check("Customer is blocked from admin dashboard (403)", s == 403, r)
s, r = temp.call("POST", f"/api/admin/bookings/{booking_open}/approve")
check("Customer is blocked from admin booking actions (403)", s == 403, r)
s, r = Client().call("GET", "/api/admin/dashboard")
check("Anonymous request is blocked from admin dashboard (401)", s == 401, r)
s, r = admin.call("POST", "/api/auth/logout")
check("Main Admin logout succeeds", s == 200, r)
s, r = admin.call("GET", "/api/auth/me")
check("Main Admin logout ends the session", r["user"] is None, r)
s, r = admin.call("GET", "/api/admin/dashboard")
check("Logged-out Main Admin is anonymous (401)", s == 401, r)

print("\n== Session expiry ==")
check("Session lifetime is configured to 8 hours", SESSION_SECONDS == 8 * 60 * 60, SESSION_SECONDS)
token = auth.create_session(admin_id)
key = auth._key(token)
with auth._lock:
    auth._sessions[key]["expires"] = time.time() - 1
check("Expired session token is rejected", auth.get_user_for_token(token) is None)
with auth._lock:
    auth._sessions.pop(key, None)

print("\n== Login rate limit ==")
rate_client = Client()
rate_email = f"phase2.rate.{RUN}@zelvora.example"
statuses = [rate_client.call("POST", "/api/auth/login",
                             {"email": rate_email, "password": "WrongPass9"})[0] for _ in range(5)]
check("Five failed logins return 401", statuses == [401] * 5, statuses)
s, r = rate_client.call("POST", "/api/auth/login", {"email": rate_email, "password": "WrongPass9"})
check("Sixth failed login is rate limited (429)", s == 429, (s, r))

print("\n== Secure Main Admin password reset mechanism ==")
reset_email = f"phase2.reset.{RUN}@test.local"
reset_id, _ = run_write(
    "INSERT INTO users (name, email, phone, password_hash, role, is_demo) VALUES (%s, %s, %s, %s, 'admin', 0)",
    ("TEST Reset Admin", reset_email, "9000000000", auth.hash_password("OldPass123")),
)
created_users.append(reset_id)
old_hash = run_query("SELECT password_hash FROM users WHERE id = %s", (reset_id,), one=True)["password_hash"]
check("Reset helper target starts with a valid scrypt hash", auth.verify_password("OldPass123", old_hash))
reset_token = auth.create_session(reset_id)
create_admin._apply_password(reset_id, "NewPass456")
new_hash = run_query("SELECT password_hash FROM users WHERE id = %s", (reset_id,), one=True)["password_hash"]
check("Reset helper accepts the new password", auth.verify_password("NewPass456", new_hash))
check("Reset helper rejects the old password", not auth.verify_password("OldPass123", new_hash))
check("Reset helper stores only a scrypt hash", new_hash.startswith("scrypt$") and "NewPass456" not in new_hash)
check('Password reset immediately invalidates previous sessions', auth.get_user_for_token(reset_token) is None)

with patch('create_admin.getpass.getpass', side_effect=['Mismatch123', 'Different123']):
    try:
        create_admin._prompt_password()
        refused = False
    except SystemExit:
        refused = True
check('Password mismatch aborts without writing', refused and run_query('SELECT password_hash FROM users WHERE id=%s', (reset_id,), one=True)['password_hash'] == new_hash)
with patch('create_admin.getpass.getpass', return_value=ADMIN['password']):
    try:
        create_admin._prompt_password()
        refused = False
    except SystemExit:
        refused = True
check('Private admin setup refuses the public demo password', refused)

# Exercise the full reset-main command against a TEMPORARY demo admin only.
run_write('UPDATE users SET is_demo=1 WHERE id=%s', (reset_id,))
with patch('create_admin.MAIN_ADMIN_EMAIL', reset_email), patch('create_admin.getpass.getpass', side_effect=['ResetMain789', 'ResetMain789']):
    create_admin.reset_main_admin()
check('Interactive Main Admin reset updates the intended account',
      auth.verify_password('ResetMain789', run_query('SELECT password_hash FROM users WHERE id=%s', (reset_id,), one=True)['password_hash']))
with patch('create_admin.input', return_value=ADMIN['email']):
    try:
        create_admin.reset_admin()
        refused = False
    except SystemExit:
        refused = True
check('Owner reset command refuses to change the public Main Admin', refused)

cleanup()
atexit.unregister(cleanup)

passed = sum(1 for _, ok in results if ok)
print(f"\n{passed}/{len(results)} checks passed")
raise SystemExit(0 if passed == len(results) else 1)
