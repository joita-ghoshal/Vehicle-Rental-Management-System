# ZELVORA — Production Deployment Plan (Phase 7)

**Status:** Deployed on 12 November 2026 on free plans. Live at **https://zelvora-sg9w.onrender.com**.
No paid plan or billing method is used. See the Phase 8 record in `step.md` for verification evidence and limits.

## 1. Hosting research (checked 12 November 2026)

| Service | Free offering | Important limits | Verdict |
|---|---|---|---|
| **Render** web service | Free web service, ~750 hours/month | Sleeps after ~15 idle minutes; ~1 minute cold start; 512 MB RAM; free plan is for demos | **Recommended for the app** |
| **Aiven MySQL** | Free tier **retired for new services** | Existing free MySQL services end **21 December 2026** | **Do not use** |
| **TiDB Cloud Starter** | MySQL-compatible; up to 5 free instances; ~5 GiB row storage and 50M request units per instance/month | Cross-shard foreign keys are not enforced; auto-increment values are not gap-free | **Recommended database** (small academic demo) |
| **Railway** | 30-day trial with $5 credit; then a small monthly free usage allowance | Not a dependable permanent free MySQL + app host | Fallback / short demo |
| **Koyeb** | One free web service, 512 MB RAM | Sleeps; no free managed MySQL | Alternative app host |
| **GitHub Pages** | Static hosting | Cannot run Python or MySQL; deep links still return HTTP 404 | Static shell only |
| **PythonAnywhere** | Free web app | WSGI model, not the project's built-in HTTP server; limited MySQL | Not a drop-in fit |

Free tiers change frequently. Re-check limits before Phase 8 and never enable a paid plan without approval.

## 2. Recommended architecture — Option A (single origin)

```text
Browser ──HTTPS──> Render Docker web service
                    ├── Python API (/api/*)
                    ├── Built React app (all other routes)
                    └── mysql-connector (TLS) ──> TiDB Cloud Starter (MySQL-compatible)
```

- The Python server serves `frontend/dist` and falls back to `index.html` for React deep links.
- One origin means no CORS, no third-party-cookie problem, and `SameSite=Lax` cookies work.
- Production sessions use the `sessions` table (`ZELVORA_SESSION_STORE=db`), so a restart does not log
  everyone out.
- `Secure` cookies are enabled over HTTPS; the API binds to `0.0.0.0` only inside the container.

### Alternatives

| Option | Shape | Trade-offs |
|---|---|---|
| **B — split origin** | Netlify/Vercel frontend + Render API + TiDB | Clean separation, but needs `ZELVORA_ALLOWED_ORIGINS`, `SameSite=None; Secure`, and `VITE_API_URL` |
| **C — Pages + API** | GitHub Pages frontend + Render API | Cheapest familiarity, but Pages cannot serve a real 200 SPA rewrite and third-party cookies are unreliable |

**Decision:** Option A. The optional CORS/cookie settings are implemented so Option B remains possible without
code changes.

## 3. Authentication transport decision

- **Same-origin (recommended):** HttpOnly session cookie, `SameSite=Lax`, `Secure` in production.
- **Split origin:** `ZELVORA_COOKIE_SAMESITE=None`, `ZELVORA_COOKIE_SECURE=1`, an explicit
  `ZELVORA_ALLOWED_ORIGINS` list, and `VITE_API_URL` pointing at the API origin.
- Cookies are always `HttpOnly`; raw session tokens are never stored in the database (only SHA-256 digests).
- `ZELVORA_SESSION_STORE=memory` keeps the local behaviour; `db` persists sessions across restarts.

## 4. Environment variables

### Backend (`backend/.env.example` documents local values)

