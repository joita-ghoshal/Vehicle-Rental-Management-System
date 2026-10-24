"""Public vehicle APIs: list, search, details and availability."""
import datetime

from database import run_query
from utils import ApiError, parse_date, raise_if_errors, text_field

CATEGORIES = ("Car", "Bike", "Scooter")
FUEL_TYPES = ("Petrol", "Diesel", "Electric", "CNG", "Hybrid")
TRANSMISSIONS = ("Manual", "Automatic", "Not applicable")
STATUSES = ("Active", "Inactive", "Maintenance")
DEFAULT_IMAGES = {"Car": "/images/car-sedan.svg", "Bike": "/images/bike-sport.svg", "Scooter": "/images/scooter-classic.svg"}
MAX_RENTAL_DAYS = 60

# True when a Confirmed booking overlaps the dates (two ranges overlap when
# one starts on or before the other ends, and ends on or after the other starts).
CONFLICT_SQL = (
    "EXISTS (SELECT 1 FROM bookings b WHERE b.vehicle_id = v.id AND b.booking_status = 'Confirmed' "
    "AND b.pickup_date <= %s AND b.return_date >= %s)"
)


def rental_days(pickup, return_date):
    """Both dates are inclusive: 5 Jan to 5 Jan is 1 day."""
    return (return_date - pickup).days + 1


def validate_rental_dates(pickup_raw, return_raw):
    pickup = parse_date(pickup_raw, "Pickup date", "pickup_date")
    ret = parse_date(return_raw, "Return date", "return_date")
    today = datetime.date.today()
    if pickup < today:
        raise ApiError(400, "Pickup date cannot be in the past.", {"pickup_date": "Pickup date cannot be in the past."})
    if ret < pickup:
        raise ApiError(400, "Return date cannot be before the pickup date.", {"return_date": "Return date cannot be before pickup."})
    if rental_days(pickup, ret) > MAX_RENTAL_DAYS:
        raise ApiError(400, f"A booking can be at most {MAX_RENTAL_DAYS} days.", {"return_date": f"Choose at most {MAX_RENTAL_DAYS} days."})
    if (pickup - today).days > 365:
        raise ApiError(400, "Bookings can only be made up to one year ahead.", {"pickup_date": "Choose a date within one year."})
    return pickup, ret


def validate_vehicle_payload(data):
    """Used by the admin add/edit APIs. Returns clean values or raises ApiError."""
    errors = {}
    name = text_field(data, "name", "Name", errors, max_len=100)
    brand = text_field(data, "brand", "Brand", errors, max_len=60)
    model = text_field(data, "model", "Model", errors, max_len=60)
    registration = " ".join(text_field(data, "registration_number", "Registration number", errors, max_len=30).upper().split())
    description = text_field(data, "description", "Description", errors, min_len=10, max_len=2000)

    category = data.get("category")
    if category not in CATEGORIES:
        errors["category"] = "Choose Car, Bike or Scooter."
    fuel = data.get("fuel_type")
    if fuel not in FUEL_TYPES:
        errors["fuel_type"] = "Choose a valid fuel type."
    transmission = data.get("transmission") or "Not applicable"
    if transmission not in TRANSMISSIONS:
        errors["transmission"] = "Choose a valid transmission."
    status = data.get("status") or "Active"
    if status not in STATUSES:
        errors["status"] = "Choose Active, Inactive or Maintenance."

    try:
        seats = int(data.get("seats"))
        if not 1 <= seats <= 12:
            raise ValueError
    except (TypeError, ValueError):
        seats = None
        errors["seats"] = "Seats must be a whole number from 1 to 12."
    try:
        price = round(float(data.get("price_per_day")), 2)
        if not 0 < price <= 1000000:
            raise ValueError
    except (TypeError, ValueError):
        price = None
        errors["price_per_day"] = "Enter a price greater than 0."

    image = data.get("image_url")
    image = image.strip() if isinstance(image, str) else ""
    if not image:
        image = DEFAULT_IMAGES.get(category, DEFAULT_IMAGES["Car"])
    elif len(image) > 500 or not (image.startswith("https://") or image.startswith("http://") or image.startswith("/images/")):
        errors["image_url"] = "Use an http(s) link or a path that starts with /images/."

    raise_if_errors(errors)
    return {
        "name": name, "brand": brand, "model": model, "category": category,
        "registration_number": registration, "fuel_type": fuel, "transmission": transmission,
        "seats": seats, "price_per_day": price, "image_url": image,
        "description": description, "status": status,
    }


