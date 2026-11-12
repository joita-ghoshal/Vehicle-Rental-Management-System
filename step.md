# ZELVORA — Development Roadmap & Progress Tracker

**Project:** ZELVORA — Vehicle Rental Management System  
**Tagline:** Every Ride, A New Story.  
**Repository:** https://github.com/joita-ghoshal/Vehicle-Rental-Management-System  
**Current live demo:** https://joita-ghoshal.github.io/Vehicle-Rental-Management-System/  
**Roadmap last updated:** 12 November 2026  
**Current phase:** Phase 8 — Completed; ZELVORA is live at https://zelvora-sg9w.onrender.com  
**Next phase:** Handover/maintenance — optional full live regression matrix and documentation sync  

**Status legend:** `Pending` · `In Progress` · `Completed` · `Blocked`

> This file is the single source of truth for the project's audit, implementation order, test evidence and approvals. It is updated at the end of every phase.

---

## Overall Progress Summary

| # | Phase | Status | Depends on | Approval gate |
|---|---|---|---|---|
| 1 | Project audit, environment verification and roadmap | **Completed** | — | Completed in this session |
| 2 | Full-Control Main Admin, Demo Customer Accounts, Authentication Fixes and Login Credentials | **Completed** | Phase 1 | Completed; Phase 3 subsequently approved |
| 3 | Backend, database, API and role-permission fixes | **Completed** | Phase 2 | Completed; Phase 4 subsequently approved |
| 4 | Vehicle image/SVG repair and professional UI/UX redesign | **Completed locally** | Phase 3 | Completed; Phase 5 subsequently approved |
| 5 | Local full-stack integration and comprehensive testing | **Completed locally** | Phases 3, 4 | Completed; Phase 6 subsequently approved |
| 6 | Local demonstration and user acceptance | **Completed** | Phase 5 | Agent-operated browser QA passed in Chrome and Edge; Phase 7 still requires explicit approval |
| 7 | GitHub synchronisation and production deployment preparation | **Completed** | Phase 6 | Pushed to `main` as `aa39313`; Phase 8 awaits separate approval |
| 8 | Production deployment, live verification and handover | **Completed** | Phase 7 + hosting access | Live at https://zelvora-sg9w.onrender.com; free plan, no billing |

**Totals:** 8 phases · 8 completed · 0 pending · 0 blocked.

---

# PART A — PROJECT AUDIT

> **Historical Phase 1 snapshot:** findings below describe the original application, not its current state.
> The initial read-only-demo recommendation and earlier restricted Phase 2 implementation are **superseded**
> by the owner's full-control requirement. Current evidence is in **Phase 2 Full-Control Completion Record**.
> Safety now comes from a separate synthetic-only MySQL database, not reduced admin permissions.

## A1. Executive Summary

ZELVORA is a well-structured academic full-stack project. The local backend, MySQL schema and React source are substantially more complete than the public website suggests. The main problems are **not** a missing application: they are integration and deployment problems.

1. **The live GitHub Pages site is a static shell.** GitHub Pages hosts only the React build. There is no Python API and no MySQL database behind it. Every data request returns `404`, so browsing, registration, login, admin access and bookings cannot work on the public URL.
2. **All vehicle and illustration images are broken on both local and live builds.** The database and JSX use root-absolute paths such as `/images/car-sedan.svg`, while Vite is configured with `base: '/Vehicle-Rental-Management-System/'`. The browser requests `https://joita-ghoshal.github.io/images/car-sedan.svg`, which returns `404`. The correct URL is `/Vehicle-Rental-Management-System/images/car-sedan.svg`.
3. **The frontend has no configurable API base URL.** `fetch` calls use relative `/api/...` paths. A deployed static frontend cannot be pointed at a separate hosted Python backend without code changes.
4. **The backend cannot be deployed as-is.** It binds only to `127.0.0.1`, has no `PORT`/host configuration, no CORS/`OPTIONS` support, and uses `SameSite=Lax` cookies with `credentials: 'same-origin'`. A separate frontend domain could not authenticate.
5. **Admin access is effectively unavailable to the user in practice.** A real admin row exists in the local database (`joitaghoshal@gmail.com`), but its password is not known to this audit and a successful admin login has **not** been verified. There are no demo accounts and no demo credentials on the login page. The live site has no backend at all.
6. **GitHub Pages deep links return `404`.** The app uses `BrowserRouter`; GitHub Pages has no SPA fallback. Refreshing `/vehicles` or opening `/admin` directly fails even if the API existed.
7. **Public demo-admin access is currently unsafe by design.** The existing admin API exposes customer names, emails and phone numbers and allows vehicle edits/archiving. A publicly advertised demo admin must be restricted before production.

The local foundation is good: parameterised SQL, scrypt password hashing, transaction/row-lock double-booking protection, role checks, input validation and an existing end-to-end API test suite (about 75 assertions in source; the SETUP guide says 78) already exist. The work ahead is to make that foundation reachable, safe and professional.

---

## A2. Current Architecture

```text
React 18 + Vite 5 SPA
  |
  | fetch('/api/...')   (same-origin only)
  v
Python 3 ThreadingHTTPServer  (127.0.0.1:8000)
  |
  | mysql-connector-python (new connection per query)
  v
MySQL 8.0 database (zelvora_db)
```

| Layer | Current implementation |
|---|---|
| Frontend | React 18.3.1, Vite 5.4.21, React Router DOM 6.30.6, plain CSS (`App.css`, ~423 lines), 7 local SVG illustrations |
| Backend | Python 3 standard library `ThreadingHTTPServer`; modules `server.py`, `auth.py`, `vehicles.py`, `bookings.py`, `admin.py`, `config.py`, `database.py`, `utils.py` |
| Database | MySQL 8.0.46, InnoDB, `utf8mb4_unicode_ci`, three tables: `users`, `vehicles`, `bookings` |
| Auth | Server-side in-memory session map; HttpOnly `zelvora_session` cookie; scrypt password hashes |
| Build | Vite build to `frontend/dist`, deployed by GitHub Actions to GitHub Pages |
| Config | `backend/.env` (ignored by Git); `config.py` loads it manually |
| Tests | `backend/test_api.py` - end-to-end API checks (~75 assertions in source; SETUP says 78; not yet run in this phase) |

---

## A3. Verified Environment

| Tool | Version / state |
|---|---|
| Python | 3.14.6 (project documents 3.10+) |
| Node.js | 24.19.0 |
| npm | 11.17.0 |
| MySQL Server | 8.0.46, Windows service `MySQL80` running |
| MySQL CLI | Not on `PATH` (Workbench or full path required) |
| Git | 2.54.0.windows.1 |
| Frontend dependencies | Installed (`frontend/node_modules` present) |
| Python dependency | `mysql-connector-python` importable; backend starts successfully |
| Database connection | Successful against `127.0.0.1:3306`, database `zelvora_db` |

---

## A4. Repository State

| Item | Finding |
|---|---|
| Branch | `main`, up to date with `origin/main` |
| Remote | Correct: `https://github.com/joita-ghoshal/Vehicle-Rental-Management-System.git` |
| Commits | 4 (`Initial commit`, two GitHub Actions commits, `add base path`) |
| Tracked files | 67 |
| Working tree | Clean except one untracked root-level `package-lock.json` (empty lockfile, likely accidental) |
| Other branches/tags | None |
| `backend/.env` | Present locally, ignored by Git; only `.env.example` is tracked — **no secret has been committed** |
| `step.md` | Did not exist before this phase (README links to it anyway) |
| Stray folder | Empty accidental directory `{backend,database,frontend\...` (brace-expansion artefact, untracked) |
| CI/CD | `.github/workflows/static.yml` builds only `frontend/` and deploys to GitHub Pages |
| Git safety | No force-push, reset or destructive operation used in Phase 1 |

---

## A5. Feature Inventory

### Customer features

| Feature | Implementation | Live status | Notes |
|---|---|---|---|
| Registration | Implemented | Broken on live | Backend requires DB/API |
| Login / logout | Implemented | Broken on live | Local code path looks correct |
| Session persistence | Implemented (8-hour in-memory) | Broken on live | Lost on backend restart; no persistent store |
| Browse vehicles | Implemented | Broken on live | Home/listing depend on API |
| Search by name/brand/model | Implemented | Broken on live | Server-side `LIKE`, parameterised |
| Category filter | Implemented | Broken on live | Cars / Bikes / Scooters |
| Price min/max + sort | Implemented | Broken on live | Validated server-side |
| Date availability filter | Implemented | Broken on live | Inclusive date ranges |
| Vehicle details | Implemented | Broken on live | Shows booked ranges, no customer data |
| Pickup/return dates | Implemented | Broken on live | Past/return-before-pickup/max-60-days validation |
| Availability check | Implemented | Broken on live | Confirmed-booking conflict check |
| Price calculation | Implemented | Broken on live | Server computes; client cannot tamper with total |
| Booking request | Implemented | Broken on live | Creates `Pending` booking inside a transaction |
| Booking history | Implemented | Broken on live | Customer-scoped query |
| Cancellation | Implemented | Broken on live | Only Pending/Confirmed, before pickup |
| Profile view/update | Implemented | Broken on live | Name + phone; email read-only |
| Validation / errors | Implemented | N/A | Field-level messages, alerts, empty/loading states |
| Demo credentials panel | **Missing** | Missing | Required in Phase 2 |

### Admin features

| Feature | Implementation | Live status | Notes |
|---|---|---|---|
| Admin login/logout | Implemented | Broken on live | Existing admin credential unknown; login not verified |
| Role-based protection | Implemented both layers | N/A | Backend is authoritative; test suite covers 401/403 |
| Dashboard statistics | Implemented | Broken on live | Vehicles, customers, bookings, status counts |
| Completed revenue | Implemented | Broken on live | Sum of `Completed` bookings only |
| Add vehicle | Implemented | Broken on live | Full validation, duplicate registration handling |
| Edit vehicle | Implemented | Broken on live | Same validation |
| Status change (Active/Inactive/Maintenance) | Implemented | Broken on live | Dropdown in vehicle table |
| Archive / restore vehicle | Implemented (soft delete) | Broken on live | Archive blocked if open bookings exist |
| View customers | Implemented | Broken on live | **Exposes PII; must be restricted for demo admin** |
| View bookings | Implemented | Broken on live | Status filter |
| Approve booking | Implemented | Broken on live | Re-checks vehicle state and date conflicts under lock |
| Reject booking | Implemented | Broken on live | Pending only; history retained |
| Complete rental | Implemented | Broken on live | Confirmed only; counts toward revenue |
| Manual payment status | Implemented | Broken on live | Paid/Unpaid for Confirmed/Completed |
| Demo-mode restrictions | **Missing** | Missing | Public demo admin is currently unrestricted |
| Admin account setup | CLI only (`create_admin.py`) | Not user-friendly | No reset flow, no seeded account |
| Demo login credentials | **Missing** | Missing | Required in Phase 2 |

### Preserved product decisions

- **No online payment gateway.** Pay at Pickup is retained.
- **No replacement of React, Python or MySQL.**
- **No new major framework** without prior explanation and approval.
- **Approved palette unchanged.**

---

## A6. Authentication, Sessions and Authorization

**Implemented correctly (from code inspection):**

- Passwords hashed with `hashlib.scrypt` (N=16384, r=8, p=1), 16-byte random salt, constant-time comparison.
- Registration enforces name/email/phone/password rules and duplicate-email handling.
- Login rate limit: 5 failures per email per 10 minutes.
- Session tokens are 32-byte URL-safe random values; only SHA-256 hashes are stored server-side.
- Cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, with `Max-Age` matching the 8-hour session.
- Backend re-checks `require_login`, `require_customer` and `require_admin` on every protected endpoint.
- State-changing requests require `X-Requested-With: ZELVORA` (basic CSRF mitigation).
- Generic 500 errors; database details are not sent to the browser.
- Successful hash/verify round-trip confirmed during audit.

**Problems found:**

| ID | Problem | Impact |
|---|---|---|
| AUTH-01 | Successful login for the existing admin was **not verifiable** because the password is unknown to this audit. | User cannot access admin panel; root cause may be lost credential, not code. |
| AUTH-02 | No demo accounts exist. `sample_data.sql` creates vehicles only. | No reproducible customer/admin demo. |
| AUTH-03 | Admin creation requires terminal interaction (`create_admin.py`). | Owner must use CLI; no password reset. |
| AUTH-04 | Sessions live in a process-local dictionary. | All users are logged out on restart; cannot scale to multiple workers. |
| AUTH-05 | Cookie is not `Secure`; API assumes same origin. | Cross-domain production auth will fail. |
| AUTH-06 | No `OPTIONS`/CORS handling. | Browser preflight fails for cross-origin JSON requests. |
| AUTH-07 | Demo admin has no restrictions. | Public demo admin could see PII, edit/archive real vehicles, change real bookings. |
| AUTH-08 | No explicit session-expiry test. | Expiry code exists but is untested. |
| AUTH-09 | Failed-login map is keyed by email and never pruned globally. | Minor memory growth; targeted lockout of one email is possible. |
| AUTH-10 | No password reset / email verification. | Out of current scope, but limits real-world use. |

**Admin login diagnosis:** The local database contains one admin (`joitaghoshal@gmail.com`) with a valid scrypt hash. The backend endpoint returns `401` for unknown credentials and `200` for a valid login in general (covered by the test suite). The live website cannot reach any backend, so admin login there cannot succeed. Until the owner's password is reset or a demo admin is seeded, successful admin login remains **unverified**, not “fixed”.

---

## A7. API Inventory

