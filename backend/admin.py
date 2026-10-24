"""Admin APIs. Every function checks for an admin on the server."""
import mysql.connector

from auth import require_admin
from bookings import BOOKING_COLUMNS, has_confirmed_conflict, to_id
from database import run_query, run_write, transaction
from utils import ApiError
from vehicles import validate_vehicle_payload

VEHICLE_FIELDS = ("name", "brand", "model", "category", "registration_number", "fuel_type", "transmission",
                  "seats", "price_per_day", "image_url", "description", "status")


# ---------- dashboard ----------
def dashboard(ctx):
    require_admin(ctx)
    one = lambda sql: run_query(sql, one=True)
    summary = {
        "total_vehicles": one("SELECT COUNT(*) AS n FROM vehicles WHERE is_archived = 0")["n"],
        "total_customers": one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'")["n"],
        "total_bookings": one("SELECT COUNT(*) AS n FROM bookings")["n"],
        "pending_bookings": one("SELECT COUNT(*) AS n FROM bookings WHERE booking_status = 'Pending'")["n"],
        "confirmed_bookings": one("SELECT COUNT(*) AS n FROM bookings WHERE booking_status = 'Confirmed'")["n"],
        "completed_bookings": one("SELECT COUNT(*) AS n FROM bookings WHERE booking_status = 'Completed'")["n"],
        "completed_revenue": one("SELECT COALESCE(SUM(total_amount), 0) AS n FROM bookings WHERE booking_status = 'Completed'")["n"],
    }
    recent = run_query(
        f"SELECT {BOOKING_COLUMNS}, u.name AS customer_name FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id "
        "JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC, b.id DESC LIMIT 5")
    return 200, {"summary": summary, "recent_bookings": recent}


# ---------- vehicles ----------
def list_vehicles(ctx):
    require_admin(ctx)
    archived = 1 if ctx.query.get("archived") == "1" else 0
    rows = run_query(
        "SELECT v.*, (SELECT COUNT(*) FROM bookings b WHERE b.vehicle_id = v.id) AS booking_count "
        "FROM vehicles v WHERE v.is_archived = %s ORDER BY v.id DESC", (archived,))
    return 200, {"vehicles": rows}


def get_vehicle(ctx):
    require_admin(ctx)
    row = run_query("SELECT * FROM vehicles WHERE id = %s", (to_id(ctx.params["id"], "vehicle"),), one=True)
    if not row:
        raise ApiError(404, "Vehicle not found.")
    return 200, {"vehicle": row}


def _duplicate_registration():
    return ApiError(409, "A vehicle with this registration number already exists.",
                    {"registration_number": "This registration number is already used."})


def add_vehicle(ctx):
    require_admin(ctx)
    v = validate_vehicle_payload(ctx.body)
    try:
        vehicle_id, _ = run_write(
            f"INSERT INTO vehicles ({', '.join(VEHICLE_FIELDS)}) VALUES ({', '.join(['%s'] * len(VEHICLE_FIELDS))})",
            tuple(v[f] for f in VEHICLE_FIELDS))
    except mysql.connector.IntegrityError:
        raise _duplicate_registration()
    return 201, {"vehicle": run_query("SELECT * FROM vehicles WHERE id = %s", (vehicle_id,), one=True),
                 "message": "Vehicle added."}


def edit_vehicle(ctx):
    require_admin(ctx)
    vehicle_id = to_id(ctx.params["id"], "vehicle")
    if not run_query("SELECT id FROM vehicles WHERE id = %s", (vehicle_id,), one=True):
        raise ApiError(404, "Vehicle not found.")
    v = validate_vehicle_payload(ctx.body)
    try:
        run_write(f"UPDATE vehicles SET {', '.join(f + ' = %s' for f in VEHICLE_FIELDS)} WHERE id = %s",
                  tuple(v[f] for f in VEHICLE_FIELDS) + (vehicle_id,))
    except mysql.connector.IntegrityError:
        raise _duplicate_registration()
    return 200, {"vehicle": run_query("SELECT * FROM vehicles WHERE id = %s", (vehicle_id,), one=True),
                 "message": "Vehicle updated."}


def archive_vehicle(ctx):
    """Soft delete: the row stays so booking history is never lost."""
    require_admin(ctx)
    vehicle_id = to_id(ctx.params["id"], "vehicle")
    with transaction() as cur:
        cur.execute("SELECT id FROM vehicles WHERE id = %s FOR UPDATE", (vehicle_id,))
        if not cur.fetchone():
            raise ApiError(404, "Vehicle not found.")
        cur.execute("SELECT COUNT(*) AS n FROM bookings WHERE vehicle_id = %s AND booking_status IN ('Pending', 'Confirmed') "
                    "AND return_date >= CURDATE()", (vehicle_id,))
        if cur.fetchone()["n"]:
            raise ApiError(409, "This vehicle has open bookings. Reject, cancel or complete them before archiving.")
        cur.execute("UPDATE vehicles SET is_archived = 1 WHERE id = %s", (vehicle_id,))
    return 200, {"message": "Vehicle archived. It no longer appears for customers."}