VEHICLE_COLUMNS = ("v.id, v.name, v.brand, v.model, v.category, v.registration_number, v.fuel_type, "
                   "v.transmission, v.seats, v.price_per_day, v.image_url, v.description, v.status")


def list_vehicles(ctx):
    q = ctx.query
    today = datetime.date.today()
    pickup = ret = today
    if q.get("pickup") or q.get("return"):
        pickup, ret = validate_rental_dates(q.get("pickup"), q.get("return"))

    where = ["v.is_archived = 0", "v.status = 'Active'"]
    where_params = []
    search = (q.get("q") or "").strip()[:100]
    if search:
        where.append("(v.name LIKE %s OR v.brand LIKE %s OR v.model LIKE %s)")
        like = f"%{search}%"
        where_params += [like, like, like]
    if q.get("category"):
        if q["category"] not in CATEGORIES:
            raise ApiError(400, "Unknown category.")
        where.append("v.category = %s")
        where_params.append(q["category"])
    for key, op in (("min_price", ">="), ("max_price", "<=")):
        if q.get(key):
            try:
                value = float(q[key])
            except ValueError:
                raise ApiError(400, "Price filters must be numbers.")
            where.append(f"v.price_per_day {op} %s")
            where_params.append(value)
    if q.get("available") == "1":
        where.append(f"NOT {CONFLICT_SQL}")
        where_params += [ret, pickup]

    order = {"price_asc": "v.price_per_day ASC", "price_desc": "v.price_per_day DESC"}.get(q.get("sort"), "v.id DESC")
    sql = (f"SELECT {VEHICLE_COLUMNS}, {CONFLICT_SQL} AS is_booked FROM vehicles v "
           f"WHERE {' AND '.join(where)} ORDER BY {order}")
    rows = run_query(sql, [ret, pickup] + where_params)
    for row in rows:
        row["is_booked"] = bool(row["is_booked"])
    return 200, {"vehicles": rows}


def get_vehicle(ctx):
    vehicle = run_query(f"SELECT {VEHICLE_COLUMNS} FROM vehicles v WHERE v.id = %s AND v.is_archived = 0",
                        (ctx.params["id"],), one=True)
    if not vehicle:
        raise ApiError(404, "This vehicle could not be found.")
    vehicle["booked_ranges"] = run_query(
        "SELECT pickup_date, return_date FROM bookings WHERE vehicle_id = %s AND booking_status = 'Confirmed' "
        "AND return_date >= CURDATE() ORDER BY pickup_date", (vehicle["id"],))
    return 200, {"vehicle": vehicle}


def check_availability(ctx):
    vehicle = run_query("SELECT id, price_per_day, status, is_archived FROM vehicles WHERE id = %s",
                        (ctx.params["id"],), one=True)
    if not vehicle or vehicle["is_archived"]:
        raise ApiError(404, "This vehicle could not be found.")
    pickup, ret = validate_rental_dates(ctx.query.get("pickup"), ctx.query.get("return"))
    days = rental_days(pickup, ret)
    total = round(float(vehicle["price_per_day"]) * days, 2)
    result = {"rental_days": days, "total_amount": total, "available": True, "reason": ""}
    if vehicle["status"] != "Active":
        result.update(available=False, reason=f"This vehicle is currently {vehicle['status'].lower()} and cannot be booked.")
    else:
        clash = run_query(
            "SELECT 1 AS x FROM bookings WHERE vehicle_id = %s AND booking_status = 'Confirmed' "
            "AND pickup_date <= %s AND return_date >= %s LIMIT 1", (vehicle["id"], ret, pickup), one=True)
        if clash:
            result.update(available=False, reason="This vehicle is already booked for some of these dates.")
    return 200, result