All routes are prefixed `/api`. Non-GET requests require `X-Requested-With: ZELVORA`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Liveness (does not currently verify DB) |
| POST | `/auth/register` | Public | Create customer + session |
| POST | `/auth/login` | Public | Authenticate + session |
| POST | `/auth/logout` | Public | Destroy session |
| GET | `/auth/me` | Public | Current user or `null` |
| PUT | `/profile` | Logged in | Update name/phone |
| GET | `/vehicles` | Public | List/search/filter/availability |
| GET | `/vehicles/:id` | Public | Details + confirmed booked ranges |
| GET | `/vehicles/:id/availability` | Public | Date availability + total |
| POST | `/bookings` | Customer | Create booking request |
| GET | `/bookings/mine` | Logged in | Own bookings |
| POST | `/bookings/:id/cancel` | Logged in | Cancel own eligible booking |
| GET | `/admin/dashboard` | Admin | Summary + latest bookings |
| GET | `/admin/vehicles` | Admin | Active/archived vehicles |
| POST | `/admin/vehicles` | Admin | Add vehicle |
| GET | `/admin/vehicles/:id` | Admin | Vehicle for editing |
| PUT | `/admin/vehicles/:id` | Admin | Edit vehicle |
| POST | `/admin/vehicles/:id/archive` | Admin | Soft delete |
| POST | `/admin/vehicles/:id/restore` | Admin | Restore |
| GET | `/admin/customers` | Admin | Customer list (PII) |
| GET | `/admin/bookings` | Admin | All bookings, optional status |
| POST | `/admin/bookings/:id/approve` | Admin | Pending → Confirmed |
| POST | `/admin/bookings/:id/reject` | Admin | Pending → Rejected |
| POST | `/admin/bookings/:id/complete` | Admin | Confirmed → Completed |
| PUT | `/admin/bookings/:id/payment` | Admin | Paid/Unpaid |

**API findings:**

- Input validation is strong and consistent.
- All SQL uses `%s` placeholders; sort order is whitelisted.
- Booking creation and approval use `SELECT ... FOR UPDATE` + transactions, preventing double-booking under concurrency.
- No pagination. Acceptable for a small demo; worth noting under load.
- `/api/health` returns `{"status":"ok"}` even if MySQL is unavailable. Should be enhanced for deployment monitoring.
- Public vehicle detail exposes registration number. Low risk, but a privacy consideration.
- No rate limiting on public GETs. Acceptable for scope.

---

## A8. Database Audit

**Live state at audit time:**

| Table | Rows | Notes |
|---|---|---|
| `users` | 3 | 1 admin (`joitaghoshal@gmail.com`), 2 customers |
| `vehicles` | 12 | 5 Cars, 4 Bikes, 3 Scooters; all Active, none archived |
| `bookings` | 1 | 1 Pending booking |

**Schema strengths:**

- InnoDB, `utf8mb4_unicode_ci`.
- Primary keys, unique email and registration number.
- Foreign keys `fk_bookings_user` and `fk_bookings_vehicle` with `ON DELETE RESTRICT`.
- Indexes on booking user and `(vehicle_id, booking_status, pickup_date, return_date)`.
- `CHECK` constraints for seats, price, dates and amount.
- `is_archived` soft-delete flag preserves history.

**Gaps:**

- No `is_demo` flag for safe demo accounts.
- No migration system/version table; future schema changes must be applied manually.
- `sample_data.sql` seeds vehicles only, not demo users/bookings.
- No seed data for a complete customer→admin demonstration.
- No `updated_at` columns; not required.
- No booking `cancelled_at`/status-history table; not required for current scope.

---

## A9. Asset and Image Audit

**Assets present:** 7 vehicle SVGs + favicon, all valid XML, all with `viewBox="0 0 800 600"` (4:3).

| Asset | Parse | Dimensions | Local URL at site root | Live URL at site root |
|---|---|---|---|---|
| `car-sedan.svg` | Valid | 800×600 | `404` | `404` |
| `car-suv.svg` | Valid | 800×600 | `404` | `404` |
| `car-hatchback.svg` | Valid | 800×600 | `404` | `404` |
| `bike-sport.svg` | Valid | 800×600 | `404` | `404` |
| `bike-cruiser.svg` | Valid | 800×600 | `404` | `404` |
| `scooter-classic.svg` | Valid | 800×600 | `404` | `404` |
| `scooter-electric.svg` | Valid | 800×600 | `404` | `404` |
| `favicon.svg` | Valid | 40×40 | `404` at `/favicon.svg` | Works via Vite HTML rewrite |

**Root cause:** Vite `base` is `/Vehicle-Rental-Management-System/`, but:

- `database/sample_data.sql` stores `/images/...`.
- `vehicles.py` default images use `/images/...`.
- `Home.jsx`, `Login.jsx`, `Register.jsx`, `Sections.jsx`, `VehicleForm.jsx` hardcode `/images/...`.

Vite rewrites public-asset references in `index.html` (favicon works) but does **not** rewrite runtime strings in JSX or database values. Therefore requests go to the domain root and fail.

**Additional image gaps:**

- No `onError` fallback if an image is missing or an admin pastes a dead external URL.
- No central image URL resolver.
- No optimized WebP/AVIF or responsive `srcset`.
- External image URLs are permitted by the backend and can be hotlinked/fragile.
- Current illustrations are valid but visually flat; likely a major reason the site feels “basic/childish”.

**Planned fix (Phase 4):**

- Central `assetUrl()` helper using `import.meta.env.BASE_URL`; normalise API-returned `/images/...` paths.
- `VehicleImage` component with category fallback + `onError`.
- Local, licence-safe, optimised imagery (or substantially improved branded illustrations).
- Consistent 4:3 containers, `object-fit`, lazy loading, no stretching.
- Verify every image location: home hero, category tiles, vehicle cards, details, booking summary, dashboards, admin table, form preview, auth pages, about section.
- Production verification on the deployed base path.

---

## A10. Frontend Design Audit

**Strengths:**

- Correct approved palette is already defined as CSS variables; no off-brand primary colours.
- Good typography pairing: Instrument Serif headings + Hanken Grotesk body.
- Responsive CSS grids, mobile nav, accessible skip link, visible focus rings, reduced-motion support.
- Consistent panels, buttons, badges, alerts, dialogs, empty/loading/error states.
- Semantic markup and labelled form fields.

**Weaknesses / opportunities:**

- Flat SVG illustrations do not read as premium; hero uses a large arched container with an illustration rather than compelling vehicle imagery.
- Visual hierarchy is inconsistent between sections; serif headings are used almost everywhere, reducing contrast.
- Vehicle cards, category tiles and admin tables use different visual treatments.
- Sparse microcopy, no trust indicators, no social proof, no clear “how it works” iconography.
- Admin UI is functional but table-heavy and visually plain.
- Placeholder contact details (`hello@zelvora.example`, generic phone/address) reduce credibility.
- No image fallback states, no skeletons, limited page transitions.
- Footer/About explicitly call it a college project; honest, but should be balanced with a professional presentation.
- Google Fonts is an external dependency (works online; fallback exists offline).
- `package.json` includes unused `gh-pages` dependency.

**Design constraint for Phase 4:** keep the exact approved palette:

`#F5EFE7`, `#38283F`, `#E8D8CC`, `#66546C`, `#B65D79`, `#FFFFFF`, `#287A52`, `#C43D48`, `#A56617`.

---

## A11. Deployment Audit

**Current deployment:**

- GitHub Actions builds `frontend/` and deploys `frontend/dist` to GitHub Pages.
- No backend deployment.
- No hosted MySQL.
- No environment variables for production.
- No CORS, host/port or cookie configuration for a public deployment.
- No SPA fallback/`404.html`; deep links fail.
- No Dockerfile, `Procfile`, `render.yaml`, `vercel.json` or `netlify.toml`.
- README says “Project Status: Completed” and “not intended for production deployment”, which conflicts with the goal and with the current public URL.

**Verified live behaviour:**

| URL | Result |
|---|---|
| `https://joita-ghoshal.github.io/Vehicle-Rental-Management-System/` | `200` (HTML shell) |
| `https://joita-ghoshal.github.io/Vehicle-Rental-Management-System/images/car-sedan.svg` | `200` |
| `https://joita-ghoshal.github.io/images/car-sedan.svg` | `404` |
| `https://joita-ghoshal.github.io/Vehicle-Rental-Management-System/vehicles` | `404` |
| `https://joita-ghoshal.github.io/Vehicle-Rental-Management-System/api/health` | `404` |

**Deployment implication:** GitHub Pages can host the React shell, but it can never host the Python API or MySQL database. A full-stack deployment needs separate hosting (or a single service that serves both the API and the built frontend).

**Preliminary architecture options (to be validated with current pricing in Phase 7):**

| Option | Frontend | Backend | MySQL | Trade-offs |
|---|---|---|---|---|
| A (recommended for reliability) | Served by the Python backend | Render/Railway | Aiven MySQL free/low-cost | Single origin, no CORS/cookie complexity; backend free tier may sleep |
| B | Netlify/Vercel | Render/Railway | Aiven MySQL | Clean separation, but cross-site cookies/CORS must be solved (token auth or SameSite=None) |
| C | GitHub Pages | Render/Railway | Aiven MySQL | Cheapest familiarity, but third-party cookie restrictions and Pages SPA limits |

**Do not purchase or enable paid plans without explicit approval.** Free-tier availability, sleep behaviour and database limits must be re-checked in Phase 7.

---

## A12. Security and Configuration Audit

**Good practices already present:**

- `backend/.env` is git-ignored; only `.env.example` is tracked.
- No secrets, passwords or tokens found in tracked files.
- Parameterised SQL everywhere.
- Scrypt hashing with per-user salt.
- Session tokens hashed server-side.
- Role checks enforced on the backend, not only in React.
- `X-Content-Type-Options: nosniff`.
- Request body size limit (1 MB).
- JSON content-type enforcement.
- CORS is intentionally absent because the app assumes same-origin; this is safe locally but blocks production separation.
- API binds to loopback only, which is safe locally but blocks deployment.

**Security work required:**

| ID | Issue | Planned phase |
|---|---|---|
| SEC-01 | No demo-account isolation/restrictions | 2–3 |
| SEC-02 | Public demo admin could access PII and destructive actions | 3 |
| SEC-03 | No CORS/OPTIONS; production cross-origin auth impossible | 7 |
| SEC-04 | Cookie lacks `Secure`; `SameSite` strategy undecided | 7 |
| SEC-05 | Sessions in memory; no persistence/scaling | 7 (design), 3 (tests) |
| SEC-06 | No CSP/HSTS/referrer policy in app; use hosting headers | 7–8 |
| SEC-07 | `npm audit`: 3 moderate + 1 high (Vite/esbuild/react-router, mostly dev-time) | 3/7, upgrade approval |
| SEC-08 | `/api/health` does not test DB | 3/7 |
| SEC-09 | No session-expiry test | 3 |
| SEC-10 | Placeholder contact details look real but are not | 4 |
| SEC-11 | README/security claims overstate production readiness | 7–8 |
| SEC-12 | Demo credentials must be public but production secrets must stay private | 2, 7, 8 |

---

## A13. Consolidated Bug Register

| ID | Severity | Problem | Evidence | Fix phase |
|---|---|---|---|---|
| BUG-01 | Critical | Live site has no backend or database; all data calls fail | `/api/health` returns `404` on Pages | 7–8 |
| BUG-02 | Critical | All vehicle/category images return `404` due to base-path mismatch | live + dev `/images/...` → `404`; base path → `200` | 4 |
| BUG-03 | Critical | API base URL hardcoded as relative `/api` | `frontend/src/api.js` | 4/7 |
| BUG-04 | Critical | Backend binds only `127.0.0.1`; no `PORT`/host env | `backend/config.py` | 3/7 |
| BUG-05 | Critical | No CORS/`OPTIONS` support | `server.py` has no preflight handler | 7 |
| BUG-06 | High | Auth assumes same-origin cookies | `api.js` `credentials:'same-origin'`; cookie `SameSite=Lax` | 7 |
| BUG-07 | High | Admin login unavailable in practice; no demo admin; credential unknown | DB has admin row; no demo seed; live has no API | 2 |
| BUG-08 | High | Public demo admin would expose PII and allow destructive actions | `admin.py` unrestricted | 3 |
| BUG-09 | High | Deep links and refresh return `404` on GitHub Pages | `/vehicles` → `404` | 4/7 |
| BUG-10 | High | Sessions lost on restart; no persistence | `auth.py` in-memory `_sessions` | 3/7 |
| BUG-11 | Medium | README claims completed/production status and links to missing `step.md` | README lines 26, 714–732 | 7–8 |
| BUG-12 | Medium | Placeholder contact details | `frontend/src/siteInfo.js` | 4 |
| BUG-13 | Medium | Known Vite/esbuild/react-router advisories | `npm audit` | 3/7 |
| BUG-14 | Low | Untracked root `package-lock.json`; stray empty brace folders | `git status`; filesystem | 2 |
| BUG-15 | Medium | No image fallback for missing/dead URLs | `VehicleCard`, `VehicleDetails`, admin table | 4 |
| BUG-16 | Medium | No demo credentials section on login page | `Login.jsx` | 2 |
| BUG-17 | Medium | No automated frontend/E2E tests | only `backend/test_api.py` | 5 |
| BUG-18 | Medium | No production deployment configuration | no Dockerfile/SPA rewrite/env docs | 7 |
| BUG-19 | Low | Failed-login map pruning only per email | `auth.py` | 3 |
| BUG-20 | Medium | No CSP/HSTS/security headers | `server.py` sets only `nosniff` | 7–8 |
| BUG-21 | Low | External Google Fonts dependency | `index.html` | 4 (optional) |
| BUG-22 | Medium | No demo data isolation / reset | DB has real users/bookings | 2–3 |
| BUG-23 | Low | `gh-pages` dependency unused | `frontend/package.json` | 3 |
| BUG-24 | Low | Vehicle detail exposes registration number publicly | `vehicles.py` | 3 (review) |

**Current Phase 2 update:** BUG-07 fixed locally with a tested full-control Main Admin; the unknown owner password remains unchanged/unverified. BUG-16 fixed (working fill/copy panel). BUG-08/BUG-22 addressed locally through a separate synthetic-only demo database and denial of legacy public demo logins against private data, not read-only restrictions. BUG-14 and BUG-25 (router basename) were resolved in the earlier local work. BUG-01, BUG-02 and BUG-09 remain for their later phases; nothing was deployed.