def restore_vehicle(ctx):
    require_admin(ctx)
    _, changed = run_write("UPDATE vehicles SET is_archived = 0 WHERE id = %s",
                           (to_id(ctx.params["id"], "vehicle"),))
    if not changed:
        raise ApiError(404, "Vehicle not found or already restored.")
    return 200, {"message": "Vehicle restored."}


# ---------- customers ----------
def list_customers(ctx):
    require_admin(ctx)
    rows = run_query(
        "SELECT u.id, u.name, u.email, u.phone, u.created_at, COUNT(b.id) AS booking_count "
        "FROM users u LEFT JOIN bookings b ON b.user_id = u.id WHERE u.role = 'customer' "
        "GROUP BY u.id, u.name, u.email, u.phone, u.created_at ORDER BY u.created_at DESC, u.id DESC")
    return 200, {"customers": rows}


# ---------- bookings ----------
def list_bookings(ctx):
    require_admin(ctx)
    status = ctx.query.get("status")
    sql = (f"SELECT {BOOKING_COLUMNS}, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone "
           "FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id JOIN users u ON u.id = b.user_id")
    params = ()
    if status:
        if status not in ("Pending", "Confirmed", "Rejected", "Cancelled", "Completed"):
            raise ApiError(400, "Unknown booking status.")
        sql += " WHERE b.booking_status = %s"
        params = (status,)
    return 200, {"bookings": run_query(sql + " ORDER BY b.created_at DESC, b.id DESC", params)}


def approve_booking(ctx):
    require_admin(ctx)
    booking_id = to_id(ctx.params["id"], "booking")
    first_look = run_query("SELECT vehicle_id FROM bookings WHERE id = %s", (booking_id,), one=True)
    if not first_look:
        raise ApiError(404, "Booking not found.")
    with transaction() as cur:
        # Lock the vehicle first. Two admins approving bookings for the same vehicle
        # now wait for each other, so only one of them can win an overlapping date.
        cur.execute("SELECT id, status, is_archived FROM vehicles WHERE id = %s FOR UPDATE", (first_look["vehicle_id"],))
        vehicle = cur.fetchone()
        cur.execute("SELECT id, vehicle_id, booking_status, pickup_date, return_date, "
                    "(pickup_date < CURDATE()) AS pickup_passed FROM bookings WHERE id = %s FOR UPDATE", (booking_id,))
        booking = cur.fetchone()
        if booking["booking_status"] != "Pending":
            raise ApiError(409, f"Only pending bookings can be approved. This one is {booking['booking_status'].lower()}.")
        if vehicle["is_archived"] or vehicle["status"] != "Active":
            raise ApiError(409, "This vehicle is not active, so the booking cannot be confirmed.")
        if booking["pickup_passed"]:
            raise ApiError(409, "The pickup date has already passed. Reject this booking instead.")
        if has_confirmed_conflict(cur, booking["vehicle_id"], booking["pickup_date"], booking["return_date"], booking_id):
            raise ApiError(409, "Another confirmed booking already covers some of these dates.")
        cur.execute("UPDATE bookings SET booking_status = 'Confirmed' WHERE id = %s", (booking_id,))
    return 200, {"message": "Booking confirmed."}


def _change_status(booking_id, allowed_from, new_status, error_text):
    with transaction() as cur:
        cur.execute("SELECT id, booking_status FROM bookings WHERE id = %s FOR UPDATE", (booking_id,))
        booking = cur.fetchone()
        if not booking:
            raise ApiError(404, "Booking not found.")
        if booking["booking_status"] != allowed_from:
            raise ApiError(409, error_text.format(status=booking["booking_status"].lower()))
        cur.execute("UPDATE bookings SET booking_status = %s WHERE id = %s", (new_status, booking_id))


def reject_booking(ctx):
    require_admin(ctx)
    _change_status(to_id(ctx.params["id"], "booking"), "Pending", "Rejected",
                   "Only pending bookings can be rejected. This one is {status}.")
    return 200, {"message": "Booking rejected. Its history is kept."}


def complete_booking(ctx):
    require_admin(ctx)
    _change_status(to_id(ctx.params["id"], "booking"), "Confirmed", "Completed",
                   "Only confirmed bookings can be completed. This one is {status}.")
    return 200, {"message": "Booking marked as completed."}


def update_payment(ctx):
    require_admin(ctx)
    booking_id = to_id(ctx.params["id"], "booking")
    status = ctx.body.get("payment_status")
    if status not in ("Paid", "Unpaid"):
        raise ApiError(400, "Payment status must be Paid or Unpaid.")
    with transaction() as cur:
        cur.execute("SELECT id, booking_status FROM bookings WHERE id = %s FOR UPDATE", (booking_id,))
        booking = cur.fetchone()
        if not booking:
            raise ApiError(404, "Booking not found.")
        if booking["booking_status"] not in ("Confirmed", "Completed"):
            raise ApiError(409, "Payment can only be recorded for confirmed or completed bookings.")
        cur.execute("UPDATE bookings SET payment_status = %s WHERE id = %s", (status, booking_id))
    return 200, {"message": f"Payment marked as {status.lower()}."}
