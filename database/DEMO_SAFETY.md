# Synthetic demo operations (Phase 3)

## Separation and access

- `python demo.py ...` selects only `zelvora_demo_db` for that process; private `.env` settings are not edited.
- Setup does not clone private rows. An existing unmarked database is refused. Every demo API request rechecks the marker and reserved user-email domains; failure stops data access with 503, not a weaker admin role.
- Main Admin remains a full-control `admin`. Customer records and registrations are unmasked in authorized administrative APIs. Public catalog/detail registration values are masked; customers see actual registrations in their own bookings.
- Legacy demo logins and cookies cannot authenticate in private mode. A real/private admin has a separate password; never publish it in `demo_accounts.py`.
- Registration requires reserved email suffixes. Names, phones, free-text vehicle fields and manual imports still require operator discipline: never enter real private information. The app cannot prove a name is fictitious.
- Before local demonstrations run `python demo.py audit`. It reports row counts only, rejects non-synthetic email domains, and makes no changes. This is not a DLP or production-security guarantee.

## Reset/retention design and approval boundary

Phase 2 `seed` is an **explicit credential refresh**, not a business-data reset. It does not clear bookings or revert edited vehicles. It invalidates existing sessions via changed password hashes.

A future full-data reset must be an **offline operator action**, never a public HTTP endpoint or an admin-role restriction:

1. Explicitly request approval to reset **only `zelvora_demo_db`**. Refuse other names, missing marker, non-reserved user email domains or active API access.
2. Stop the demo server; do not stop MySQL or a private server. Take a local, access-controlled backup and verify its restore path before proceeding.
3. Show counts (no PII); require typing the exact database name and confirming irreversible replacement.
4. Use one InnoDB transaction with foreign keys enabled: remove demo bookings before users/vehicles, then restore source-controlled fictional vehicles and hashed public demo accounts. Roll back completely on failure. Never drop a database, disable foreign keys, use `TRUNCATE`, or issue schema-changing DDL inside this transaction.
5. Restart the demo server (all in-memory sessions and login buckets discarded), rerun the isolation audit and full Main Admin regression suite, then delete the short-lived backup only under an agreed retention policy.

No automatic expiry/cron deletion, broad reset command or live data reset was implemented/executed in Phase 3. Until a retention/reset policy is approved, operators should inspect demo data before each presentation and keep the environment local. This deliberate boundary prevents surprise data loss while meeting Phase 3's reset-strategy design task.

## Later public hosting

Provision a dedicated MySQL principal limited to the demo schema (the current local principal can be root); retain a separately secured private environment. HTTPS, a hardened server, persistent sessions, dependency upgrades, abuse controls, privacy notices and retention policy must be reviewed before public hosting. Full-control demo access is intentional, and its data is disposable by design; it must never be mixed with private administration.