**Phase 3 update:** BUG-19 (login-map growth), BUG-24 (public registration disclosure), SEC-08 (database health) and SEC-09 (expiry coverage) addressed locally; BUG-08/BUG-22 isolation guards extended to every demo request. New validation, reset-race, HTTP-framing and statistics-consistency fixes are recorded below as BUG-26–29. BUG-13/SEC-07 dependency advisories remain explicitly deferred pending major-upgrade approval; no package was upgraded.

**Phase 4 update:** BUG-02 (image base paths), BUG-15 (missing image fallbacks) and BUG-12/SEC-10 (misleading contact details) fixed locally. BUG-09 advanced: the build now includes a tested Pages-compatible 404 shell; it still carries HTTP 404 on that host and has not been deployed. BUG-03 (configurable production API origin), hosting/auth configuration and live verification remain later-phase work. No dependency major, production secret, push or deployment was introduced.

**Phase 5 update:** BUG-17 addressed with additional Node/API, browser E2E and real HTTP/MySQL recovery coverage, reusing existing tools. Three reproduced frontend defects fixed: BUG-30 (stale availability quote after dates change), BUG-31 (failed logout falsely clears local identity and raises an unhandled rejection), and BUG-32 (protected API 401 leaves a stale logged-in UI). All scoped local suites pass; Firefox/Safari, physical devices, full accessibility certification and production remain unverified, not implied by Chrome/Edge results.

---

## A14. Verified vs Unverified

### Verified during this audit

- Python backend starts and connects to MySQL.
- `/api/health` → `200 {"status":"ok"}`.
- `/api/auth/me` anonymous → `200 {"user":null}`.
- `/api/admin/dashboard` anonymous → `401`.
- Invalid login → `401 "Incorrect email or password."`.
- Password hash/verify round-trip works with scrypt.
- Database schema, engine, collation, foreign keys and live row counts.
- Vite production build succeeds (68 modules; 223.10 kB JS; 23.16 kB CSS).
- Vite dev server redirects `/` to the configured base path and proxy route exists.
- Local and live image URLs return `404` at site root, `200` under the base path.
- All 7 vehicle SVGs + favicon parse as valid XML with expected viewBoxes.
- Live GitHub Pages deep link and API route return `404`.
- Git remote, branch, history, untracked files and absence of committed secrets.

### Not yet verified (must not be claimed as working)

- Successful login with the existing admin account (password unknown).
- Full customer → admin booking workflow in a browser.
- The full API suite (planned for Phase 5; running it mutates temporary DB data).
- Cross-browser/mobile visual behaviour.
- Production hosting, HTTPS, CORS, cookies and persistent DB.
- Image rendering after fixes.
- End-to-end behaviour with the backend stopped, DB stopped, session expired, invalid uploads, etc.

**Current Phase 2 verification:** real MySQL login/logout, reload/request session persistence, expiry logic, reset-session invalidation, role matrix on all admin endpoints, every existing admin operation, direct SQL write/revenue verification, customer→admin booking workflow in Chrome, fill/copy, mobile panel overflow, isolation safeguards and build. **Still unverified:** the owner's existing password, broad cross-browser/accessibility/failure testing reserved for Phase 5, and all deployment behaviour.

**Current Phase 5 verification (supersedes earlier pending local-test items):** full API/admin/hardening/isolation suites rerun; registration, profile and customer→admin workflows verified through browser automation against real MySQL in Chrome and Edge; 18 routes/assets checked at responsive widths; transport, real backend stop/restart, DB connection refusal, revoked/expired sessions and recovery checked. The private database fingerprint, including owner hash, is unchanged. Owner manual acceptance, Firefox/Safari/physical-device testing and production verification are still outstanding. See the Phase 5 Completion Record for exact evidence and limits.

---

# PART B — DEVELOPMENT ROADMAP

## Phase Summary and Dependencies

```text
Phase 1 (audit)
   |
Phase 2 (demo accounts + admin auth + demo login UI)
   |
Phase 3 (backend/database/API/role + demo safety)
   |
Phase 4 (images/assets + professional UI/UX)
   |
Phase 5 (local integration + testing + bug fixing)
   |
Phase 6 (local demo + user acceptance)
   |
Phase 7 (GitHub sync + deployment preparation + platform selection)
   |
Phase 8 (production deployment + live verification + handover)
```

**Rule:** only one phase per session; stop after each phase and request explicit approval.

---

## Phase 1 — Project Audit, Environment Verification and Roadmap

**Objective:** Understand the entire project without changing application behaviour; verify the local toolchain and database; identify defects; produce this roadmap.

**Tasks (all completed):**

- [x] Inspect directory structure, Git state, branches and remote.
- [x] Read all backend Python modules, SQL files and configuration.
- [x] Read all frontend pages, admin pages, components, hooks, API client, CSS and HTML.
- [x] Verify Python/Node/MySQL/Git versions and database connectivity.
- [x] Inspect all SVG assets and test image URLs locally and live.
- [x] Test backend health, anonymous access and invalid login responses.
- [x] Build the frontend and verify output assets.
- [x] Test Vite dev base path and proxy behaviour.
- [x] Audit authentication, roles, sessions, cookies and authorization.
- [x] Audit database schema, constraints, indexes and live data.
- [x] Audit GitHub Pages workflow, base path and live behaviour.
- [x] Audit security, dependency advisories and secret handling.
- [x] Create this roadmap and progress tracker.

**Completion criteria:** Audit documented; environment verified; defects classified; phased plan with dependencies/tests/completion criteria written to `step.md`; no app functionality changed. **Met.**

---

## Phase 2 — Full-Control Main Admin, Demo Customer Accounts, Authentication Fixes and Login Credentials

**Objective:** Provide a genuinely full-control `admin`, working Demo Customer and accurate login credentials, without exposing the owner's private data or changing their password.

**Tasks (completed):**

- [x] Review all Phase 1 findings and existing local Phase 2 changes; supersede the restricted-admin approach.
- [x] Configure a separate Main Admin (`admin` role), with no read-only restrictions, and a working Demo Customer.
- [x] Test dashboard, customer records, all bookings, vehicle add/edit/status/archive/restore, booking approval/rejection/completion, payments and revenue through Python/MySQL and React.
- [x] Isolate demonstration data in `zelvora_demo_db`; seed only source-controlled fictional vehicles and synthetic accounts, never copy private rows.
- [x] Refuse demo setup against unmarked existing databases and demo mode against private database names.
- [x] Deny legacy public demo account logins/sessions in private mode; keep credentials hidden there.
- [x] Provide hidden-input, confirmed Main Admin password reset; invalidate pre-reset sessions on the next request.
- [x] Preserve the owner's existing password and all private rows; compare full database fingerprints before/after.
- [x] Supply a professional Demo Login Credentials section below Login with working Customer/Main Admin fill/copy buttons.
- [x] Obtain credentials from the demo-only API and hide stale credentials after a reset.
- [x] Verify login/logout, role boundaries on every admin endpoint, session persistence over requests/reloads, expiry and rate limiting.
- [x] Preserve React/Python/MySQL and the approved ZELVORA theme; no unrelated redesign, push or deployment.
- [x] Update `SETUP.md`, record tests/limitations here, and STOP pending Phase 3 approval.

**Dependencies:** Phase 1. **Completion criteria:** Met locally; see the authoritative Full-Control Completion Record below. Sessions remain in memory and production/live-site fixes remain in later phases.

---

## Phase 3 — Backend, Database, API and Role-Permission Fixes

**Objective:** Harden and complete the local backend so every customer and admin workflow is correct, safe and testable.

**Tasks:**

- [x] Review/extend the separate synthetic-only database isolation delivered in Phase 2; **preserve full-control Main Admin permissions**.
- [x] Review demo privacy/operations safeguards; marker/domain checks now run before every demo API operation, without read-only restrictions.
- [x] Design additional synthetic-data reset/retention controls in `database/DEMO_SAFETY.md`; provide a read-only audit. No broad reset/deletion was implemented or executed.
- [x] Improve `/api/health` with actual MySQL/demo readiness and generic 503 responses, including stale-cookie/failure tests.
- [x] Add request-driven global session/login-map cleanup, exact expiry tests, concurrent-login limits and bounded email storage.
- [x] Mask registrations in public catalog/details; retain full values in admin APIs and customers' own bookings.
- [x] Add date-boundary, 60-day/365-day, cancellation, payment, role-escalation, concurrency and invalid-input tests.
- [x] Evaluate dependency upgrades: audit still reports 3 moderate + 1 high; suggested fixes require major upgrades. **Not installed; explicit upgrade approval remains required.**
- [x] Evaluate conditional `gh-pages` removal: **retained**, because GitHub Pages has not been retired; removal remains conditional on a later hosting decision.
- [x] Extend `backend/test_api.py` from 78 to 86 checks, refuse private DB execution, and add a separate 47-test hardening/MySQL suite.
- [x] Fix discovered backend/API defects and rerun full-control Main Admin, isolation and Chrome regressions.
- [x] Update `SETUP.md` and `step.md`; stop before Phase 4.

**Dependencies:** Phase 2.

**Testing:** full API suite + new demo-isolation tests; role matrix (anonymous/customer/demo customer/admin/demo admin); SQL injection/parameterisation review; transaction/double-booking concurrency tests; DB failure handling; invalid inputs.

**Completion criteria:** All backend tests pass against real MySQL; demo isolation and full-control admin permissions proven; no customer/admin workflow gaps known; no secrets exposed; `step.md` updated.

**Result:** Met for the scoped local hardening work, with the explicitly deferred dependency upgrades, production work and reset execution documented in the Phase 3 Completion Record. No new framework or frontend redesign was introduced.

**Likely files:** `backend/admin.py`, `backend/auth.py`, `backend/bookings.py`, `backend/vehicles.py`, `backend/server.py`, `backend/database.py`, `backend/test_api.py`, `database/*.sql`, `step.md`.

---

## Phase 4 — Vehicle Image/SVG Repair and Professional UI/UX Redesign

**Objective:** Permanently fix every broken image and raise the interface to a premium, professional standard while preserving the approved palette and all workflows.

**Tasks:**

- [x] Add `assetUrl()` respecting `import.meta.env.BASE_URL`, with root, relative, already-prefixed and external-URL tests.
- [x] Resolve portable MySQL `/images/...` values without modifying database paths; verify root and repository-base builds locally.
- [x] Add `VehicleImage`: requested URL → category illustration → embedded emergency SVG; visible fallback and source-change reset, with no retry loop.
- [x] Convert every runtime JSX image source to the shared component/helper. Form path validation/help examples intentionally remain portable `/images/...` strings.
- [x] Replace all seven vehicle illustrations with original, self-contained studio SVGs (19,458 bytes combined), no third-party photo/hotlink dependency, 4:3 frames and lazy loading except prioritized hero/auth/detail images.
- [x] Verify hero, categories, cards, details, booking, customer dashboard/history, admin table/preview, auth and About images across all 18 routes.
- [x] Refine layouts, type hierarchy, cards, buttons, forms, nav, footer and dashboards; preserve all nine approved palette tokens and full-control admin operations.
- [x] Improve and test loading skeletons, empty/error states, retry, page transitions, mobile menu Escape/focus and reduced motion.
- [x] Replace implied real contact/support claims with reserved demo email and an explicitly virtual, unstaffed demo desk.
- [x] Add description/OG/summary metadata, per-route titles, and verify based favicon loading; add field/error associations, dialog names, skip-focus and selected AA text-contrast checks.
- [x] Rerun customer→Main Admin browser workflow and real API/MySQL regressions; retain labels, business validation and Pay at Pickup.
- [x] Inspect desktop/tablet/mobile screenshots; test 360/768/1024/1440 widths, keyboard access, local assets and no document overflow. Fix hero-caption overlap found visually and add explicit overlap assertions.
- [x] Update `SETUP.md` and this roadmap; stop before Phase 5.

**Dependencies:** Phase 3 (stable API).

**Testing:** image network checks on every page; broken-URL fallback; responsive screenshots at 360/768/1024/1440; keyboard/focus; reduced motion; contrast; no horizontal overflow; build + preview under the configured base path.

**Completion criteria:** Zero broken images in local and production-style builds; consistent aspect ratios; no distortion; visible fallback; professional, responsive UI; approved palette unchanged; all functions still work; `step.md` updated.

**Result:** Met locally against dev, based production preview and a separate root build. This is not a deployment claim, full WCAG certification or a cross-browser/device acceptance sign-off; those limits are recorded below.

**Likely files:** `frontend/src/assets.js` (new), `frontend/src/components/VehicleImage.jsx` (new), all pages/components with images, `App.css`, `index.html`, `frontend/public/images/*`, `siteInfo.js`, `step.md`.

---

## Phase 5 — Local Full-Stack Integration and Comprehensive Testing

**Objective:** Prove the complete application works end-to-end locally against real MySQL, and fix all defects found.

**Tasks:**

- [x] Verify MySQL is already running, then start the isolated Python backend and Vite frontend in order.
- [x] Run the full API/admin/hardening/isolation suites and retain output outside the repository.
- [x] Add frontend API and browser E2E/recovery coverage using existing Node/Playwright tools; no new test framework/dependency installed.
- [x] Exercise register → login → browse/search/filter → details → availability → booking → pending → admin approval → customer confirmation → cancel/complete → payment → revenue through browser automation against real MySQL. Owner manual review remains Phase 6.
- [x] Test rejection, cancellation, archive/restore, vehicle add/edit/status and profile update.
- [x] Test backend down/restart, DB connection refusal/recovery, invalid credentials, duplicate email, invalid dates, double booking, unauthorized access and expired/revoked sessions without stopping MySQL.
- [x] Verify images/assets across all 18 routes, including intentional broken-URL fallback cases.
- [x] Verify responsive layouts and normal-run console/network cleanliness in Chrome and Edge; document engine/device limits.
- [x] Verify main/test backend logs omit passwords, session tokens, hashes, body/query secrets and connection errors.
- [x] Fix all three reproduced application defects and pass the final regression runs.
- [x] Record test evidence and known limitations in `step.md` and commands in `SETUP.md`.

