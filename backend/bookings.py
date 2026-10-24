"""Customer booking APIs: create, list and cancel."""
from auth import require_customer, require_login
from database import run_query, transaction
from utils import ApiError
from vehicles import rental_days, validate_rental_dates

BOOKING_COLUMNS = (
    "b.id, b.user_id, b.vehicle_id, b.pickup_date, b.return_date, b.total_amount, b.booking_status, "
    "b.payment_status, b.created_at, v.name AS vehicle_name, v.brand AS vehicle_brand, "
    "v.model AS vehicle_model, v.category AS vehicle_category, v.registration_number, v.image_url"
)


def to_id(value, label="id"):
    try:
        number = int(value)
        if number < 1:
            raise ValueError
        return number
    except (TypeError, ValueError):
        raise ApiError(400, f"Invalid {label}.")


def has_confirmed_conflict(cur, vehicle_id, pickup, ret, exclude_booking_id=0):
    """Is there another Confirmed booking for this vehicle that overlaps the dates?"""
    cur.execute(
        "SELECT id FROM bookings WHERE vehicle_id = %s AND booking_status = 'Confirmed' AND id <> %s "
        "AND pickup_date <= %s AND return_date >= %s LIMIT 1",
        (vehicle_id, exclude_booking_id, ret, pickup))
    return cur.fetchone() is not None


def create_booking(ctx):
    user = require_customer(ctx)
    vehicle_id = to_id(ctx.body.get("vehicle_id"), "vehicle")
    pickup, ret = validate_rental_dates(ctx.body.get("pickup_date"), ctx.body.get("return_date"))
    days = rental_days(pickup, ret)

    with transaction() as cur:
        # Lock the vehicle row so bookings for the same vehicle are checked one at a time.
        cur.execute("SELECT id, price_per_day, status, is_archived FROM vehicles WHERE id = %s FOR UPDATE", (vehicle_id,))
        vehicle = cur.fetchone()
        if not vehicle or vehicle["is_archived"]:
            raise ApiError(404, "This vehicle could not be found.")
        if vehicle["status"] != "Active":
            raise ApiError(409, "This vehicle is not available for booking right now.")
        if has_confirmed_conflict(cur, vehicle_id, pickup, ret):
            raise ApiError(409, "This vehicle is already booked for some of these dates. Please choose other dates.")
        cur.execute(
            "SELECT id FROM bookings WHERE user_id = %s AND vehicle_id = %s AND booking_status IN ('Pending', 'Confirmed') "
            "AND pickup_date <= %s AND return_date >= %s LIMIT 1", (user["id"], vehicle_id, ret, pickup))
        if cur.fetchone():
            raise ApiError(409, "You already have a booking for this vehicle on overlapping dates.")
        total = round(float(vehicle["price_per_day"]) * days, 2)
        cur.execute(
            "INSERT INTO bookings (user_id, vehicle_id, pickup_date, return_date, total_amount) VALUES (%s, %s, %s, %s, %s)",
            (user["id"], vehicle_id, pickup, ret, total))
        booking_id = cur.lastrowid

    booking = run_query(f"SELECT {BOOKING_COLUMNS} FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id WHERE b.id = %s",
                        (booking_id,), one=True)
    return 201, {"booking": booking, "message": "Booking request sent. You will pay at pickup once it is confirmed."}


def my_bookings(ctx):
    user = require_login(ctx)
    rows = run_query(
        f"SELECT {BOOKING_COLUMNS}, (b.booking_status IN ('Pending', 'Confirmed') AND b.pickup_date > CURDATE()) AS can_cancel "
        "FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id WHERE b.user_id = %s ORDER BY b.created_at DESC, b.id DESC",
        (user["id"],))
    for row in rows:
        row["can_cancel"] = bool(row["can_cancel"])
    return 200, {"bookings": rows}


def cancel_booking(ctx):
    user = require_login(ctx)
    booking_id = to_id(ctx.params["id"], "booking")
    with transaction() as cur:
        cur.execute("SELECT id, booking_status, pickup_date, (pickup_date > CURDATE()) AS before_pickup "
                    "FROM bookings WHERE id = %s AND user_id = %s FOR UPDATE", (booking_id, user["id"]))
        booking = cur.fetchone()
        if not booking:
            raise ApiError(404, "Booking not found.")
        if booking["booking_status"] not in ("Pending", "Confirmed"):
            raise ApiError(409, f"A {booking['booking_status'].lower()} booking cannot be cancelled.")
        if not booking["before_pickup"]:
            raise ApiError(409, "Bookings can only be cancelled before the pickup date.")
        cur.execute("UPDATE bookings SET booking_status = 'Cancelled' WHERE id = %s", (booking_id,))
    return 200, {"message": "Your booking was cancelled."}