| Variable | Purpose | Production example |
|---|---|---|
| `ZELVORA_ENV` | Enables production defaults | `production` |
| `ZELVORA_API_HOST` | Bind address | `0.0.0.0` |
| `PORT` / `ZELVORA_API_PORT` | HTTP port (`PORT` wins) | `8000` (host-provided) |
| `ZELVORA_STATIC_DIR` | Built React directory | `/app/static` |
| `ZELVORA_DB_HOST/PORT/USER/PASSWORD/NAME` | MySQL connection | TiDB host, `4000`, user, secret, `zelvora_demo_db` |
| `ZELVORA_DB_SSL_CA` | Optional CA file for hosted MySQL | `/app/certs/ca.pem` |
| `ZELVORA_DB_SSL_DISABLED` | Explicitly disable TLS (local only) | unset |
| `ZELVORA_ALLOWED_ORIGINS` | Split-origin allowlist | `https://app.example.com` |
| `ZELVORA_COOKIE_SECURE` | `Secure` cookie flag | `1` |
| `ZELVORA_COOKIE_SAMESITE` | `Lax`, `Strict` or `None` | `Lax` (same-origin) |
| `ZELVORA_COOKIE_DOMAIN` | Optional cookie domain | unset |
| `ZELVORA_SESSION_STORE` | `memory` or `db` | `db` |
| `ZELVORA_AUTO_MIGRATE` | Apply idempotent migrations at startup | `1` |
| `ZELVORA_DEMO_MODE` | Synthetic-only public demo | `1` |
| `ZELVORA_PROVISION_DEMO` | First-deploy demo provisioning | `1` once, then `0` |

### Frontend build

| Variable | Purpose | Production example |
|---|---|---|
| `VITE_BASE` | Router/asset base path | `/` for single origin; repository path for Pages |
| `VITE_API_URL` | API origin for split hosting | unset for single origin |
| `VITE_PROXY_TARGET` | Local dev proxy target | `http://127.0.0.1:8000` |

**Never commit `.env`, database passwords, cookies or hosting tokens.** Only `.env.example` files are tracked.

## 5. Deployment steps (execute only in Phase 8)

1. **Create the database.** Create a TiDB Cloud Starter instance and a database named `zelvora_demo_db`.
   Create a least-privilege user and record host/port/user/password in a password manager.
2. **Create the Render service.** Use the repository's `Dockerfile` (or `render.yaml`). Set the environment
   variables above. Keep `ZELVORA_DEMO_MODE=1` for the public synthetic demo; never point it at private data.
3. **First deploy.** Set `ZELVORA_PROVISION_DEMO=1` for one deploy so `start.py` creates the schema, demo
   marker, fictitious vehicles and two synthetic accounts. Then set it back to `0`.
4. **Verify.** Open `/api/health`, log in with the demo accounts, complete a booking/admin approval, reload,
   and restart the service to confirm DB-backed sessions survive.
5. **Harden.** Confirm HTTPS, `Secure`/`HttpOnly` cookies, security headers, `/api/health`, and that no secret
   appears in logs or the repository.
6. **Hand over.** Record the public URL, demo credentials, limits and rollback steps in `step.md`.

### Rollback

- Redeploy the previous Render image; database migrations are additive and safe to keep.
- Restore the database from the provider's backup/snapshot if a destructive change was made.
- Never run a broad reset against a database containing data you did not create.

## 6. Production checks (run locally before Phase 8)

```powershell
cd backend
python -m compileall -q .
python demo.py phase7
python demo.py regression
python demo.py test
python demo.py phase3
python -m unittest test_demo_safety -v
python demo.py phase5
```

```powershell
cd frontend
npm test
$env:VITE_BASE='/'; npm run build
# production-like local server:
# ZELVORA_STATIC_DIR=../frontend/dist ZELVORA_SESSION_STORE=db ZELVORA_AUTO_MIGRATE=1
# ZELVORA_API_HOST=127.0.0.1 ZELVORA_API_PORT=8011 python backend/start.py
```

The Phase 7 smoke test covered static SPA serving, deep links, CSP/security headers, CORS preflight, cookie
flags, login, DB-session persistence across a restart, logout and session revocation.

## 7. Known limits and risks

- Render's free service sleeps; the first request after idle is slow. This is disclosed, not described as 24/7.
- Python's built-in HTTP server is not a hardened production server. It is acceptable for this academic demo
  behind the hosting proxy, with the limitations documented.
- TiDB is MySQL-compatible but does not enforce cross-shard foreign keys. Application checks and transactions
  remain authoritative; verify integrity during Phase 8.
- Free-tier storage/request quotas, provider policy changes and TLS requirements must be re-checked.
- Manual payment remains offline; no payment gateway is integrated.
- Dependency advisories, owner-password verification and production monitoring remain operator/later work.