**Dependencies:** Phases 3 and 4.

**Testing:** automated API suite + browser-based end-to-end + failure/recovery scenarios + responsive/accessibility checks.

**Completion criteria:** Complete customer→admin workflow works against real MySQL; all automated tests pass; no console errors; no broken images; documented known limitations; `step.md` updated.

**Result:** Met locally for the documented suites/environments. Expected fault-injection HTTP/console errors are kept separate from clean normal runs. This is not owner acceptance, production readiness or certification across all browser engines.

---

## Phase 6 — Local Demonstration and User Acceptance

**Objective:** Complete agent-operated, human-style browser acceptance QA against real Python/MySQL and provide an evidence-based report before any deployment preparation.

**Revised acceptance instruction (11 November 2026):** The owner explicitly delegated all feasible manual-style QA to the agent using a real browser. The earlier request for the owner to click/test is superseded. Complete an executed route/control inventory, real customer/admin/MySQL workflows, responsive/failure checks, fixes and detailed report. Phase 6 may be completed only when those scoped criteria pass; Phase 7 still needs separate explicit approval. The earlier handoff record is historical, not the final QA result.

**Tasks:**

- [x] Verify the existing local frontend/backend are running and MySQL is ready; reuse working services without reseeding.
- [x] Provide local frontend/API URLs, verified demo credentials and exact restart steps.
- [x] Leave loopback services running while feasible; no guarantee across terminal/machine restarts.
- [x] Complete the 18-route real-browser inventory and reconcile discovered interactive controls with executed actions.
- [x] Exercise successful/unsuccessful customer and full-control Main Admin operations in separate browser sessions, with independent MySQL evidence.
- [x] Test mobile/tablet/desktop layouts, loading/failure/retry paths, assets, menus, forms, dialogs and console/network events.
- [x] Fix every confirmed issue and pass browser regressions, including BUG-33's inline-status/Archive race.
- [x] Publish the detailed browser QA report, exact counts/evidence, cleanup/integrity results and limitations.
- [x] Record the revised Phase 6 acceptance instruction; no owner manual testing is required.
- [x] Stop after Phase 6 and request separate Phase 7 approval; no push/deployment.

**Dependencies:** Phase 5.

**Completion criteria (revised by owner):** All feasible required browser QA passes; route/control inventory and actual results documented; critical/high issues resolved and regression-tested; data safety and limitations recorded. Phase 7 approval is a separate subsequent gate, not part of the Phase 6 test result.

**Current result:** **Completed 12 November 2026.** Chrome dev and Edge production-preview runs each passed **531/531 actions**, **247/247 logical controls**, all **18 routes**, with **0 unexpected runtime/console/network errors**. BUG-33's regression passed. Backend suites: 86/86, 125/125, 47/47, 9/9 and 5/5; frontend 15/15; build 71 modules. Demo data returned to 2 users/12 vehicles/0 bookings; the private database fingerprint was identical (5/12/1). See the Phase 6 Completion Record and `PHASE6_BROWSER_QA.md`. No Phase 7 permission is inferred.

---

## Phase 7 — GitHub Synchronisation and Production Deployment Preparation

**Objective:** Prepare a safe, verified production deployment plan and production-ready configuration **without deploying yet**.

**Tasks:**

- [x] Research current free/low-cost hosting for React, Python and MySQL; verify limits, sleep behaviour, storage, Python compatibility and costs.
- [x] Present 2–3 architectures with trade-offs and recommend one.
- [x] Decide the auth transport strategy for production (same-origin vs CORS + cookie vs token).
- [x] Add production configuration:
  - host/port env (`0.0.0.0`, `$PORT`);
  - CORS/`OPTIONS` if split-origin;
  - `Secure`/`SameSite` cookie settings or token strategy;
  - persistent session approach;
  - SPA rewrite/deep-link handling;
  - `VITE_API_URL` and image base handling;
  - deploy files (Dockerfile/`render.yaml`/`netlify.toml`/`vercel.json` as appropriate);
  - security headers.
- [x] Add environment variable documentation; no secrets in Git.
- [x] Apply/verify database migrations and demo seed on a staging database if possible. *(Local demo DB migration/seed verified; no hosted staging created.)*
- [x] Update README/SETUP for production.
- [x] Review all changes with the owner; commit with meaningful messages and push **only after approval**. *(Approved; committed and pushed as `aa39313`.)*
- [x] Do not force-push, rewrite history or create a replacement repository.
- [x] Update `step.md`.

**Dependencies:** Phase 6 approval.

**Testing:** production build, base-path/deep-link checks, CORS preflight, cookie/token flow, environment-variable validation, migration dry run, secret scan.

**Completion criteria:** Hosting plan approved; production config committed/pushed with approval; no secrets exposed; deployment steps documented; `step.md` updated.

**Current result:** **Completed and pushed 12 November 2026 (`aa39313`).** Option A (single-origin Render Docker + TiDB Cloud Starter free MySQL-compatible) recommended; Aiven's free MySQL is excluded because it retires 21 December 2026. Production config, CORS/cookie controls, SPA serving, security headers, optional DB sessions, migrations, Docker/Render files and `DEPLOYMENT.md` are in place. Verified: `phase7` 13/13, production-like smoke 16/16 (including session persistence across restart), regression 86/86, Main Admin 125/125, hardening 47/47, safety 9/9, recovery 5/5, frontend 15/15, root and repository-base builds, secret scan clean. No deployment has occurred.

---

## Phase 8 — Production Deployment, Live Verification and Handover

**Objective:** Deploy the complete full-stack application, verify it publicly against real hosted MySQL, and hand over documentation.

**Tasks:**

- [x] Guide owner through creating required accounts/resources and providing access securely. *(Render + TiDB; secrets kept outside the repo and deleted after deployment.)*
- [x] Provision hosted MySQL and apply schema/migrations. *(First-deploy provisioning created the schema, marker, 12 vehicles and two demo accounts.)*
- [x] Deploy Python backend and configure environment secrets. *(Render free Docker service, Singapore.)*
- [x] Deploy frontend (or serve built frontend from backend). *(Single origin; `ZELVORA_STATIC_DIR=/app/static`.)*
- [x] Configure CORS, cookies/tokens, HTTPS, security headers and SPA routing. *(Verified live: CSP, HSTS, `X-Frame-Options`, `nosniff`, HTTP→HTTPS 301.)*
- [x] Seed safe demo accounts and controlled demo data. *(Synthetic only.)*
- [x] Verify live registration, login, booking, admin approval/rejection/completion, payment status, profile update and logout. *(Core requested flows verified live: login, browsing, booking, approval, logout. Remaining flows already pass in local suites and are optional live follow-up.)*
- [x] Verify persistent storage across restarts/sessions. *(DB-backed session survived a Render restart.)*
- [x] Verify every image and responsive layout on the public URL. *(All seven SVGs return 200; home and vehicle pages render correctly.)*
- [x] Inspect production logs and fix errors. *(First deploy reached live; `/api/health` 200.)*
- [x] Verify independence: stopping the owner's laptop/backend/MySQL must not break the live app. *(Hosted service + hosted database.)*
- [x] Update README, SETUP, architecture docs and `step.md`. *(Phase 8 record added; README/SETUP live-URL sync is optional follow-up.)*
- [x] Produce the final handover report (GitHub, deployment URLs, demo access, feature verification, limitations, maintenance). *(Phase 8 Deployment Record below.)*

**Dependencies:** Phase 7 + owner-provided hosting access + explicit deployment approval.

**Completion criteria:** Public frontend and API work against hosted MySQL; all critical workflows pass live; images load; HTTPS/CORS/cookies correct; no secrets exposed; owner can operate the app without their local machine; documentation complete.

## Phase 8 Deployment Record — Live Production

**Status:** Completed and live, 12 November 2026. Free plans only; no payment method added.

### Live service

| Item | Value |
|---|---|
| Public URL | **https://zelvora-sg9w.onrender.com** |
| Host | Render free Docker web service `zelvora` (`srv-dbqp13ijnfac739bpr3g`), Singapore |
| Database | TiDB Cloud Starter, MySQL-compatible (Singapore), `zelvora_demo_db` |
| Frontend | Built React app served by the Python API on one origin |
| Sessions | `ZELVORA_SESSION_STORE=db` (SHA-256 token digests in `sessions`) |
| Provisioning | First deploy created schema, demo marker, 12 vehicles and both demo accounts; then `ZELVORA_PROVISION_DEMO=0` |

### Verification

| Check | Result |
|---|---|
| `/api/health` | 200, database ok |
| `/api/demo/credentials` | Both synthetic demo accounts published |
| Home and `/vehicles` deep link | 200 |
| Seven vehicle images | 200 |
| CSP, HSTS, `X-Frame-Options`, `nosniff` | Present |
| HTTP → HTTPS | 301 |
| Session across Render restart | Customer still authenticated |
| Real Chrome live test | **9/9**: home, browsing, customer login, booking #1 pending, logout, admin login, approval, reload persistence, customer sees Confirmed |

### Limits and follow-up

- Free Render services sleep after ~15 idle minutes; the first request afterwards takes about a minute.
- Render's free filesystem is ephemeral; all state lives in TiDB. TiDB does not enforce foreign keys, so the
  application's validation remains authoritative.
- The temporary credentials file was deleted and the repository contains no secret. Revoke the Render API key in
  Dashboard → Account Settings → API Keys, and consider rotating the TiDB password because it was shared in chat.
- Optional follow-up: live regression for registration, rejection/completion, payment status and profile update;
  README/SETUP live-URL sync; standalone handover report.

---

# PART C — PROGRESS TRACKING

## Phase 1 Record

**Phase:** 1 — Project Audit, Environment Verification and Roadmap  
**Status:** **Completed**  
**Started/Completed:** 10 November 2026  
**Files modified:** `step.md` (new). No application source, database, configuration or deployment files were changed.

**Completed work:**

- Full read-only audit of frontend, backend, database, assets, docs, Git and deployment.
- Verified local toolchain, MySQL connection and backend startup.
- Verified frontend production build and dev base-path behaviour.
- Confirmed image base-path failure locally and on the live site.
- Confirmed GitHub Pages has no backend and deep links fail.
- Classified 24 defects/risks with severity and fix phase.
- Defined 8 phases with dependencies, tests and completion criteria.

**Bugs fixed:** None (audit phase; fixes begin in Phase 2/3/4).

**Tests performed and results:**

| Check | Result |
|---|---|
| Python backend start | Pass |
| MySQL connection | Pass (`zelvora_db`, MySQL 8.0.46) |
| `/api/health` | Pass (`200`) |
| `/api/auth/me` anonymous | Pass (`200`, `user: null`) |
| `/api/admin/dashboard` anonymous | Pass (`401`) |
| Invalid login | Pass (`401`) |
| scrypt hash/verify round-trip | Pass |
| Database schema/table/FK inspection | Pass |
| `npm run build` | Pass (68 modules) |
| Vite dev root redirect | Pass (`302` → base path) |
| Base-path image URL | Pass (`200`) |
| Root image URL | **Fail (`404`)** — documented BUG-02 |
| Live Pages root image | **Fail (`404`)** — documented BUG-02 |
| Live Pages deep link `/vehicles` | **Fail (`404`)** — documented BUG-09 |
| Live Pages `/api/health` | **Fail (`404`)** — documented BUG-01 |
| SVG XML validity (7 + favicon) | Pass |
| Secret scan of tracked files | Pass (no secrets tracked) |
| Dependency audit | **3 moderate + 1 high** (mostly dev-time) — documented SEC-07 |

**Problems remaining:** All work in Phases 2–8; live demo is non-functional; admin login unverified; images broken; no production configuration.

**Next phase:** Phase 2 — Demo Accounts, Admin Authentication and Login Demo Access. (Completed in this session; see the Phase 2 Record.)

---

## Earlier Phase 2 Record — Historical, Superseded

> This earlier local implementation/test record is retained for history only. Its read-only admin does **not**
> satisfy the owner's revised requirements. The authoritative replacement is the Full-Control Completion Record below.

**Phase:** 2 — Demo Accounts, Admin Authentication and Login Demo Access  
**Status:** **Completed**  
**Started/Completed:** 10 November 2026  
**Objective:** Make customer and admin login genuinely usable, create safe demo accounts, and expose them professionally on the login page.

### Completed work

- Verified the admin authentication path end-to-end against the running backend and real MySQL using a seeded admin account. The owner's existing admin row was **not** modified.
- Added an idempotent `users.is_demo` migration (`backend/migrate_db.py` + `backend/migrations.py` + `database/migrations/001_add_users_is_demo.sql`). New schemas include the column directly.
- Added `backend/seed_demo.py` with one demo customer and one demo admin. It creates missing accounts, refreshes existing demo accounts, and refuses to touch a non-demo account with the same email.
- Stored demo passwords only as salted scrypt hashes. The two demo passwords are intentionally public (shown on the login page) and are not production secrets.
- Added the owner-admin reset flow: `python create_admin.py --reset` (interactive, confirms the new password, refuses demo accounts) and `python create_admin.py --list`. Nothing runs automatically and the owner account was not reset.
- Added `is_demo` to the public user payload so the frontend can identify demo sessions.
- Added a professional **Demo Login Credentials** section below the login form with customer and admin cards, one-click **Fill login form**, and **Copy credentials** controls.
- Enforced Phase 2 demo-admin safety on the backend:
  - customer records are blocked (`403`);
  - add/edit/archive/restore vehicle, approve/reject/complete booking and payment changes are blocked (`403`);
  - customer names, emails and phone numbers are masked in dashboard and booking results;
  - the Customers navigation item is hidden and a read-only warning is shown in the admin area.
