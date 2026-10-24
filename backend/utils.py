"""Small helpers shared by the backend files."""
import datetime
import decimal
import json
import re


class ApiError(Exception):
    """Raise this to send a clear error message to the browser."""

    def __init__(self, status, message, fields=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.fields = fields or {}


class JsonEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        if isinstance(o, decimal.Decimal):
            return float(o)
        return super().default(o)


EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
PHONE_RE = re.compile(r"^\+?\d{10,14}$")


def raise_if_errors(errors):
    if errors:
        raise ApiError(400, "Please fix the highlighted fields.", errors)


def text_field(data, key, label, errors, min_len=1, max_len=100):
    value = data.get(key)
    value = value.strip() if isinstance(value, str) else ""
    if len(value) < min_len:
        errors[key] = f"{label} is required." if min_len <= 1 else f"{label} must be at least {min_len} characters."
    elif len(value) > max_len:
        errors[key] = f"{label} must be at most {max_len} characters."
    return value


def email_field(data, errors):
    value = data.get("email")
    value = value.strip().lower() if isinstance(value, str) else ""
    if not value:
        errors["email"] = "Email is required."
    elif len(value) > 150 or not EMAIL_RE.match(value):
        errors["email"] = "Enter a valid email address."
    return value


def phone_field(data, errors):
    value = data.get("phone")
    value = re.sub(r"[\s\-()]", "", value) if isinstance(value, str) else ""
    if not value:
        errors["phone"] = "Phone number is required."
    elif not PHONE_RE.match(value):
        errors["phone"] = "Enter a phone number with 10 to 14 digits."
    return value


def parse_date(value, label, key):
    """Turn 'YYYY-MM-DD' into a date. Raises ApiError when it is wrong."""
    if not isinstance(value, str) or not value:
        raise ApiError(400, f"{label} is required.", {key: f"{label} is required."})
    try:
        return datetime.date.fromisoformat(value)
    except ValueError:
        raise ApiError(400, f"{label} is not a valid date.", {key: "Use a valid date."})
