"""Registration, login, logout, sessions and permission checks."""
import hashlib
import hmac
import os
import secrets
import threading
import time

import mysql.connector

from config import SESSION_SECONDS
from database import run_query, run_write
from utils import ApiError, email_field, phone_field, raise_if_errors, text_field

# ---------- password hashing (hashlib.scrypt + a unique salt per user) ----------
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2 ** 14, 8, 1


def hash_password(password):
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password, stored):
    try:
        algo, n, r, p, salt_hex, digest_hex = stored.split("$")
        if algo != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
                                n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def check_password_rules(password, errors):
    if not isinstance(password, str) or len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    elif len(password) > 128:
        errors["password"] = "Password must be at most 128 characters."
    elif not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        errors["password"] = "Password must contain at least one letter and one number."


# ---------- server-side sessions (kept in memory, with an expiry time) ----------
_sessions = {}
_failed_logins = {}
_lock = threading.Lock()


def _key(token):
    # Only a hash of the token is kept on the server.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    now = time.time()
    with _lock:
        for k in [k for k, s in _sessions.items() if s["expires"] < now]:
            del _sessions[k]
        _sessions[_key(token)] = {"user_id": user_id, "expires": now + SESSION_SECONDS}
    return token


def destroy_session(token):
    if token:
        with _lock:
            _sessions.pop(_key(token), None)


PUBLIC_USER_COLUMNS = "id, name, email, phone, role, created_at"


def get_user_for_token(token):
    if not token:
        return None
    with _lock:
        session = _sessions.get(_key(token))
        if not session or session["expires"] < time.time():
            _sessions.pop(_key(token), None)
            return None
        user_id = session["user_id"]
    return run_query(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = %s", (user_id,), one=True)


def session_cookie(token, max_age):
    return f"zelvora_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}"


# ---------- permission checks used by other files ----------
def require_login(ctx):
    if not ctx.user:
        raise ApiError(401, "Please log in to continue.")
    return ctx.user


def require_customer(ctx):
    user = require_login(ctx)
    if user["role"] != "customer":
        raise ApiError(403, "This action is only for customer accounts.")
    return user


def require_admin(ctx):
    user = require_login(ctx)
    if user["role"] != "admin":
        raise ApiError(403, "Admin access is required.")
    return user


# ---------- API handlers ----------
def register(ctx):
    data = ctx.body
    errors = {}
    name = text_field(data, "name", "Full name", errors, min_len=2, max_len=100)
    email = email_field(data, errors)
    phone = phone_field(data, errors)
    password = data.get("password")
    check_password_rules(password, errors)
    if "password" not in errors and password != data.get("confirm_password"):
        errors["confirm_password"] = "Passwords do not match."
    raise_if_errors(errors)

    if run_query("SELECT id FROM users WHERE email = %s", (email,), one=True):
        raise ApiError(409, "An account with this email already exists.", {"email": "This email is already registered."})
    try:
        user_id, _ = run_write(
            "INSERT INTO users (name, email, phone, password_hash, role) VALUES (%s, %s, %s, %s, 'customer')",
            (name, email, phone, hash_password(password)),
        )
    except mysql.connector.IntegrityError:
        raise ApiError(409, "An account with this email already exists.", {"email": "This email is already registered."})

    ctx.set_cookie = session_cookie(create_session(user_id), SESSION_SECONDS)
    user = run_query(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = %s", (user_id,), one=True)
    return 201, {"user": user}


def login(ctx):
    data = ctx.body
    errors = {}
    email = email_field(data, errors)
    password = data.get("password")
    if not isinstance(password, str) or not password:
        errors["password"] = "Password is required."
    raise_if_errors(errors)

    now = time.time()
    with _lock:
        recent = [t for t in _failed_logins.get(email, []) if now - t < 600]
        _failed_logins[email] = recent
    if len(recent) >= 5:
        raise ApiError(429, "Too many failed attempts. Please wait 10 minutes and try again.")

    row = run_query("SELECT id, password_hash FROM users WHERE email = %s", (email,), one=True)
    if not row or not verify_password(password, row["password_hash"]):
        with _lock:
            _failed_logins.setdefault(email, []).append(now)
        raise ApiError(401, "Incorrect email or password.")

    with _lock:
        _failed_logins.pop(email, None)
    ctx.set_cookie = session_cookie(create_session(row["id"]), SESSION_SECONDS)
    user = run_query(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = %s", (row["id"],), one=True)
    return 200, {"user": user}


def logout(ctx):
    destroy_session(ctx.token)
    ctx.set_cookie = session_cookie("", 0)
    return 200, {"message": "You have been logged out."}


def current_user(ctx):
    # Not logged in is a normal answer here, not an error.
    return 200, {"user": ctx.user}


def update_profile(ctx):
    user = require_login(ctx)
    errors = {}
    name = text_field(ctx.body, "name", "Full name", errors, min_len=2, max_len=100)
    phone = phone_field(ctx.body, errors)
    raise_if_errors(errors)
    run_write("UPDATE users SET name = %s, phone = %s WHERE id = %s", (name, phone, user["id"]))
    updated = run_query(f"SELECT {PUBLIC_USER_COLUMNS} FROM users WHERE id = %s", (user["id"],), one=True)
    return 200, {"user": updated, "message": "Your profile was updated."}