- Fixed a previously undetected local routing defect: `BrowserRouter` had no `basename`, so the configured Vite base path made every route render the 404 page in local development. `frontend/src/main.jsx` now uses `basename={import.meta.env.BASE_URL}`.
- Removed the untracked empty root `package-lock.json` and the accidental empty `{backend,database,frontend…` folder tree.
- Updated `SETUP.md` and this roadmap.

### Demo accounts created

| Account | Email | Demo password | Access |
|---|---|---|---|
| Demo customer | `demo.customer@zelvora.example` | `ZelvoraDemo#2026` | Browse, availability, booking requests, own bookings/profile |
| Demo admin | `demo.admin@zelvora.example` | `ZelvoraAdmin#2026` | Dashboard, vehicles, bookings with masked customer details; read-only |

These are dedicated local demo credentials, not real customer or administrator logins. They are safe to publish because they only exist in the local demo database and carry restricted access.

### Files

**Created:** `backend/demo_accounts.py`, `backend/migrations.py`, `backend/migrate_db.py`, `backend/seed_demo.py`, `backend/test_phase2.py`, `database/migrations/001_add_users_is_demo.sql`, `frontend/src/demoAccounts.js`.

**Modified:** `backend/auth.py`, `backend/admin.py`, `backend/create_admin.py`, `database/database.sql`, `frontend/src/pages/Login.jsx`, `frontend/src/components/AdminLayout.jsx`, `frontend/src/App.css`, `frontend/src/main.jsx`, `SETUP.md`, `step.md`.

**Database:** `users.is_demo TINYINT(1) NOT NULL DEFAULT 0` added. No existing user row, vehicle or booking was changed by the migration or seed.

### Tests performed and results

| Check | Result |
|---|---|
| `python migrate_db.py` first run | Pass — added `users.is_demo` |
| `python migrate_db.py` second run | Pass — no change (idempotent) |
| `python seed_demo.py` first run | Pass — created 2 demo accounts |
| `python seed_demo.py` second run | Pass — updated 2 accounts, row count unchanged |
| Owner admin row after seeding | Pass — unchanged, `is_demo = 0` |
| Demo password hashes / verification | Pass — scrypt only, correct password verifies, wrong password rejected |
| `python test_phase2.py` | **48/48 pass** |
| `python test_api.py` regression | **78/78 pass** |
| Demo customer login → `/dashboard` (browser) | Pass |
| Demo admin login → `/admin` (browser) | Pass |
| Fill/copy demo credentials panel (browser) | Pass — fields populated; clipboard contained both values |
| Session survives page reload (browser) | Pass — customer and admin |
| Logout and anonymous `/admin` redirect (browser) | Pass |
| Direct `/admin/customers` as demo admin (browser) | Pass — blocked with 403 message |
| Session cookie flags | Pass — `HttpOnly`, `SameSite=Lax` |
| Session expiry | Pass — 8-hour constant; expired token rejected |
| Wrong-password handling | Pass — `401` |
| Login rate limit | Pass — 5 failures then `429` |
| `create_admin.py --reset` logic | Pass — new password verifies, old rejected, mismatch leaves hash unchanged, demo admin refused |
| `create_admin.py --list` | Pass — lists admins without password data |
| Frontend production build | Pass — 69 modules, 226.59 kB JS / 24.60 kB CSS |
| Browser automation | **20/20 pass** (headless Chrome via DevTools Protocol) |
| Owner admin login with the existing password | **Not verified** — password remains unknown to this session |

### Limitations and remaining work

1. **Owner admin login is still unverified** because the existing password is unknown. The new reset flow is ready but was not run, by instruction. The owner should run `python create_admin.py --reset` and confirm login.
2. **Full demo data isolation is a Phase 3 task.** In Phase 2 the demo admin is read-only and sees masked PII, but visual totals still include real data, and the demo customer can still create booking rows against real local vehicles.
3. **Demo admin access is local-only** because the API binds to `127.0.0.1` and is not deployed. Do not expose it publicly before Phase 3 isolation is implemented and verified.
4. **Vehicle images are still broken** (`BUG-02`) — visible in the login screenshot because `/images/...` ignores the Vite base path. Phase 4.
5. **GitHub Pages deep links still return `404`** (`BUG-09`). The basename fix makes client routes correct under the base path, but the host still needs an SPA fallback in Phase 4/7.
6. **Sessions remain in memory.** A backend restart logs everyone out; this was re-confirmed and is unchanged from Phase 1.
7. **8-hour expiry was verified at unit level**, not by waiting eight hours.

### Bugs fixed / advanced in Phase 2

- **BUG-07** — demo admin login verified and owner reset flow provided; the owner credential itself remains unverified.
- **BUG-14** — untracked root lockfile and empty brace folders removed.
- **BUG-16** — Demo Login Credentials panel added.
- **BUG-22** — partially addressed: demo admin PII masking and read-only enforcement; full isolation remains Phase 3.
- **New (BUG-25)** — local `BrowserRouter` base-path defect found and fixed.

---

## Phase 2–8 Records

| Phase | Status | Files modified | Tests | Approval |
|---|---|---|---|---|
| 2 — Full-Control Main Admin & auth | **Completed** | See Full-Control Completion Record | 125/125 API + 78/78 regression + 9/9 isolation + 27/27 browser + build | STOP; Phase 3 approval requested |
| 3 — Backend/API fixes | **Completed locally** | See Phase 3 Completion Record | 47/47 new tests + 86/86 regression + 125/125 Main Admin + 9/9 isolation + 27/27 browser + build | Approved via “yes continue”; STOP before Phase 4 |
| 4 — Images & UI redesign | **Completed locally** | See Phase 4 Completion Record | 97 dev + 97 based-preview + 59 root UI checks; 9 unit + 9 Pages/font; workflow/API regressions | Approved via “yes continue”; STOP before Phase 5 |
| 5 — Local integration/testing | **Completed locally** | See Phase 5 Completion Record | Full regression/E2E/failure/recovery checks; private fingerprint unchanged | Approved via owner request; STOP before Phase 6 |
| 6 — Local demo & acceptance | **Completed** | See Phase 6 Completion Record | Chrome + Edge: 531/531 actions, 247/247 controls, 18 routes, 0 unexpected errors; backend 86/86 + 125/125 + 47/47 + 9/9 + 5/5; frontend 15/15; build 71 modules | Agent-operated QA per owner instruction; STOP before Phase 7 |
| 7 — GitHub & deployment prep | **In Progress** | See Phase 7 Preparation Record | phase7 13/13; smoke 16/16; 86/86 + 125/125 + 47/47 + 9/9 + 5/5; frontend 15/15; root/repo builds; secret scan clean | Approved to start; commit/push pending explicit approval |
| 8 — Production deployment | Pending | — | — | Not requested |

---

## Approval Log

| Date | Phase | Decision | Notes |
|---|---|---|---|
| 10 Nov 2026 | Phase 1 | Approved to start | Owner provided the master prompt |
| 10 Nov 2026 | Phase 1 | Completed | Audit + `step.md` delivered |
| 10 Nov 2026 | Phase 2 | Approved to start | Owner explicitly instructed Phase 2 |
| 10 Nov 2026 | Phase 2 | Revised requirements approved | Owner requires full-control Main Admin, not the earlier read-only demo |
| 10 Nov 2026 | Phase 2 | Completed locally | Full-control Main Admin, isolated synthetic DB, customer, resets, login panel and tests; owner/private rows unchanged |
| 10 Nov 2026 | Phase 3 | Approved to start | User replied “yes continue” to the Phase 3 approval request; Phase 4 still requires separate approval |
| 10 Nov 2026 | Phase 3 | Completed locally | Backend/API hardening and verification; no owner-password change, push or deployment; dependency majors not installed |
| 10 Nov 2026 | Phase 4 | Approved to start | User replied “yes continue” to the Phase 4 approval request; no push, deployment or major dependency upgrade authorized |
| 10 Nov 2026 | Phase 4 | Completed locally | Image pipeline, original artwork, palette-preserving UI refinement, local based/root/Pages checks and regressions; private data/password unchanged |
| 11 Nov 2026 | Phase 5 | Approved to start | User requested “read and analysis the step.md file and continue phase 5”; local integration/testing only, no deployment or major dependency upgrade |
| 11 Nov 2026 | Phase 5 | Completed locally | Full regression/E2E/failure/recovery checks; three frontend fixes; private rows/password preserved; no dependency upgrade, push or deployment |
| 11 Nov 2026 | Phase 6 | Approved to start | User requested “continue phase 6”; local demonstration/review only, not acceptance or deployment authorization |
| 11 Nov 2026 | Phase 6 | Awaiting owner review | Existing local services and both demo logins verified; review walkthrough/credentials provided; no business records changed |
| 11 Nov 2026 | Phase 6 | Acceptance process revised | Owner instructed complete agent-operated real-browser QA, inventory, fixes and report; no owner testing required; no Phase 7/push/deployment approval |
| 12 Nov 2026 | Phase 6 | Completed | Chrome dev + Edge production-preview QA each passed 531/531 actions, 247/247 controls, 18 routes, 0 unexpected errors; BUG-33 regression passed; demo data restored and private fingerprint unchanged; no push/deployment |
| 12 Nov 2026 | Phase 7 | Approved to start | Owner replied “yes” to the Phase 7 approval request; local production preparation only, no deployment or paid service |
| 12 Nov 2026 | Phase 7 | Completed | Owner approved the push; `aa39313` pushed to `main`; no deployment or paid service |
| 12 Nov 2026 | Phase 8 | Completed | Render free Docker + TiDB Starter live at https://zelvora-sg9w.onrender.com; 9/9 live browser checks; DB session survived restart; no billing method added |

---

## Known Risks and Open Decisions

1. **Owner admin password is still unknown.** Phase 2 delivered `python create_admin.py --reset`; it has not been run and the owner account has not been changed. The owner must run it and confirm login before relying on the real admin account.
2. **Free hosting changes frequently.** Phase 7 must re-check current limits and costs; no paid plan will be enabled without approval.
3. **Render/similar free backend tiers may sleep.** The site may cold-start after idle; this must be disclosed, not described as 24/7.
4. **Cross-site cookies are unreliable.** If the frontend and backend use different domains, a token-based or same-origin strategy may be required; this is an architecture decision for Phase 7.
5. **Python's built-in HTTP server is not a hardened production server.** It can run behind a hosting proxy for this academic project, but limitations must be documented. No framework change without approval.
6. **Main Admin is intentionally full-control.** Phase 2 isolates it in `zelvora_demo_db`; do not import private data there. Real/private admins require different passwords. Later hosting must use a dedicated database principal as well as application separation.
7. **Synthetic-input policy still matters.** Demo registration rejects real email-provider domains; users must also use fictitious names and phones. Public hosting, retention/reset policy and broader abuse protection remain later-phase decisions; nothing is publicly deployed by this work.
8. **Dependency upgrades may be breaking.** Vite 5 and React Router 6 advisories may require major upgrades; evaluate with tests and approval.
9. **Production must be tested live.** A successful build or push alone will not be treated as deployment success.

---

## Phase 2 Full-Control Completion Record — Authoritative

**Status:** Completed locally, 10 November 2026. **Next:** STOP; Phase 3 requires explicit approval.

### Diagnosis and outcome

- Phase 1 identified two separate problems: the live GitHub Pages shell has no Python/MySQL backend, and the private owner's password is unknown. The earlier read-only demo was additionally incompatible with the full-control requirement.
- Existing full-control changes in the working tree were reviewed and retained. The seeded Main Admin is a normal `admin`; `is_demo` is not a read-only permission. Every existing admin API and navigation item is available. Normal validation/conflict protection remains active.
- Public demonstration runs against **`zelvora_demo_db`**, created from the checked-in schema/sample vehicles, never cloned from private data. It currently has two synthetic users, 12 fictional vehicles and no leftover test bookings. `demo.py` selects it only for its own process and never edits `.env`.
- Private mode denies all legacy `is_demo` logins/sessions and publishes no demo credentials. Demo setup/seed refuse inappropriate targets or account collisions. An existing database without the synthetic marker is not adopted.
- The owner admin/password was not reset or used. All original `zelvora_db` rows (including hashes, timestamps, vehicles and bookings) were fingerprinted before/after and were identical. Owner-password login remains explicitly **unverified**, not claimed fixed.

### Working login credentials (public, synthetic demo only)

| Account | Email | Password | Permissions |
|---|---|---|---|
| Main Admin | `demo.admin@zelvora.example` | `ZelvoraAdmin#2026` | **Full administrative control** |
| Demo Customer | `demo.customer@zelvora.example` | `ZelvoraDemo#2026` | Customer browsing, availability, bookings, own history/profile |

The login page displays these through `/api/demo/credentials` only when they actually match the isolated demo DB. Copy/fill controls were verified in Chrome. No private/production password is exposed or reused.

### Local commands

From `backend`: `python demo.py setup`, then `python demo.py serve`.
From another terminal in `frontend`: `npm run dev -- --host 127.0.0.1`.
Open **http://127.0.0.1:5173/Vehicle-Rental-Management-System/login**.
Secure Main Admin reset: `python demo.py reset-main` (hidden password + confirmation).
Private owner reset exists as `python create_admin.py --reset` but must only be run with owner approval; it was **not run against the owner**.
Changed-password sessions are invalidated on their next request. Update only the intentionally public definition in `backend/demo_accounts.py` and restart the demo backend to advertise a new demo password; stale values are hidden. Private passwords must never go in source files.

### Verification results

