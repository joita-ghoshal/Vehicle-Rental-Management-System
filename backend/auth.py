"""Registration, login, logout, sessions and permission checks."""
import hashlib
import hmac
import os
import secrets
import threading
import time

import mysql.connector

from config import (COOKIE_DOMAIN, COOKIE_SAMESITE, COOKIE_SECURE, DEMO_MODE,
                    SESSION_SECONDS, SESSION_STORE)
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
        if algo != "scrypt" or (int(n), int(r), int(p)) != (SCRYPT_N, SCRYPT_R, SCRYPT_P):
            return False
        if len(bytes.fromhex(salt_hex)) != 16 or len(bytes.fromhex(digest_hex)) != 32:
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex),
                                n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError, AttributeError, OverflowError):
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
LOGIN_WINDOW_SECONDS = 600
MAX_LOGIN_FAILURES = 5
MAX_LOGIN_EMAILS = 10000
_last_cleanup = 0
_last_db_cleanup = 0


def _cleanup_locked(now, force=False):
    """Caller holds _lock. Periodically prune ALL expired entries, not one email."""
    global _last_cleanup
    if not force and now - _last_cleanup < 60:
        return
    for key in [k for k, session in _sessions.items() if session['expires'] <= now]:
        del _sessions[key]
    for email, attempts in list(_failed_logins.items()):
        recent = [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]
        if recent:
            _failed_logins[email] = recent
        else:
            del _failed_logins[email]
    _last_cleanup = now


def cleanup_auth_state():
    now = time.time()
    with _lock:
        _cleanup_locked(now)
    if SESSION_STORE == "db":
        global _last_db_cleanup
        if now - _last_db_cleanup >= 60:
            try:
                run_write("DELETE FROM sessions WHERE expires_at <= %s", (now,))
            except mysql.connector.Error:
                # Readiness/health must remain observable during an outage.
                pass
            _last_db_cleanup = now


def _key(token):
    # Only a hash of the token is kept on the server.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id, expected_hash=None):
    token = secrets.token_urlsafe(32)
    now = time.time()
    row = run_query("SELECT password_hash FROM users WHERE id = %s", (user_id,), one=True)
    if not row:
        raise ApiError(401, "This account no longer exists. Please log in again.")
    if expected_hash is not None and not hmac.compare_digest(expected_hash, row['password_hash']):
        raise ApiError(401, "Credentials changed. Please log in again.")
    stamp = _key(row["password_hash"])
    with _lock:
        _cleanup_locked(now)
    if SESSION_STORE == "db":
        run_write(
            "INSERT INTO sessions (token_hash, user_id, expires_at, password_stamp) VALUES (%s, %s, %s, %s)",
            (_key(token), user_id, now + SESSION_SECONDS, stamp),
        )
    else:
        with _lock:
            _sessions[_key(token)] = {"user_id": user_id, "expires": now + SESSION_SECONDS,
                                      "password_stamp": stamp}
    return token


def destroy_session(token):
    if token:
        key = _key(token)
        with _lock:
            _sessions.pop(key, None)
        if SESSION_STORE == "db":
            run_write("DELETE FROM sessions WHERE token_hash = %s", (key,))


PUBLIC_USER_COLUMNS = "id, name, email, phone, role, is_demo, created_at"


def get_user_for_token(token):
    if not isinstance(token, str) or not token or len(token) > 200:
        return None
    key = _key(token)
    if SESSION_STORE == "db":
        session = run_query(
            "SELECT user_id, expires_at, password_stamp FROM sessions WHERE token_hash = %s",
            (key,), one=True,
        )
        if not session or session["expires_at"] <= time.time():
            if session:
                run_write("DELETE FROM sessions WHERE token_hash = %s", (key,))
            return None
        user_id = session["user_id"]
        stamp = session["password_stamp"]
    else:
        with _lock:
            session = _sessions.get(key)
            if not session or session["expires"] <= time.time():
                _sessions.pop(key, None)
                return None
            user_id = session["user_id"]
            stamp = session["password_stamp"]
    user = run_query(f"SELECT {PUBLIC_USER_COLUMNS}, password_hash FROM users WHERE id = %s", (user_id,), one=True)
    if not user or not hmac.compare_digest(stamp, _key(user.pop("password_hash"))):
        destroy_session(token)
        return None
    # Legacy demo rows may exist in the private database. They are not usable
    # with public passwords, even if an old cookie is presented.
    if user["is_demo"] and not DEMO_MODE:
        destroy_session(token)
        return None
    return user


def session_cookie(token, max_age):
    parts = [
        f"zelvora_session={token}",
        "HttpOnly",
        f"SameSite={COOKIE_SAMESITE}",
        "Path=/",
        f"Max-Age={max_age}",
    ]
    if COOKIE_DOMAIN:
        parts.append(f"Domain={COOKIE_DOMAIN}")
    if COOKIE_SECURE:
        parts.append("Secure")
    return "; ".join(parts)


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
    """Authoritative admin check used by every administrative endpoint.

    ``is_demo`` marks accounts that belong to the public demonstration. It is
    informational only: the Main Admin demo account has exactly the same full
    control as any other admin. Access is decided by ``role`` alone.
    """
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
    if DEMO_MODE and not email.endswith((".example", ".test", ".local")):
        errors["email"] = "Demo only: use a synthetic email ending in .example, .test or .local."
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
            "INSERT INTO users (name, email, phone, password_hash, role, is_demo) VALUES (%s, %s, %s, %s, 'customer', %s)",
            (name, email, phone, hash_password(password), int(DEMO_MODE)),
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
    elif len(password) > 128:
        errors["password"] = "Password must be at most 128 characters."
    raise_if_errors(errors)

    now = time.time()
    with _lock:
        _cleanup_locked(now)
        recent = [t for t in _failed_logins.get(email, []) if now - t < LOGIN_WINDOW_SECONDS]
        if len(recent) >= MAX_LOGIN_FAILURES:
            raise ApiError(429, "Too many failed attempts. Please wait 10 minutes and try again.")
        if email not in _failed_logins and len(_failed_logins) >= MAX_LOGIN_EMAILS:
            _cleanup_locked(now, force=True)
            if len(_failed_logins) >= MAX_LOGIN_EMAILS:
                raise ApiError(429, "Login is busy. Please try again later.")
        # Reserve an attempt before password verification so concurrent failures
        # cannot bypass the limit. Successful authentication clears the bucket.
        recent.append(now)
        _failed_logins[email] = recent

    try:
        row = run_query("SELECT id, password_hash, is_demo FROM users WHERE email = %s", (email,), one=True)
    except mysql.connector.Error:
        # Infrastructure failures are not incorrect-password attempts.
        with _lock:
            attempts = _failed_logins.get(email, [])
            if now in attempts:
                attempts.remove(now)
            if not attempts:
                _failed_logins.pop(email, None)
        raise
    if not row or (row["is_demo"] and not DEMO_MODE) or not verify_password(password, row["password_hash"]):
        raise ApiError(401, "Incorrect email or password.")

    with _lock:
        _failed_logins.pop(email, None)
    destroy_session(ctx.token)
    ctx.set_cookie = session_cookie(create_session(row["id"], expected_hash=row['password_hash']), SESSION_SECONDS)
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
