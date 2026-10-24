"""End-to-end API tests. Start server.py first, then run:  python test_api.py

Creates temporary test users and vehicles (names start with "TEST") and removes
everything it created when it finishes.
"""
import datetime
import json
import threading
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

from auth import hash_password
from database import get_connection, run_query, run_write

BASE = "http://127.0.0.1:8000"
RUN = str(int(time.time()))
results = []


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

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


def check(name, condition, detail=""):
    results.append((name, bool(condition)))
    print(("PASS  " if condition else "FAIL  ") + name + ("" if condition else f"   -> {detail}"))


def d(offset):
    return (datetime.date.today() + datetime.timedelta(days=offset)).isoformat()


def vehicle_payload(**kw):
    p = {"name": "TEST Car", "brand": "Testco", "model": "T1", "category": "Car", "registration_number": f"TST {RUN} C",
         "fuel_type": "Petrol", "transmission": "Manual", "seats": 5, "price_per_day": 1000, "image_url": "",
         "description": "A test vehicle used by the automated tests.", "status": "Active"}
    p.update(kw)
    return p


created_users, created_vehicles = [], []
try:
    # --- set up an admin directly in the database (hashed password) ---
    admin_email = f"admin{RUN}@test.local"
    uid, _ = run_write("INSERT INTO users (name,email,phone,password_hash,role) VALUES (%s,%s,%s,%s,'admin')",
                       ("TEST Admin", admin_email, "9000000000", hash_password("AdminPass1")))
    created_users.append(uid)
    admin, cust, cust2, anon = Client(), Client(), Client(), Client()

    print("\n== Authentication ==")
    reg = {"name": "TEST Customer", "email": f"cust{RUN}@test.local", "phone": "9876543210",
           "password": "Secret123", "confirm_password": "Secret123"}
    s, r = cust.call("POST", "/api/auth/register", reg)
    check("Register new customer", s == 201 and r["user"]["role"] == "customer", r)
    created_users.append(r["user"]["id"])
    check("Response never contains password hash", "password_hash" not in json.dumps(r))
    s, r = anon.call("POST", "/api/auth/register", reg)
    check("Reject duplicate email", s == 409, r)
    s, r = anon.call("POST", "/api/auth/register", {**reg, "email": "bad", "confirm_password": "x", "phone": "12"})
    check("Reject invalid registration fields", s == 400 and {"email", "phone", "confirm_password"} <= set(r["fields"]), r)
    s, r = anon.call("POST", "/api/auth/register", {**reg, "email": f"w{RUN}@test.local", "password": "short1", "confirm_password": "short1"})
    check("Reject weak password", s == 400 and "password" in r["fields"], r)
    row = run_query("SELECT password_hash FROM users WHERE email=%s", (reg["email"],), one=True)
    check("Password stored as scrypt hash, not plain text", row["password_hash"].startswith("scrypt$") and "Secret123" not in row["password_hash"])
    s, r = cust2.call("POST", "/api/auth/register", {**reg, "name": "TEST Customer Two", "email": f"cust2{RUN}@test.local"})
    created_users.append(r["user"]["id"])
    s, r = anon.call("POST", "/api/auth/login", {"email": reg["email"], "password": "WrongPass9"})
    check("Reject incorrect password", s == 401 and "Incorrect" in r["error"], r)
    s, r = anon.call("POST", "/api/auth/login", {"email": reg["email"], "password": "Secret123"})
    check("Login with correct credentials", s == 200, r)
    s, r = anon.call("GET", "/api/auth/me")
    check("Session keeps user logged in", r["user"] and r["user"]["email"] == reg["email"], r)
    s, r = anon.call("POST", "/api/auth/logout")
    s, r = anon.call("GET", "/api/auth/me")
    check("Logout invalidates session", r["user"] is None, r)
    s, r = admin.call("POST", "/api/auth/login", {"email": admin_email, "password": "AdminPass1"})
    check("Admin login", s == 200 and r["user"]["role"] == "admin", r)
    s, r = Client().call("GET", "/api/admin/dashboard")
    check("Anonymous blocked from admin API (401)", s == 401, r)
    s, r = cust.call("GET", "/api/admin/dashboard")
    check("Customer blocked from admin API (403)", s == 403, r)
    s, r = cust.call("POST", "/api/admin/vehicles", vehicle_payload())
    check("Customer cannot add vehicle (403)", s == 403, r)
    s, r = cust.call("POST", "/api/admin/bookings/1/approve", headers={})
    check("Customer cannot approve bookings (403)", s == 403, r)
    s, r = cust.call("POST", "/api/auth/logout", headers={"X-Requested-With": ""})
    check("State-changing request without security header is refused", s == 403, r)

    print("\n== Vehicles ==")
    ids = {}
    for key, cat, fuel, trans, seats, price in (("car", "Car", "Petrol", "Manual", 5, 1000), ("bike", "Bike", "Petrol", "Manual", 2, 400), ("scooter", "Scooter", "Electric", "Automatic", 2, 300)):
        s, r = admin.call("POST", "/api/admin/vehicles", vehicle_payload(name=f"TEST {cat}", category=cat, fuel_type=fuel, transmission=trans,
                                                                           seats=seats, price_per_day=price, registration_number=f"TST {RUN} {key}"))
        check(f"Add {cat.lower()}", s == 201 and r["vehicle"]["category"] == cat, r)
        ids[key] = r["vehicle"]["id"]
        created_vehicles.append(ids[key])
    check("Default image assigned when no image given", r["vehicle"]["image_url"].startswith("/images/"))
    s, r = admin.call("POST", "/api/admin/vehicles", vehicle_payload(registration_number=f"tst {RUN} car"))
    check("Reject duplicate registration number", s == 409, r)
    s, r = admin.call("POST", "/api/admin/vehicles", vehicle_payload(category="Truck", price_per_day=-5, seats=0, image_url="javascript:alert(1)", registration_number=f"TST {RUN} X"))
    check("Reject invalid vehicle data", s == 400 and {"category", "price_per_day", "seats", "image_url"} <= set(r["fields"]), r)
    s, r = admin.call("PUT", f"/api/admin/vehicles/{ids['car']}", vehicle_payload(name="TEST Car Edited", price_per_day=1200, registration_number=f"TST {RUN} car"))
    check("Edit vehicle", s == 200 and r["vehicle"]["name"] == "TEST Car Edited", r)
    check("Edit saved in MySQL", run_query("SELECT price_per_day FROM vehicles WHERE id=%s", (ids["car"],), one=True)["price_per_day"] == 1200)
    s, r = anon.call("GET", "/api/vehicles?q=Edited")
    check("Search by name", [v["id"] for v in r["vehicles"]] == [ids["car"]], r)
    s, r = anon.call("GET", "/api/vehicles?q=Testco&category=Scooter")
    check("Search by brand + filter category", [v["id"] for v in r["vehicles"]] == [ids["scooter"]], r)
    s, r = anon.call("GET", "/api/vehicles?q=Testco&min_price=350&max_price=500")
    check("Filter by price", [v["id"] for v in r["vehicles"]] == [ids["bike"]], r)
    s, r = anon.call("GET", "/api/vehicles?category=Truck")
    check("Unknown category rejected", s == 400)
    s, r = admin.call("PUT", f"/api/admin/vehicles/{ids['scooter']}", vehicle_payload(name="TEST Scooter", category="Scooter", transmission="Automatic", seats=2, price_per_day=300, status="Maintenance", registration_number=f"TST {RUN} scooter"))
    s, r = anon.call("GET", "/api/vehicles?q=Testco")
    check("Maintenance vehicle hidden from customer list", ids["scooter"] not in [v["id"] for v in r["vehicles"]])
    s, r = cust.call("POST", "/api/bookings", {"vehicle_id": ids["scooter"], "pickup_date": d(3), "return_date": d(4)})
    check("Only active vehicles can be booked", s == 409, r)
    admin.call("PUT", f"/api/admin/vehicles/{ids['scooter']}", vehicle_payload(name="TEST Scooter", category="Scooter", transmission="Automatic", seats=2, price_per_day=300, status="Active", registration_number=f"TST {RUN} scooter"))

    print("\n== Bookings ==")
    car = ids["car"]
    s, r = cust.call("GET", f"/api/vehicles/{car}/availability?pickup={d(10)}&return={d(12)}")
    check("Availability + price calc (3 inclusive days x 1200 = 3600)", s == 200 and r["available"] and r["rental_days"] == 3 and r["total_amount"] == 3600, r)
    s, r = cust.call("GET", f"/api/vehicles/{car}/availability?pickup={d(10)}&return={d(10)}")
    check("Same-day rental counts as 1 day", r["rental_days"] == 1 and r["total_amount"] == 1200, r)
    for label, a, b in (("past pickup", -1, 2), ("return before pickup", 5, 4)):
        s, r = cust.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(a), "return_date": d(b)})
        check(f"Reject invalid dates ({label})", s == 400, r)
    s, r = cust.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": "nonsense", "return_date": d(2)})
    check("Reject malformed date", s == 400)
    s, r = anon.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(10), "return_date": d(12)})
    check("Booking requires login", s == 401)
    s, r = admin.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(10), "return_date": d(12)})
    check("Admin account cannot place rentals", s == 403)
    s, r = cust.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(10), "return_date": d(12), "total_amount": 1})
    check("Create booking (server computes total, status Pending)", s == 201 and r["booking"]["total_amount"] == 3600 and r["booking"]["booking_status"] == "Pending", r)
    b1 = r["booking"]["id"]
    s, r = cust.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(11), "return_date": d(13)})
    check("Customer cannot double-book overlapping own dates", s == 409, r)
    s, r = cust2.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(11), "return_date": d(13)})
    check("Pending bookings may overlap (second request created)", s == 201, r)
    b2 = r["booking"]["id"]
    s, r = cust.call("GET", "/api/bookings/mine")
    check("My Bookings lists only own bookings", [b["id"] for b in r["bookings"]] == [b1] and r["bookings"][0]["can_cancel"], r)
    check("Booking status in DB is Pending", run_query("SELECT booking_status FROM bookings WHERE id=%s", (b1,), one=True)["booking_status"] == "Pending")
    s, r = admin.call("GET", "/api/admin/bookings?status=Pending")
    check("Admin sees customer + vehicle details", any(b["id"] == b1 and b["customer_email"] == reg["email"] and b["vehicle_name"] for b in r["bookings"]), r)

    s, r = admin.call("POST", f"/api/admin/bookings/{b1}/approve")
    check("Approve pending booking", s == 200, r)
    s, r = admin.call("POST", f"/api/admin/bookings/{b2}/approve")
    check("Reject approval that conflicts with confirmed booking", s == 409 and "Another confirmed" in r["error"], r)
    s, r = cust2.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(12), "return_date": d(14)})
    check("Reject new booking overlapping confirmed one", s == 409 and "already booked" in r["error"], r)
    s, r = cust.call("POST", "/api/bookings", {"vehicle_id": car, "pickup_date": d(13), "return_date": d(14)})
    check("Day after confirmed return is free", s == 201, r)
    b3 = r["booking"]["id"]
    s, r = anon.call("GET", f"/api/vehicles/{car}")
    check("Vehicle detail exposes booked ranges (no customer data)", s == 200 and len(r["vehicle"]["booked_ranges"]) == 1 and "user_id" not in json.dumps(r))
    s, r = anon.call("GET", f"/api/vehicles?q=Edited&available=1&pickup={d(11)}&return={d(11)}")
    check("'Available only' filter hides booked vehicle for those dates", r["vehicles"] == [], r)
    s, r = anon.call("GET", f"/api/vehicles?q=Edited&available=1&pickup={d(20)}&return={d(21)}")
    check("'Available only' filter shows vehicle for free dates", len(r["vehicles"]) == 1, r)

    s, r = admin.call("POST", f"/api/admin/bookings/{b2}/reject")
    check("Reject pending booking", s == 200, r)
    check("Rejected booking history kept in DB", run_query("SELECT booking_status FROM bookings WHERE id=%s", (b2,), one=True)["booking_status"] == "Rejected")
    s, r = admin.call("POST", f"/api/admin/bookings/{b2}/approve")
    check("Rejected booking cannot be approved", s == 409)
    s, r = cust2.call("POST", f"/api/bookings/{b2}/cancel")
    check("Rejected booking cannot be cancelled", s == 409, r)
    s, r = cust2.call("POST", f"/api/bookings/{b3}/cancel")
    check("Customer cannot cancel someone else's booking (404)", s == 404, r)
    s, r = cust.call("POST", f"/api/bookings/{b3}/cancel")
    check("Cancel eligible pending booking", s == 200, r)
    check("Cancelled status saved", run_query("SELECT booking_status FROM bookings WHERE id=%s", (b3,), one=True)["booking_status"] == "Cancelled")

    # payment + completion
    s, r = admin.call("PUT", f"/api/admin/bookings/{b1}/payment", {"payment_status": "Paid"})
    check("Record payment received", s == 200 and run_query("SELECT payment_status FROM bookings WHERE id=%s", (b1,), one=True)["payment_status"] == "Paid", r)
    s, r = admin.call("PUT", f"/api/admin/bookings/{b2}/payment", {"payment_status": "Paid"})
    check("Payment cannot be recorded for rejected booking", s == 409)
    before = admin.call("GET", "/api/admin/dashboard")[1]["summary"]
    s, r = admin.call("POST", f"/api/admin/vehicles/{car}/archive")
    check("Cannot archive vehicle with open bookings", s == 409, r)
    s, r = admin.call("POST", f"/api/admin/bookings/{b1}/complete")
    check("Complete confirmed booking", s == 200, r)
    s, r = admin.call("POST", f"/api/admin/bookings/{b1}/complete")
    check("Cannot complete twice", s == 409)
    s, r = cust.call("POST", f"/api/bookings/{b1}/cancel")
    check("Completed booking cannot be cancelled", s == 409, r)
    after = admin.call("GET", "/api/admin/dashboard")[1]["summary"]
    check("Dashboard: completed count +1, revenue +3600", after["completed_bookings"] == before["completed_bookings"] + 1 and after["completed_revenue"] == before["completed_revenue"] + 3600, (before, after))
    db = run_query("SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS rev FROM bookings WHERE booking_status='Completed'", one=True)
    check("Dashboard totals match direct SQL", after["completed_bookings"] == db["n"] and after["completed_revenue"] == float(db["rev"]) and after["total_bookings"] == run_query("SELECT COUNT(*) n FROM bookings", one=True)["n"], after)
    check("Pending/rejected/cancelled not counted as revenue", after["completed_revenue"] == float(db["rev"]))

    print("\n== Concurrent approvals ==")
    bike = ids["bike"]
    pend = []
    for c in (cust, cust2):
        s, r = c.call("POST", "/api/bookings", {"vehicle_id": bike, "pickup_date": d(30), "return_date": d(32)})
        pend.append(r["booking"]["id"])
    outcomes = []
    gate = threading.Barrier(2)

    def approve(bid):
        gate.wait()
        outcomes.append(admin.call("POST", f"/api/admin/bookings/{bid}/approve")[0])
    threads = [threading.Thread(target=approve, args=(bid,)) for bid in pend]
    [t.start() for t in threads]; [t.join() for t in threads]
    confirmed = run_query("SELECT COUNT(*) n FROM bookings WHERE vehicle_id=%s AND booking_status='Confirmed'", (bike,), one=True)["n"]
    check("Simultaneous approvals: exactly one wins", sorted(outcomes) == [200, 409] and confirmed == 1, (outcomes, confirmed))

    print("\n== Archive / customers / profile ==")
    for bid in pend:
        admin.call("POST", f"/api/admin/bookings/{bid}/reject")
        admin.call("POST", f"/api/bookings/{bid}/cancel")
    s, r = admin.call("POST", f"/api/admin/vehicles/{ids['scooter']}/archive")
    check("Archive vehicle (soft delete)", s == 200, r)
    check("Archived row still in DB", run_query("SELECT is_archived FROM vehicles WHERE id=%s", (ids["scooter"],), one=True)["is_archived"] == 1)
    s, r = anon.call("GET", "/api/vehicles?q=Testco")
    check("Archived vehicle hidden from customers", ids["scooter"] not in [v["id"] for v in r["vehicles"]])
    s, r = anon.call("GET", f"/api/vehicles/{ids['scooter']}")
    check("Archived vehicle detail returns 404", s == 404)
    s, r = admin.call("GET", "/api/admin/vehicles?archived=1")
    check("Admin can see archived vehicles", ids["scooter"] in [v["id"] for v in r["vehicles"]])
    s, r = admin.call("POST", f"/api/admin/vehicles/{ids['scooter']}/restore")
    check("Restore archived vehicle", s == 200)
    s, r = admin.call("GET", "/api/admin/customers")
    check("Customer list has no password hashes", s == 200 and "password" not in json.dumps(r) and any(c["email"] == reg["email"] for c in r["customers"]))
    s, r = cust.call("PUT", "/api/profile", {"name": "TEST Customer Renamed", "phone": "+91 98765 00000"})
    check("Update profile name and phone", s == 200 and r["user"]["name"] == "TEST Customer Renamed" and r["user"]["phone"] == "+919876500000", r)
    s, r = cust.call("PUT", "/api/profile", {"name": "A", "phone": "1"})
    check("Profile validation", s == 400)
    # foreign keys
    try:
        run_write("INSERT INTO bookings (user_id,vehicle_id,pickup_date,return_date,total_amount) VALUES (999999,%s,%s,%s,1)", (car, d(1), d(2)))
        fk_ok = False
    except Exception:
        fk_ok = True
    check("Foreign key blocks booking for unknown user", fk_ok)
    try:
        run_write("DELETE FROM vehicles WHERE id=%s", (car,))
        fk_ok = False
    except Exception:
        fk_ok = True
    check("Foreign key blocks deleting a vehicle with history", fk_ok)
finally:
    conn = get_connection()
    cur = conn.cursor()
    if created_users:
        fmt = ",".join(["%s"] * len(created_users))
        cur.execute(f"DELETE FROM bookings WHERE user_id IN ({fmt})", created_users)
    if created_vehicles:
        fmt = ",".join(["%s"] * len(created_vehicles))
        cur.execute(f"DELETE FROM bookings WHERE vehicle_id IN ({fmt})", created_vehicles)
        cur.execute(f"DELETE FROM vehicles WHERE id IN ({fmt})", created_vehicles)
    if created_users:
        cur.execute(f"DELETE FROM users WHERE id IN ({','.join(['%s'] * len(created_users))})", created_users)
    conn.commit(); conn.close()

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
raise SystemExit(1 if failed else 0)