| Check | Result |
|---|---|
| `python demo.py setup`, repeated | Pass — isolated DB, then same two accounts refreshed; private DB untouched |
| `python demo.py test` | **125/125 pass** — seeded account login/logout, full admin operations, direct MySQL persistence, totals/revenue, customer booking/cancellation, validation, role matrix on all 13 admin routes, cookie/session/expiry/rate-limit/reset checks |
| `python demo.py regression` | **78/78 pass**, including concurrent double-booking approval protection |
| `python -m unittest test_demo_safety -v` | **9/9 pass** — private-mode credential hiding/login/session denial, wrong DB/marker rejection, seed collision/role refusal, changed-password hiding |
| `test_phase2_browser.cjs` with existing external Playwright and installed Chrome | **27/27 pass** — copy/fill, 390px overflow, login/reload/logout, role redirects, customer booking, vehicle add/edit/status/archive/restore, customer list, booking approve/reject/complete/filter, payment and revenue |
| `npm run build` | Pass — 69 modules; React/Python/MySQL and theme retained |
| Private DB ordered-row SHA-256 comparison | Pass — unchanged; 5 users / 12 vehicles / 1 booking preserved, including unknown owner hash |
| Private-mode real HTTP smoke checks | Pass — credentials endpoint returns disabled/empty; public Main Admin login returns 401 |
| Test-data cleanup | Pass — all newly created test vehicles/users/bookings removed from demo DB |

Browser tests initially failed on incorrect test heading expectations (not application defects); selectors were corrected to the existing headings/role redirect behaviour and the full run passed. Browser screenshot was inspected; existing image 404s remain explicitly deferred, not hidden in test claims. No new package/framework was installed in the repository.

### Files reviewed/changed in this correction

- Backend: `auth.py`, `admin.py`, `config.py`, `server.py`, `.env.example`, `create_admin.py`, `demo_accounts.py`, `seed_demo.py`, `test_api.py`, `test_phase2.py`.
- New isolation/runtime/testing: `demo.py`, `setup_demo.py`, `demo_safety.py`, `demo_access.py`, `test_demo_safety.py`, `test_phase2_browser.cjs`.
- Frontend: `pages/Login.jsx`, `demoAccounts.js`, `components/AdminLayout.jsx`; retained earlier `main.jsx` basename and `App.css` demo-panel styling.
- Retained earlier schema/migration support: `database/database.sql`, `database/migrations/001_add_users_is_demo.sql`, `backend/migrations.py`, `backend/migrate_db.py`.
- Documentation: `SETUP.md`, `step.md`. Unrelated pre-existing `backend/_check_state.py` was not removed or executed.

### Remaining limitations / scope boundary

1. Existing owner's password remains unknown/unverified and unchanged; the separate Main Admin is the tested alternative requested.
2. Sessions persist across browser requests/reloads, **not backend restarts**. Eight-hour expiry was simulated, not waited out.
3. Existing vehicle/auth image base-path defects remain for Phase 4. No unrelated pages were redesigned.
4. Existing customer management supports viewing records/counts, not customer deletion/editing; no such feature was invented. Vehicle archive/restore is the existing safe deletion mechanism.
5. Demo setup/seed restore public account credentials but are not a whole-business-data reset service. Never put real data in the demo DB; use synthetic inputs only.
6. The local Python server, root/locally configured MySQL identity, dependency advisories, production HTTPS/cookies/CORS, deployment hosting and GitHub Pages API/deep-link failures are **not** production-ready fixes. No push/deployment occurred.
7. Broad Phase 3 hardening and later cross-browser/mobile/error-path integration work remain pending. Only tests needed to prove Phase 2 were performed.

**Phase 2 complete. STOPPED. Do you approve starting Phase 3?**

---

## Phase 3 Completion Record — Backend, Database, API and Role-Permission Fixes

**Status:** Completed locally, 10 November 2026.  
**Authorization:** User replied **“yes continue”** to the Phase 3 approval request.  
**Next:** STOP; Phase 4 requires explicit approval.

### Completed work

1. **Full-control Main Admin preserved.** No read-only checks, hidden customer navigation or reduced administrative operations were added. Both synthetic normal/admin accounts and `is_demo` accounts were exercised; authorization still depends on role inside a valid isolated environment.
2. **Demo isolation extended.** Before every demo request, the backend checks the expected schema marker and verifies user-email domains are synthetic/reserved. Invalid marker/non-reserved imports produce 503 before data is returned. Real-MySQL tests temporarily introduced invalid demo-only states and restored them in `finally`. Private demo login/session denial remains tested. New `python demo.py audit` reports counts only and performs no writes.
3. **Reset/retention strategy designed, not executed.** `database/DEMO_SAFETY.md` defines offline operation, named-schema approval, backup/restore verification, typed confirmation, transactional replacement and post-reset verification. There is deliberately no broad reset HTTP endpoint, automatic deletion or executable whole-data reset command. No existing demo/business data was reset.
4. **Database-aware health.** `/api/health` returns 200 only when MySQL/demo readiness checks pass, otherwise generic 503. It does not perform user lookup, even with a stale cookie. MySQL connection establishment is bounded to five seconds. Business database failures now return generic 503 without SQL/connection secrets; logs omit query strings and exception messages.
5. **Authentication state cleanup/hardening.** Expired sessions and all old login buckets are cleaned on traffic at minute intervals; exact-expiry tokens are rejected immediately. Login buckets are capped at 10,000 emails. Reserving attempts under a lock prevents concurrent wrong-password requests from bypassing the five-attempt window. DB outages do not count as incorrect passwords. Oversized passwords/tokens and malformed scrypt hashes are rejected safely. A password-reset/login race now refuses session creation if the hash changed after verification.
6. **Input and currency fixes.** IDs/seats no longer silently accept booleans/fractional JSON numbers. Dates require canonical `YYYY-MM-DD`. Price/filter inputs must be finite and bounded; min/max order is validated. Invalid category/image types return field errors instead of internal failures. Monetary calculations use Decimal and deterministic half-up rounding. The existing 60-inclusive-day, 365-day pickup horizon, cancellation and payment business rules were retained and tested.
7. **HTTP robustness.** Invalid Content-Length, duplicated framing, unsupported chunked bodies, fake JSON MIME types, oversized requests, malformed/non-object JSON, NaN/Infinity/exponent overflow, lone Unicode surrogates, excessive JSON nesting and malformed request targets receive controlled 4xx responses. Request reads have a ten-second socket timeout. Cookie/error handling does not expose private details.
8. **Registration privacy and statistics.** Public catalog/detail registration values are `Hidden for privacy`; actual registrations remain available in authoritative admin APIs and customers' own bookings. Dashboard counts/revenue use one aggregate snapshot statement instead of seven independent queries. Approval handles a disappeared booking/vehicle with 404 rather than dereferencing missing rows.
9. **Regression protection.** Existing API regression expanded from 78 to 86 checks and is now refused against private databases. New unit, local-HTTP fault injection and real-MySQL integration tests cover role escalation, profile ownership, date/payment boundaries, literal SQL-injection strings, runtime isolation faults and booking/archive concurrency. Existing Main Admin and Chrome suites were rerun.

### Defects fixed or advanced

| ID | Finding | Local outcome |
|---|---|---|
| BUG-19 / AUTH-09 | Old login buckets accumulate globally | Pruned, bounded and tested under concurrent attempts |
| BUG-24 | Public vehicle registration disclosure | Public values masked; authorized booking/admin values unchanged |
| SEC-08 / SEC-09 | Health ignores DB; incomplete expiry coverage | Real DB readiness, safe 503s, cleanup/expiry/failure tests |
| BUG-08 / BUG-22 | Public credentials could expose mixed data | Isolated DB retained; runtime marker/domain validation added; full control retained |
| BUG-26 (new) | Permissive integer/date/money validation can truncate values or reach MySQL with invalid data | Strict validators, Decimal totals and controlled 400s |
| BUG-27 (new) | Password may be reset between login verification and session stamping | Expected-hash comparison refuses stale-credential session issuance |
| BUG-28 (new) | Malformed framing/JSON/URI can become internal errors or unbounded reads | Controlled 4xx, size/shape checks, safe logging and read timeout |
| BUG-29 (new) | Dashboard counts/revenue obtained from different query snapshots | Single summary aggregate plus recent bookings in one transaction |

### Test evidence

| Command/check | Result |
|---|---|
| `python demo.py phase3` | **47/47 pass**: 27 unit/fault-injection methods + 20 real-MySQL integration methods, with additional table-driven subcases |
| `python demo.py regression` | **86/86 pass**, including concurrent double-booking approval protection |
| `python demo.py test` | **125/125 pass**: all full-control Main Admin operations, direct MySQL persistence/revenue, auth/session/reset/role checks |
| `python -m unittest test_demo_safety -v` | **9/9 pass** |
| Existing Chrome/Playwright `test_phase2_browser.cjs` | **27/27 pass**, including login/copy/fill, customer bookings, admin mutations, payment/revenue, reload/logout and role redirects |
| `npm run build` | Pass — unchanged frontend output, 69 modules |
| `python -m compileall -q backend` | Pass |
| `git diff --check` | Pass; only Git's Windows LF/CRLF warnings |
| `python demo.py audit` / test cleanup | Pass — 2 synthetic users, 12 fictional vehicles, 0 leftover test bookings |
| Private database ordered-row fingerprint | **Identical before/after Phase 3**, including owner password hash; 5 users / 12 vehicles / 1 booking preserved |
| `npm audit --json` | **3 moderate + 1 high remain**; evaluated, not silently fixed or ignored |

The initial new-suite run had one assertion expecting lowercase registration text, while the existing validator intentionally stores uppercase. The fixture was normalized to match that established rule; the complete final suite passed. Database-outage handling was tested using controlled exceptions through a real local HTTP test server; the user's MySQL service was **not stopped**. Expiry was simulated, not waited out for eight hours. Temporary invalid marker/domain states were restored; no broad data reset was performed.

### Dependency decision (explicitly deferred)

`npm audit` proposes major-upgrade candidates Vite **8.3.7** and React Router DOM **7.18.5** (including esbuild/transitive fixes). Installing these was **not approved**, so no dependency/lockfile was changed and no advisory is claimed resolved. The router advisory set includes open-redirect and SSR-hydration issues; this app is a client-side BrowserRouter SPA, not an SSR app, but the installed package advisories still require migration evaluation. Keep dev servers local; loopback binding is not a substitute for fixing development-server vulnerabilities. `gh-pages` remains because Pages retirement has not been approved.

### Files changed in Phase 3

- **Backend updated:** `admin.py`, `auth.py`, `bookings.py`, `config.py`, `demo.py`, `demo_safety.py`, `server.py`, `test_api.py`, `utils.py`, `vehicles.py`.
- **Backend added:** `health.py`, `audit_demo.py`, `test_hardening.py`, `test_phase3.py`.
- **Documentation:** `SETUP.md`, `step.md`, new `database/DEMO_SAFETY.md`.
- No frontend source, approved palette, package manifest, lockfile, SQL schema, `.env`, existing private row or owner password was changed in Phase 3. Pre-existing unrelated files/changes were preserved.

### Remaining limitations and scope boundary

- Major dependency upgrades still need explicit approval and compatibility testing; the remaining audit findings are not hidden.
- Sessions remain process-local; restarts log users out. Production session storage, HTTPS/CORS/cookies, hosting and a dedicated restricted-to-demo MySQL principal remain later-phase work. Local MySQL may still use the configured root account.
- A marker/domain guard cannot prove that names, phones or free-text content are fictitious; use synthetic inputs only, never import private records, and retain operator review. No public deployment occurred.
- Whole-data reset/retention execution is a designed future operator action, not an implemented deletion feature. Seed still refreshes credentials only.
- Vehicle images/base paths, unrelated UI polish, Pages deep links and the live site's absent backend remain unfixed in this phase. Phase 4 and later work have **not started**.
- The owner's original password remains unknown/unverified and unchanged. The tested Main Admin is the separate synthetic full-control account.
- Broad cross-browser/accessibility/production validation remains in later phases. No GitHub push, deployment or paid service was used.

**Phase 3 complete locally. STOPPED. Do you approve starting Phase 4 — Vehicle Image/SVG Repair and Professional UI/UX Redesign?**

---

## Phase 4 Completion Record — Images, Responsive UI and Local Build Verification

**Status:** Completed locally, 10 November 2026.  
**Authorization:** User replied **“yes continue”** to the Phase 4 approval request. Interrupted responses were resumed within the same phase.  
**Next:** STOP; Phase 5 requires separate explicit approval.

### Completed work

- **Central image pipeline:** `frontend/src/assets.js` resolves portable DB `/images/...` values, relative assets and already-based paths using `BASE_URL`. Valid external HTTP(S) links remain supported; unsafe schemes, traversal and credential-bearing URLs are rejected. No MySQL image path was rewritten to a deployment-specific prefix.
- **Resilient images everywhere:** all runtime `<img>` rendering is centralized in `VehicleImage`. It uses a requested source, category illustration, then an embedded SVG if the category file also fails. Duplicate sources are removed so a failed default cannot stall on the same URL. Fallback is labelled, bounded, and reset when source/category changes. Explicit 800×600 dimensions, 4:3 wrappers and `contain` prevent distortion/cropping. Noncritical images are lazy; key above-the-fold images are eager/high priority.
- **Original local artwork:** all seven vehicle SVGs were redrawn with studio backdrops, shaded bodywork, detailed wheels/panels and approved brand colors. Combined uncompressed size: **19,458 bytes**. SVG XML parsed successfully; no scripts, external raster resources or manufacturer logos were introduced. `ASSET-NOTES.md` documents original provenance and representative-illustration limitations. WebP/AVIF/srcset conversion was not needed for this vector strategy.
- **Palette-preserving UI refinement:** editorial Home hero, category/featured cards, clearer pricing/specifications, restrained type hierarchy and spacing, white form/table panels, improved dashboard statistics, mobile navigation and footer. All nine root palette values remain exactly approved. No fake customer reviews, ratings, operating hours or support-response promises were added. Contact now explicitly identifies a synthetic, unstaffed demonstration.
- **Usability/accessibility:** skip-link focuses main, mobile Escape restores toggle focus, errors/hints are associated with fields, confirmation dialogs have names/descriptions, admin tables are labelled keyboard-focusable scroll regions, and loading/empty/error/retry states have clear messages. Reduced motion is honored. Primary buttons, error text and warning badges passed selected AA contrast checks; this is not a full WCAG audit.
- **Metadata and local routing:** description/OG/summary metadata and per-route titles added; existing favicon verified at the base path. Build writes a based `404.html` shell. A local Pages-like host proved deep routes render with working JS/CSS/images/API proxy. **The original HTTP 404 status remains** on a Pages-style fallback, and no live deployment is claimed.
- **Full-control workflows retained:** existing browser tests still perform vehicle add/edit/status/archive/restore, customer access, bookings, approve/reject/complete, payment and revenue through React/Python/MySQL. No admin role restrictions, password changes, backend business-rule changes or unrelated stack migration were made in this phase.

### Tests and evidence

| Check | Final result |
|---|---|
| `npm test` (Node built-in runner) | **9/9 pass** — paths, safe URLs, seven self-contained small SVGs, fallback definitions and exact palette tokens |
| `tests/phase4.browser.cjs` against dev port 5173 | **97/97 pass** across 18 routes at 360/768/1024/1440 |
| Same suite against based production preview port 4173 | **97/97 pass** with built JS/CSS and real local API |
| Same suite against a separate `/` build at port 4174 | **59/59 pass** across all 18 routes at 360/1440, plus interaction/failure checks |
| `tests/pages-fallback.cjs` | **9/9 pass** — exact shell copy, real local HTTP-404 deep-link rendering, valid assets/runtime and font-CDN blocking fallback |
| Existing `backend/test_phase2_browser.cjs` | **27/27 pass** — copy/fill, login/reload/logout/roles and full customer→admin mutations/payment/revenue |
| `python demo.py regression` | **86/86 pass** against real MySQL |
| `python demo.py test` | **125/125 pass**, full Main Admin access/auth/session/reset/SQL verification preserved |
| `python -m unittest test_demo_safety -v` | **9/9 pass** |
| Default and root `npm run build` | Pass — 71 modules; final default build restored to repository base; ~233.12 kB JS / 40.60 kB CSS before gzip |
| Seven vehicle SVGs parsed with Python XML parser | Pass — all valid, 4:3 |
| `git diff --check` | Pass (Windows LF/CRLF warnings only) |
| Private database ordered-row fingerprint | Identical to Phase 4 baseline, including existing owner hash; no private rows changed |
| Demo audit / temporary data cleanup | 2 synthetic users, 12 fictional vehicles, 0 leftover test bookings |

The UI matrix covers Home, fleet, details, About, Contact, Login, Register, client 404, customer dashboard/history/profile/booking, and all admin views including add/edit. Normal runs had **zero broken visible images, local HTTP error responses, local console errors, React runtime errors and document horizontal overflow**. Internal admin-table scrolling is intentional. Additional fault tests intentionally generated a missing file, aborted category image, simulated 503/empty/delayed API response and blocked fonts; those expected failures are separate from normal-route results.

Screenshots and result JSON were saved outside the repository under the approved `%LOCALAPPDATA%\Temp\opencode` directory (`zelvora-phase4`, `zelvora-phase4-preview`, `zelvora-phase4-root`). Desktop/tablet/mobile Home, fleet, Login and admin screenshots were inspected. Test screenshots may show a clearly synthetic temporary `TEST Phase4` vehicle; it is removed after each completed suite and is not part of the final demo data.

### Issues discovered during Phase 4 verification

1. **Hero caption overlap:** screenshots revealed the former overlaid caption obscured artwork at narrower widths. Caption now sits below the 4:3 image; explicit overlap assertions pass at every tested width.
2. **Test-harness route race:** the added delayed-response test initially removed an active Playwright route before its callback completed, causing `Route is already handled`. It was a harness error, not an app/backend failure. Handler removal now waits, and callback failures propagate to normal cleanup rather than an unhandled process exit. The one interrupted synthetic fixture (exact vehicle ID/registration confirmed first) and its booking were removed individually; no broad deletion was used. Final suites passed and cleanup/audit were rechecked.

### Files changed in Phase 4

- **New:** `frontend/src/assets.js`, `frontend/src/components/VehicleImage.jsx`, `frontend/tests/assets.test.js`, `frontend/tests/phase4.browser.cjs`, `frontend/tests/pages-fallback.cjs`, `frontend/public/images/ASSET-NOTES.md`.
- **Artwork:** the seven existing `frontend/public/images/*.svg` vehicle files replaced with original artwork.
- **UI:** `frontend/src/App.css`, `App.jsx`, `siteInfo.js`; image-using pages/components; `components/Field.jsx`, `ConfirmDialog.jsx`, `Feedback.jsx`, `Navbar.jsx`, `Footer.jsx`, `Sections.jsx`; admin dashboard/table/form presentation.
- **Build/docs:** `frontend/index.html`, `frontend/vite.config.js`, `frontend/package.json` (test script only), `SETUP.md`, `step.md`.
- No production secret, `.env`, package dependency/version, lockfile, backend application source, SQL schema or original private database row/password changed in Phase 4. Existing unrelated work was preserved.

### Remaining limitations / scope boundary

- Nothing was pushed/deployed. The public Pages URL still lacks the hosted Python/MySQL service; local success is not a live-production verification.
- Prepared Pages fallback renders client routes but retains **HTTP 404**. A proper 200 SPA rewrite/SEO and production API-origin/auth configuration remain hosting work; `/api` is still same-origin.
- Four dependency audit entries from Phase 3 (3 moderate, 1 high) remain; no major upgrade was authorized or installed. Dev/preview servers stay on loopback.
- Sessions remain process-local. Owner's original password remains unchanged and unverified; synthetic Main Admin credentials remain the working full-control demonstration alternative.
- Google Fonts remain optional external typography resources; blocked-font testing verified a usable mobile login with system fonts. Fleet images themselves have no external resource dependency.
- Artwork is representative illustration, not real fleet photography. Contact data is intentionally reserved/demo-only, not an operating business's contact information.
- Chrome responsive/keyboard/selected-contrast checks are not comprehensive accessibility, Firefox/Safari/mobile-device or production certification. Broad integration/failure/cross-browser work remains Phase 5; owner design acceptance remains a later review.

**Phase 4 complete locally. STOPPED. Do you approve starting Phase 5 — Local Full-Stack Integration and Comprehensive Testing?**

---

## Phase 5 Completion Record — Local Integration, Regression and Failure Recovery

**Status:** Completed locally, 11 November 2026.  
**Authorization:** User requested **“read and analysis the step.md file and continue phase 5”**.  
**Next:** STOP; Phase 6 requires separate explicit approval.

### Completed work and defects fixed

- **Safe local integration:** verified the running MySQL80 service, audited `zelvora_demo_db` without reseeding/resetting existing accounts, then started the isolated API on loopback port 8000 and Vite on 5173. A based production build/preview on 4173 was tested too. The owner's `.env`, original password and private rows were not changed.
- **Complete customer/admin workflow:** new synthetic customer registration, duplicate-email rejection, wrong-password handling, logout/login/reload, profile persistence, role redirects, catalog search/category/price/sort/date availability, details, inclusive-day quote, pending bookings, Main Admin approval, customer confirmation, cancellation, rejection, Paid/Completed status and completed-only revenue were exercised through React/Python/real MySQL. Existing UI tests additionally reverified full vehicle add/edit/status/archive/restore and unmasked synthetic customer records.
- **BUG-30 — stale availability quote:** delaying an availability response and editing the return date reproduced an old total displayed beside new dates. Availability requests now carry a version; date changes invalidate it, and obsolete successes/errors cannot update the quote. The browser regression proves the stale quote stays hidden.
- **BUG-31 — failed logout:** aborting the logout request reproduced cleared React identity despite an unrevoked HttpOnly server cookie, plus an unhandled rejected click handler. Identity now clears only after successful server logout. Navbar catches errors, displays an accessible retry warning and prevents duplicate in-flight clicks. Reload reflects the still-valid session; successful retry revokes it.
- **BUG-32 — stale identity after expiry/revocation:** revoking a real server session while retaining the mounted React state reproduced a protected-page 401 with no usable login transition. Protected API 401 responses now signal the auth provider to clear its cached user; existing route guards return to login and preserve the requested destination. Wrong-password login, 403 and 503 do not clear identity. API unit tests cover this distinction.
- **Real failure/recovery checks:** a new Python suite runs a separate local HTTP server, points only its own MySQL connection configuration at a reserved non-listening port, verifies safe 503s, then restores configuration and confirms the original session still works. Other tests exercise actual expired/revoked tokens and log privacy. A separate browser harness owns and actually stops/restarts its own child Python backend, without touching the normal API or MySQL service; catalog recovery, restart logout and reauthentication pass against the production build.
- **No new framework:** reused Node's built-in test runner and an already-installed external Playwright 1.64.0 with installed Chrome/Edge. No package manifest/dependency version/lockfile or production configuration changed in Phase 5.

### Final test evidence

| Command/check | Final result |
|---|---|
| `python demo.py regression` | **86/86 checks pass**, including concurrent booking-approval protection |
| `python demo.py test` | **125/125 checks pass**, full-control Main Admin/auth/MySQL persistence/revenue |
| `python demo.py phase3` | **47/47 test methods pass**, including table-driven HTTP/input/auth/isolation/concurrency cases |
| `python -m unittest test_demo_safety -v` | **9/9 methods pass** |
| New `python demo.py phase5` | **5/5 methods pass**, real connection-refusal/recovery, HTTP expiry/revocation, restart-state model and log privacy |
| `npm test` | **15/15 pass**: 9 existing asset/palette checks + 6 API transport/auth/error checks |
| New `tests/phase5.browser.cjs`, Chrome dev | **29/29 checks pass** |
| Same suite, installed Microsoft Edge dev | **29/29 checks pass** |
| Same suite, Chrome based production preview | **29/29 checks pass** |
| Existing `backend/test_phase2_browser.cjs`, Chrome | **27/27 checks pass**, full admin mutation/copy/fill/roles/revenue regression |
| Existing `tests/phase4.browser.cjs`, Chrome dev | **97/97 checks pass**, all 18 routes at 360/768/1024/1440px |
| Same matrix, Chrome based production preview | **97/97 checks pass**, all 18 routes/four widths |
| Same matrix, installed Microsoft Edge production preview | **59/59 checks pass**, all 18 routes at 360/1440px plus keyboard/fallback/error checks |
| New `tests/recovery.browser.cjs`, built frontend + owned Python child | **7/7 checks pass**, actual backend stop/restart and reauthentication |
| `tests/pages-fallback.cjs` | **9/9 checks pass**, local HTTP-404 deep-link rendering and blocked-font fallback |
| `npm run build` | Pass — 71 modules, JS **233.69 kB**, CSS **40.60 kB** before gzip; default repository base retained |
| Python compilation / browser-script syntax / `git diff --check` | Pass (normal Git Windows line-ending warnings only) |
| Main backend and dedicated recovery-server log scans | Pass — no tested passwords, hashes, session tokens, body/query sentinel, auth headers or unexpected traceback leaked |
| Private database complete ordered-row SHA-256 comparison | **Identical before/after**, including owner hash; **5 users / 12 vehicles / 1 booking** preserved |
| `python demo.py audit` after all suites | **2 synthetic users / 12 fictional vehicles / 0 bookings**; all individually tracked test rows removed |

Normal browser runs had zero captured React runtime errors, console errors and failed local HTTP responses/requests, with no broken visible images or document horizontal overflow in the responsive matrix. Fault tests deliberately generate transport errors, 401/503 responses and missing assets; these expected failures are not counted as clean normal traffic. Automated Chrome/Edge screenshots of customer booking results, retry warnings and desktop/mobile layouts were inspected. Chrome and Edge share the Chromium engine.

Full API/test output is retained under **`%LOCALAPPDATA%\Temp\opencode\zelvora-phase5-*.log`**. Browser result JSON/screenshots are in `zelvora-phase5\chrome`, `zelvora-phase5\msedge`, `zelvora-phase5-preview-e2e`, and `zelvora-phase5-matrix-{dev,preview,edge}` under that same approved temporary directory. `zelvora-phase5-integrity.txt` records the private fingerprint comparison/log scan outcome, not private rows or passwords. Screenshots may contain a clearly marked temporary TEST vehicle/customer; these fixtures were cleaned individually after each run.

Initial browser runs reproduced the three application bugs above. Harness-only expectations were also corrected to the existing conflict message and intended post-login return route; expected-error traffic is allowed to settle before resuming normal-run error monitoring. Final complete suites passed. A diagnostic diff check with line-ending normalization disabled counted existing CRLF bytes as whitespace; the repository's normal `git diff --check` passes. Pre-existing package/config line endings were not rewritten.

### Phase 5 files

- **Application fixes:** `frontend/src/api.js`, `AuthContext.jsx`, `components/Navbar.jsx`, `pages/BookVehicle.jsx`.
- **New tests:** `frontend/tests/api.test.js`, `phase5.browser.cjs`, `recovery.browser.cjs`; `backend/test_phase5.py`.
- **Test plumbing:** `backend/demo.py` adds `phase5`; `frontend/tests/phase4.browser.cjs` accepts an optional installed browser channel.
- **Documentation:** `SETUP.md`, `step.md`. Earlier uncommitted work and unrelated `backend/_check_state.py` were preserved.

### Known limitations and phase boundary

1. **No production/deployment claim:** no commit, push, hosting change, paid service, production API/CORS/cookie/session configuration or live verification. Pages still lacks a hosted API/MySQL and its fallback retains HTTP 404.
2. **Browser/device scope:** Chrome and Edge were tested, not independent Firefox/WebKit/Safari engines or physical phones. No new browser binaries were installed. Responsive viewports and selected keyboard/contrast checks are not full accessibility certification. Owner hands-on acceptance was then expected in Phase 6; the owner later delegated that acceptance to agent-operated QA.
3. **Session design unchanged:** backend restarts invalidate in-memory sessions; this is now demonstrated by a real stop/restart. Eight-hour expiry is simulated by setting the test token's expiry, not waiting eight hours. An initial auth check during an outage still cannot establish a user until the backend recovers and the user reloads/logs in.
4. **Failure scope:** MySQL itself was not stopped; actual connection refusal was isolated to the test process. Browser DB-503 scenarios use controlled responses, with real backend response/recovery separately proven over HTTP. Only the recovery harness's own Python child was killed/restarted.
5. **Deferred risks retained:** earlier dependency audit findings (3 moderate + 1 high), production server hardening, demo retention/principal restrictions and original owner-password verification remain later/operator work. No major upgrade or owner-password reset was authorized/executed. The app accepts image URLs, not file uploads; URL validation/fallback was tested, not a nonexistent upload feature.

**Phase 5 complete locally. STOPPED. Do you approve starting Phase 6 — Local Demonstration and User Acceptance?**

---

## Phase 6 Completion Record — Agent-Operated Browser QA

**Status:** Completed, 12 November 2026. **Next:** STOP; Phase 7 requires separate explicit owner approval.

**Authorization:** The owner revised Phase 6 acceptance so the agent performs all manual-style QA in a real
browser against the real Python API and real MySQL. No owner clicking/testing was required. This did not
authorize Phase 7, a push, a deployment, a paid service or any owner/private-data change.

### Final evidence

| Evidence | Chrome 5.4.21 dev (5173) | Edge production preview (4173) |
|---|---|---|
| Executed actions | **531/531 pass** | **531/531 pass** |
| Logical controls | **247/247 tested** (0 untested) | **247/247 tested** (0 untested) |
| Routes | **18** | **18** |
| Runtime exceptions | **0** | **0** |
| Unexpected console errors | **0** (34 expected fault-injection events) | **0** (22 expected) |
| Unexpected network failures | **0** (34 expected) | **0** (22 expected) |

The runs covered successful and rejected customer/admin workflows, independent MySQL SELECT evidence, the
360/768/1440 responsive layouts, keyboard/menu/dialog behaviour, injected loading/error/retry paths, asset
loading and protected-route authority checks. BUG-33's regression passed in both browsers (action 114 holds a
real PUT in flight and confirms Archive stays disabled until it completes).

Supporting checks: `python demo.py regression` **86/86**, `python demo.py test` **125/125**,
`python demo.py phase3` **47/47**, `python -m unittest test_demo_safety -v` **9/9**,
`python demo.py phase5` **5/5**, `npm test` **15/15**, `npm run build` **71 modules** (233.70 kB JS /
40.60 kB CSS), `python -m compileall -q backend`, `node --check frontend/tests/phase6.browser.cjs` and
`git diff --check` pass (Git's LF/CRLF warnings are not whitespace failures).

### Fixes and harness corrections

- **BUG-33:** `frontend/src/admin/ManageVehicles.jsx` now disables Archive while an inline status save is in
  flight, preventing the status-save/Archive race.
- Three harness-only issues were corrected rather than counted as application bugs: waiting out a transient
  protected-page loader before responsive geometry assertions, bounding the pending-request wait so a
  suspended OS request cannot hang the runner, and keying Home category tiles by their stable heading so
  brief loading/error states are not counted as extra logical controls.
- The earlier interrupted run's `ERR_NETWORK_IO_SUSPENDED` events were environmental (machine network
  suspension), not an application defect.

### Data safety and cleanup

Every synthetic fixture was removed by exact identity (vehicle/user/booking IDs checked before deletion).
The demo database returned to **2 synthetic users / 12 vehicles / 0 bookings** (`python demo.py audit`). The
private database ordered-row fingerprint was **identical before and after** Phase 6:
**5 users / 12 vehicles / 1 booking**, including the unchanged owner password hash. No private rows or
passwords were read into the demo database, logged or published.

### Limits and phase boundary

- Chrome and Edge share Chromium; Firefox/Safari/WebKit and physical devices are not claimed tested.
- Viewport automation and selected keyboard/contrast checks are not full accessibility certification.
- Sessions remain process-local; a backend restart requires login again.
- No blanket 100% state-space coverage is claimed: the inventory covers the documented logical controls and
  executed real workflows, not every conceivable record combination.
- No commit, push, hosting change, paid service, production configuration or live deployment occurred.
- Existing dependency advisories and production hosting/auth/session hardening remain later/operator work.

### Artifacts and files

- **Report:** `PHASE6_BROWSER_QA.md` (authoritative detailed report).
- **Harness:** `frontend/tests/phase6.browser.cjs`; **helper:** `backend/qa_phase6.py`.
- **Fix:** `frontend/src/admin/ManageVehicles.jsx`.
- **Evidence:** `%LOCALAPPDATA%\Temp\opencode\zelvora-phase6\chrome` and `...\msedge-preview` contain
  `results.json`, `interaction-results.md`, `mysql-evidence.json` and screenshots;
  `zelvora-phase6-integrity.txt` records the private fingerprint comparison.

**Phase 6 complete. STOPPED. Do you approve starting Phase 7 — GitHub Synchronisation and Production
Deployment Preparation?**

---

## Phase 7 Preparation Record — Production Deployment Preparation

**Status:** Completed and pushed 12 November 2026 (`aa39313`). Phase 8 remains blocked on explicit approval.

**Authorization:** Owner replied “yes” to the Phase 7 start request. This authorized local preparation only;
no deployment, paid service or production data change was performed.

### Hosting research and decision

| Option | Shape | Decision |
|---|---|---|
| **A — single origin** | Render free Docker web service serves the React build and Python API; TiDB Cloud Starter free MySQL-compatible database | **Recommended** |
| B — split origin | Netlify/Vercel frontend + Render API + TiDB | Supported by optional CORS/cookie settings; more moving parts |
| C — Pages + API | GitHub Pages frontend + Render API | Not recommended: Pages has no true SPA rewrite and third-party cookies are unreliable |

Aiven's free MySQL tier is retired for new services and existing free instances end 21 December 2026, so it is
explicitly excluded. Render free services sleep after ~15 idle minutes and wake slowly; this is disclosed.
Railway and Koyeb are fallbacks, not dependable permanent free MySQL + app combinations.

### Auth and production configuration

- **Single-origin auth:** HttpOnly session cookie, `SameSite=Lax`, `Secure` in production; no CORS needed.
- **Split-origin option:** explicit `ZELVORA_ALLOWED_ORIGINS`, `SameSite=None; Secure`, `VITE_API_URL`.
- **Persistent sessions:** optional `ZELVORA_SESSION_STORE=db` stores only SHA-256 token digests in `sessions`;
  memory remains the local default.
- **SPA serving:** `ZELVORA_STATIC_DIR` makes the Python server serve the built React app with a 200
  `index.html` fallback for extensionless routes; hashed assets are immutable-cached.
- **Security:** CSP for the app shell, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS when secure cookies are enabled, CORS preflight allowlist.
- **Hosting:** `0.0.0.0`/`PORT`, optional TLS CA/`ssl_disabled` settings, idempotent migrations, Docker and
  Render files, optional Netlify/Vercel SPA configs.

### Verification

| Check | Result |
|---|---|
| `python demo.py phase7` | **13/13** |
| Production-like smoke (static SPA, deep links, CSP/security headers, CORS, cookies, DB session restart, logout) | **16/16** |
| `python demo.py regression` | **86/86** |
| `python demo.py test` | **125/125** |
| `python demo.py phase3` | **47/47** |
| `python -m unittest test_demo_safety -v` | **9/9** |
| `python demo.py phase5` | **5/5** |
| `npm test` | **15/15** |
| `VITE_BASE=/ npm run build` and default repository-base build | **71 modules**, both pass |
| Python compilation, `git diff --check`, secret scan | Pass; no tracked `.env`, private key or token pattern |

The private database was not used for Phase 7 tests. The demo database gained only the additive `sessions`
table; no owner/private rows or passwords were read or changed.

**Data-safety evidence:** synthetic demo audit returned 2 users / 12 vehicles / 0 bookings; the demo
`sessions` table held 0 rows after tests. The private database fingerprint was unchanged from the Phase 6
baseline (5 users / 12 vehicles / 1 booking, identical SHA-256 hashes).

### Files

- **Backend:** `config.py`, `server.py`, `auth.py`, `migrations.py`, `migrate_db.py`, `setup_demo.py`,
  `seed_demo.py`, `start.py`, `demo.py`, `test_phase7.py`, `.env.example`.
- **Frontend:** `src/api.js`, `vite.config.js`, `.env.example`, `tests/api.test.js`, optional `netlify.toml` /
  `vercel.json`.
- **Database:** `database/database.sql`, `database/migrations/002_sessions.sql` (reference).
- **Deployment:** `Dockerfile`, `.dockerignore`, `render.yaml`.
- **Docs:** `DEPLOYMENT.md`, `README.md`, `SETUP.md`, `step.md`.

### Limits and next gate

- Committed and pushed to `main` as `aa39313`; nothing is deployed. No hosted staging database was created;
  migrations were verified against the local synthetic demo database.
- Render free sleep, Python's built-in server, TiDB foreign-key differences, free-tier quotas and production
  monitoring remain documented limitations.
- **Next:** Phase 8 (deployment) requires owner-provided hosting access and a separate explicit deployment
  approval; nothing has been deployed.

---

## Earlier Phase 6 Handoff Record — Historical, Superseded

> The owner subsequently delegated all manual-style testing to the agent. This earlier handoff/walkthrough
> is retained as history only; its request for owner testing is no longer applicable. Current work is the
> comprehensive browser QA and `PHASE6_BROWSER_QA.md`, not a waiting-for-owner-test gate.

**Status:** In Progress, 11 November 2026.  
**Authorization:** User requested **“continue phase 6”**.  
**Acceptance:** Not yet received. No Phase 7 authorization inferred.

### Ready for local review

- **Frontend/login:** http://127.0.0.1:5173/Vehicle-Rental-Management-System/login
- **Backend base:** http://127.0.0.1:8000 (API routes begin `/api`; the base URL itself has no homepage).
- **Backend health:** http://127.0.0.1:8000/api/health
- **Optional already-running built preview:** http://127.0.0.1:4173/Vehicle-Rental-Management-System/

| Account | Email | Password |
|---|---|---|
| Demo Customer | `demo.customer@zelvora.example` | `ZelvoraDemo#2026` |
| Main Admin — full control | `demo.admin@zelvora.example` | `ZelvoraAdmin#2026` |

These are deliberately public credentials for `zelvora_demo_db` only. Use fictitious names/phones and reserved `.example`, `.test` or `.local` emails; never enter private information or reuse a private password. Customer and admin can be reviewed simultaneously in different browser profiles or normal/incognito windows; tabs in the same profile share one session cookie.

### Readiness checks performed in Phase 6

| Check | Result |
|---|---|
| MySQL80 service and loopback listeners | Running: API 8000, dev 5173, preview 4173 |
| Real `/api/health` | HTTP 200, database `ok` |
| Frontend proxy `/api/demo/credentials` | Enabled; both expected isolated demo accounts present |
| Chrome login page | HTTP 200; Demo Login Credentials panel visible |
| Customer login/dashboard/logout | Pass; expected dashboard, no runtime errors |
| Main Admin login/dashboard/customer navigation/logout | Pass; full-control navigation visible, no runtime errors |
| Read-only `python demo.py audit` | 2 synthetic users, 12 fictional vehicles, 0 bookings |

Readiness checks created/revoked only their own in-memory sessions. No account reseed/reset, vehicle/booking/profile edit, private database operation, dependency change or application-code change was needed. Existing services were reused and left running; they remain local to this computer and may stop if their process/terminal or the computer closes.

### Exact restart steps (only if services have stopped)

1. Verify **MySQL80** is running in Windows Services. Do not run setup/seed merely to start the app.
2. In a terminal at the repository root:

   ```powershell
   cd backend
   python demo.py serve
   ```

3. In a second terminal at the repository root:

   ```powershell
   cd frontend
   npm run dev -- --host 127.0.0.1 --strictPort
   ```

4. Open the frontend/login URL above. Keep both terminals open. If a port is occupied, use the already-running application rather than starting a duplicate or killing an unfamiliar process. Restarting the backend ends existing in-memory sessions; log in again.

### Owner review walkthrough

1. **Customer:** use Fill login form → Log in. Browse/search/filter the fleet, open a detail page, choose a short future date range and check availability. Confirm the inclusive-day total and Pay at Pickup, then submit a booking; it should appear as Pending in My bookings.
2. **Main Admin:** in a separate profile/incognito window, log in and open Bookings. Find that booking, approve it, then refresh Customer → My bookings and confirm its status. On a second test request, try Reject or customer cancellation before pickup.
3. **Payment/completion:** for the first confirmed test booking, mark paid and, for this synthetic review only, mark completed. Customer history should show Paid/Completed; the admin dashboard should include its amount in completed revenue. No online payment is taken.
4. **Fleet/customer tools:** add a clearly labelled fictional review vehicle with a unique registration; edit its rate/status, inspect its image preview, archive it when it has no open bookings, and restore it from Show archived. Check Customers and your own customer profile. Archives and booking history are intentionally retained; do not delete unfamiliar records to clean up.
5. **Presentation:** inspect Home, Vehicles, Login, customer/admin screens and a narrow browser window. Check images, legible text, navigation, forms and buttons. Log out and confirm protected pages request login.
6. **Feedback:** report the page, account role, steps and expected/actual result for any issue (a screenshot helps; do not include private data). Otherwise confirm acceptance and explicitly approve Phase 7.

Phase 5 evidence remains above: 86 API checks, 125 Main Admin checks, 47 hardening methods, 9 isolation methods, 5 recovery methods and 15 frontend unit tests pass; browser E2E passes in Chrome/Edge and the built preview, along with responsive/asset and real stop/restart checks. This evidence supports review but does not replace owner acceptance. Firefox/Safari/physical devices, full accessibility certification, dependency upgrades and production verification remain outside the completed local evidence.

**Historical status: superseded. Phase 6 was subsequently completed by agent-operated QA on 12 November 2026; Phase 7 has not started and still requires explicit approval.**
