# ZELVORA Setup Guide (Windows)

Follow the steps in order. Each step says what you should see when it works.

## 1. Install the required software

1. **Python 3.10 or newer**: https://www.python.org/downloads/
   During install, tick **"Add python.exe to PATH"**.
2. **Node.js (LTS)**: https://nodejs.org/ (this also installs `npm`).
3. **MySQL Community Server 8.0 or newer** and **MySQL Workbench**: https://dev.mysql.com/downloads/installer/
   During setup you choose a password for the `root` user. **Write it down.**
4. **VS Code** (optional but recommended): https://code.visualstudio.com/

Check in a new Command Prompt:

```
python --version
node --version
npm --version
```

## 2. Create the MySQL database

1. Open **MySQL Command Line Client** from the Start menu and enter your root password.
2. Run these two lines (change the folder to where you saved the project):

```
source C:/Users/YourName/Vehicle-Rental-Management-System/database/database.sql
source C:/Users/YourName/Vehicle-Rental-Management-System/database/sample_data.sql
```

Use forward slashes `/` in the path. Then check:

```
USE zelvora_db;
SELECT name, category FROM vehicles;
```

You should see 12 vehicles.

(Using MySQL Workbench instead? Open each `.sql` file and click the lightning-bolt button.)

## 3. Configure database credentials

1. Open the `backend` folder.
2. Copy `.env.example` and name the copy `.env`.
3. Open `.env` and change `ZELVORA_DB_PASSWORD` to your MySQL root password.

The `.env` file stays on your computer. Git ignores it, and the browser never sees it.

## 3b. Apply database migrations (existing installations)

New databases created from `database/database.sql` already have the latest columns. If you already had a
`zelvora_db` database before Phase 2, add the `is_demo` column once:

```
cd Vehicle-Rental-Management-System\backend
python migrate_db.py
```

The script checks the schema first, so it is safe to run again. It prints
`users.is_demo already exists - nothing to do.` when there is nothing to change.

## 4. Install Python dependencies

```
cd Vehicle-Rental-Management-System\backend
pip install -r requirements.txt
```

## 5. Start the Python backend (choose demo OR private mode)

**Recommended for local testing: isolated full-control demo.** From `backend`:

```
python demo.py setup
python demo.py serve
```

`setup` creates **`zelvora_demo_db`**, imports only the checked-in fictional vehicles and seeds two
synthetic accounts. It never copies rows from `zelvora_db`, edits `.env`, or changes the owner password.
It refuses to adopt an existing database without its synthetic-demo marker. The MySQL user needs database
creation permission for this first local setup. Re-running setup/seed explicitly restores the public demo
passwords and invalidates existing demo sessions; it does not erase bookings or vehicle edits.

**Private/owner mode** instead uses the original database named in `.env`:

```
python server.py
```

You should see:

```
MySQL connection OK.
ZELVORA API running at http://127.0.0.1:8000
```

Leave this window open.

Run only one mode on port 8000 at a time. `python server.py` does **not** enable public demo credentials:
legacy `is_demo` accounts are denied login/session access, and the demo credentials panel is hidden.
Keep `ZELVORA_DEMO_MODE=0` in private configurations. Demo mode refuses any database name other than
`zelvora_demo_db`. Never import private records into that database or reuse public passwords for private admins.

## 6. Install the frontend dependencies

Open a **second** Command Prompt:

```
cd Vehicle-Rental-Management-System\frontend
npm install
```

## 7. Start React

```
npm run dev
```

## 8. Open the application

Go to **http://localhost:5173** in your browser. The ZELVORA homepage should show real vehicles.

## 9. Main Admin, Demo Customer and private owner admin

In a third Command Prompt (the backend does not need to be stopped):

### Private owner admin account (optional; existing account preserved)

```
cd Vehicle-Rental-Management-System\backend
python create_admin.py
```

Type a name, email, phone and password (the password is hidden while you type). Then log in on the
website with that email and password. You will be taken to the admin area.

Forgot your admin password? Reset it interactively. This only changes the account you name, and it does
not run automatically:

```
python create_admin.py --reset
python create_admin.py --list
```

`--reset` asks for the admin email and a new password twice. It refuses demo accounts and public demo
passwords. `--list` shows admin emails and account type, never hashes/passwords. Password changes invalidate
old sessions on their next request. **Do not reset the existing owner's password without their approval.**
Phase 2 left the existing private database and owner password unchanged; that password remains unverified.

### Public demo accounts

After `python demo.py setup`, the following accounts are ready. To explicitly refresh their public passwords:

```
python demo.py seed
```

The script is idempotent. It creates the accounts if they are missing and refreshes them if they already
exist. It refuses to touch an existing non-demo account with the same email. Passwords are stored only as
salted scrypt hashes.

| Account | Email | Password | Access |
|---|---|---|---|
| Demo customer | `demo.customer@zelvora.example` | `ZelvoraDemo#2026` | Browse, check availability, send booking requests |
| **Main Admin** (`admin` role) | `demo.admin@zelvora.example` | `ZelvoraAdmin#2026` | **Full control** of dashboard, vehicles, customers, all bookings, approvals/rejections/completion, payments and revenue |

These credentials are deliberately public and are also shown in the **Demo Login Credentials** panel on
the login page. They are not production secrets and do not give access to the owner admin account.

**No read-only restrictions:** Main Admin uses the same backend role check as any other admin. Customer
management currently means viewing customer records/booking counts; there is no customer-delete/edit API in
the existing product. Vehicle deletion is archive/restore, preserving booking history. Normal validation and
booking-conflict rules still apply; these are business rules, not demo permissions.

**Safe password reset for Main Admin:**

```
python demo.py reset-main
```

The new password is hidden, confirmed twice, validated and stored only as a salted scrypt hash. This command
targets only the seeded Main Admin in the separate demo database. It does not touch the owner. To advertise
a changed **public demo** password, update `backend/demo_accounts.py` and restart the demo server. The frontend
gets credentials from `/api/demo/credentials`; mismatching credentials are hidden rather than displayed as
working. No frontend rebuild or second password copy is needed. Never put a private password in that file.

**Demo privacy:** use fictitious names/phones and reserved email domains only. Demo registration accepts
`.example`, `.test` and `.local` addresses, not real-provider addresses. Full-control admins can see and change
everything **inside the separate demo database**. There is no API to switch databases. Do not import real
data into it. This is a local demonstration, not a deployed production service; the Python server still binds
to `127.0.0.1`. Future hosting needs a dedicated demo database user, HTTPS and the later deployment review.

Customers register themselves on the **Create account** page.

## 10. Optional: run the automated tests

With the backend running:

```
cd backend
python demo.py test
python demo.py regression
python -m unittest test_demo_safety -v
```

`test_api.py` creates temporary test data, checks 86 things (login, bookings, double-booking protection,
admin permissions, revenue and more) and deletes the test data afterwards.

`test_phase2.py` creates temporary synthetic records in the isolated demo database, tests every admin API,
verifies writes/revenue directly in MySQL, and cleans its own records even on an exception. It never resets
the real Main Admin or owner password. Session expiry is simulated; sessions survive reloads/requests but
not backend restarts (the existing in-memory design).

**Phase 2 verification (10 November 2026):** 125/125 Main Admin/auth/API checks, 78/78 regression checks,
9/9 isolation tests, 27/27 Chrome browser checks, and `npm run build` passed. The private database's complete
ordered-row fingerprint was identical before/after the work. Browser checks cover fill/copy, reload/logout,
role redirects, customer bookings, vehicle add/edit/status/archive/restore, approve/reject/complete, payments
and revenue. Known asset-path failures remain for Phase 4; no claim of zero image/network errors is made.

Optional browser test: `node backend/test_phase2_browser.cjs` (from the project root), with an already-installed
`playwright` available on `NODE_PATH` and Chrome installed. No test dependency was added to this project.
Set `ZELVORA_BROWSER_URL` if Vite uses a different port; default is
`http://127.0.0.1:5173/Vehicle-Rental-Management-System`. Backend tests respect `ZELVORA_API_PORT`.

## 11. Phase 3 backend hardening and checks

With the isolated backend running, from `backend`:

```
python demo.py audit
python demo.py phase3
python demo.py regression
python demo.py test
python -m unittest test_demo_safety -v
```

Run mutating API suites **one at a time**, not concurrently. The Phase 3 suite temporarily tests invalid
demo-marker/domain states and restores them in `finally`; parallel application tests would correctly get
503 during that deliberate fault. Do not stop the test process halfway through. All suites track and remove
only their own temporary records. `test_api.py` now refuses private-mode execution; use the demo wrapper.

### Behaviour changes

- `/api/health` checks MySQL and demo readiness: `200 {"status":"ok","database":"ok"}` when ready;
  `503 {"status":"unavailable","database":"unavailable"}` otherwise. It ignores stale session cookies
  so readiness remains observable during database faults. Connection establishment has a five-second timeout.
- Database errors return a generic **503**, not credentials, SQL or a misleading healthy response. Logs omit
  query strings, request bodies, cookies, connection details and exception messages.
- All demo requests recheck the synthetic marker and reserved email domains. Corruption or a non-reserved
  user import stops access with 503 before customer data is returned. This does **not** restrict Main Admin
  operations in a valid demo environment.
- Public vehicle catalog/detail responses show `Hidden for privacy` instead of real registration numbers.
  Administrative APIs and a customer's own bookings retain the actual registration.
- IDs/seats must be integers (not booleans or fractional JSON values); dates must use `YYYY-MM-DD`.
  Prices/filters must be finite and bounded; calculations now use Decimal, with half-up currency rounding.
  Maximum rental length remains 60 inclusive days; pickup is limited to 365 days ahead. Cancellation remains
  available only before pickup, and only for Pending/Confirmed bookings.
- Malformed JSON/framing, unsupported content types and oversized bodies receive controlled 4xx responses.
- Expired sessions and old login buckets are pruned globally on traffic (at most once per minute, plus
  capacity cleanup). Expired sessions are invalid immediately, including the exact expiry boundary. The
  per-email limit remains five failed/in-flight attempts in ten minutes; successful login clears it.
  The email map is capped at 10,000 entries; MySQL faults do not consume failed-login attempts.
- Password-reset/login races are rejected, role changes are checked on the next request, and dashboard
  count/revenue aggregation uses one snapshot statement. Sessions still live in memory and end on restart.

**Phase 3 verification:** 47/47 new tests (27 unit/fault-injection + 20 real-MySQL integration methods, with
additional table-driven subcases), 86/86 API regression checks, 125/125 full-control Main Admin/auth checks,
9/9 existing isolation tests, 27/27 Chrome browser checks, frontend build and Python compilation passed.
Database-outage tests use controlled fault injection through a local HTTP server; MySQL itself was not stopped.
The private database/owner hash remained identical. No private password, frontend redesign, push or deployment
was involved. See `step.md` for evidence and the scope boundary.

**Reset/retention:** `python demo.py audit` is read-only. See `database/DEMO_SAFETY.md` for the offline,
backup/confirmation/transaction reset design. No broad reset, scheduled deletion or whole-data reset command
was implemented or executed; seed remains credential-only refresh.

**Dependency approval needed:** `npm audit` still reports **3 moderate and 1 high** vulnerability entries.
Its suggested fixes require Vite and React Router major upgrades (reported candidates: Vite 8.3.7,
React Router DOM 7.18.5). These were evaluated, **not installed**; compatibility/migration testing and explicit
approval are required. Keep development servers on loopback and do not expose them publicly. `gh-pages` stays
until a decision to retire GitHub Pages is approved. No dependency or lockfile was changed in Phase 3.

## 12. Phase 4 images, design and local build verification

### Image handling and artwork

- `frontend/src/assets.js` resolves MySQL `/images/...` values, relative paths and already-prefixed paths
  against Vite's `BASE_URL`. Database image paths are deliberately unchanged and work at `/` or the repository
  base path. Valid external HTTP(S) image links still work; unsafe schemes/credential-bearing URLs are refused.
- Every vehicle image now uses `VehicleImage`: requested image → category illustration → embedded SVG if
  even that local file fails. Fallback is visibly labelled, cannot loop forever, and resets when the form URL
  or category changes. Empty URLs select the category illustration immediately.
- The seven local, original 800×600 SVGs total **19,458 bytes**, with no external image resources or stock-photo
  licensing dependency. See `frontend/public/images/ASSET-NOTES.md`. They are representative illustrations,
  not photographs of the named cars/bikes/scooters. Raster `srcset`/WebP conversions are unnecessary for these
  resolution-independent assets. Frames stay 4:3 and use `object-fit: contain`; noncritical images load lazily.
- The approved nine palette tokens are unchanged. Layout, typography, cards, dashboards, navigation and
  forms were refined; field/error associations, skip-link focus, dialog labels, mobile Escape handling,
  loading/empty/error states and reduced-motion support were improved. Contact details now explicitly describe
  an unstaffed synthetic demo, not a real support service. No admin operation was restricted.

### Unit tests and production-style preview

From `frontend`, with MySQL and `python demo.py serve` already running:

```
npm test
npm run build
npm run preview -- --port 4173 --strictPort
```

Open **http://127.0.0.1:4173/Vehicle-Rental-Management-System/**. Development remains at
**http://127.0.0.1:5173/Vehicle-Rental-Management-System/**. Both local dev/preview modes proxy `/api` to
`127.0.0.1:8000`; neither is a production hosting solution. If using a different backend port, update the
shared proxy target in `frontend/vite.config.js`. No production API URL or cross-origin auth was configured.

`npm test` uses Node's built-in runner: no dependency install or major framework upgrade was introduced.
Optional browser tests require an **already-installed Playwright plus Chrome**, available on `NODE_PATH`:

```
node tests/phase4.browser.cjs
node tests/pages-fallback.cjs
```

Set `ZELVORA_BROWSER_URL=http://127.0.0.1:4173/Vehicle-Rental-Management-System` to test the built preview;
without it the suite targets dev port 5173. Widths default to `360,768,1024,1440`; `ZELVORA_WIDTHS` can
override them. `ZELVORA_ARTIFACT_DIR` changes the screenshot/results location. Default artifacts are under
`%LOCALAPPDATA%\Temp\opencode\zelvora-phase4`, not in the repository.

The UI suite creates one temporary synthetic vehicle/booking, checks all 18 routes with real API data, and
removes only its own records. Separate intentional fault checks cover delayed/empty/error API responses,
missing images and a missing fallback file; those expected 4xx/503/aborts are not counted as normal failures.
Run data-mutating browser/API suites one at a time. Do not terminate a fixture-writing test mid-run; investigate
any interrupted fixture by exact ID/registration before removing it, never by a broad `TEST%` deletion.

Root hosting was also verified locally using a separate temporary build (`vite build --base / --outDir ...`)
and root preview (`vite preview --base / --outDir ... --port 4174`). The final `frontend/dist` is rebuilt for
the configured repository base path; it is **not** left as a root-only build.

### Pages fallback and limitations

The Vite build now writes `dist/404.html` as an exact copy of the based app shell. A local Pages-like server
verified direct `/vehicles`, `/login`, `/admin` and an unknown route: React renders the correct page and its
assets load under the base path. **Pages still returns HTTP 404**, not a true 200 SPA rewrite; SEO/hosting
rewrites remain a later hosting decision. This file was prepared/tested locally only. Nothing was pushed or
deployed, and the existing live Pages site still has no Python/MySQL backend.

**Phase 4 results:** 9/9 unit tests; 97/97 Chrome UI checks on dev and another 97/97 on the based production
preview; 59/59 on a root build at 360/1440; 9/9 Pages/font-failure checks; 27/27 existing browser workflow
checks; 86/86 API regression checks; 125/125 Main Admin/auth checks; 9/9 isolation tests; build and SVG XML
validation passed. Normal tested routes had no broken images, local HTTP errors, React errors or horizontal
page overflow. Screenshots were inspected, including a corrected hero-caption overlap at tablet/mobile widths.

Keyboard/focus/labels, reduced motion and selected AA text-contrast pairs were checked; this is **not** a full
WCAG certification or a Safari/Firefox/device audit. Phase 5's tested browser scope is recorded below. Google Fonts
remain optional: font-CDN blocking was tested and system fallbacks keep the mobile login usable. Known
dependency advisories, process-local sessions and production requirements from Phase 3 still apply.

## 13. Phase 5 integration and recovery verification

MySQL must be running first. Use `python demo.py audit` to check existing demo data without reseeding it,
then `python demo.py serve` from `backend` and `npm run dev -- --host 127.0.0.1 --strictPort` from `frontend`.
The local URL is **http://127.0.0.1:5173/Vehicle-Rental-Management-System/**.

### Backend suites (from `backend`)

```
python demo.py regression
python demo.py test
python demo.py phase3
python -m unittest test_demo_safety -v
python demo.py phase5
python demo.py audit
```

Run suites sequentially. `phase5` starts its own temporary loopback HTTP server. It checks actual MySQL
connection refusal/recovery using only its test-process connection settings, expired/revoked sessions,
lost in-memory session state and log privacy. It does not stop MySQL, edit `.env`, reset credentials or
change business rows. The main demo API can remain running.

### Frontend/browser suites (from `frontend`)

```
npm test
npm run build
node tests/phase5.browser.cjs
node ../backend/test_phase2_browser.cjs
node tests/phase4.browser.cjs
node tests/recovery.browser.cjs
node tests/pages-fallback.cjs
```

Browser commands reuse an **already-installed external Playwright** resolved through `NODE_PATH`, plus an
installed Chrome browser. No new test package/framework was installed in Phase 5. For example, in PowerShell,
set `$env:NODE_PATH='C:\path\to\existing-playwright\node_modules'` to the directory containing that package.
Do not install a new framework or upgrade project dependencies without approval.

- `phase5.browser.cjs` creates one temporary synthetic customer and vehicle, exercises registration,
  profile, search/filter, booking/admin/payment/revenue and failure recovery, then removes only its own
  identity-checked rows. Never interrupt fixture-writing suites or run them concurrently.
- Set `$env:ZELVORA_BROWSER_CHANNEL='msedge'` for installed Edge in the Phase 4/5 and recovery suites;
  remove that variable to return to Chrome. Both browsers use Chromium; this is not Firefox/Safari coverage.
- For production preview, start `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` in another
  terminal and set `$env:ZELVORA_BROWSER_URL='http://127.0.0.1:4173/Vehicle-Rental-Management-System'` before
  the Phase 4/5 suites. Remove it to return to dev. Phase 5 defaults save screenshots/result JSON under
  `%LOCALAPPDATA%\Temp\opencode\zelvora-phase5\<browser>`; `ZELVORA_ARTIFACT_DIR` can override this.
- `recovery.browser.cjs` requires the default based `dist` build. It starts its own local static/proxy host
  and **its own** demo Python child on temporary ports, actually stops/restarts that child, checks recovery
  and reauthentication, and closes both afterward. It never kills the normal API or MySQL service and
  performs no business-data writes. `pages-fallback.cjs` likewise uses its own host.

**Phase 5 results (11 November 2026):** 86/86 API checks, 125/125 Main Admin checks, 47/47 hardening methods,
9/9 isolation methods, 5/5 new HTTP/MySQL recovery methods and 15/15 frontend unit tests passed. New E2E:
29/29 in Chrome dev, 29/29 in Edge dev, 29/29 in Chrome production preview; existing admin browser suite:
27/27. Responsive/asset matrix: 97/97 Chrome dev, 97/97 Chrome preview and 59/59 Edge preview; real backend
restart: 7/7; Pages/font fallback: 9/9. Build, compilation and normal diff checks passed. Private database
rows/password hash were unchanged; demo cleanup returned to two users, 12 vehicles and zero bookings.
See `step.md` for detailed evidence, artifact locations and limitations.

**Three fixes:** delayed availability results cannot quote newly edited dates; failed logout now warns and
keeps the still-valid identity for retry instead of pretending success; protected API 401 returns to login
and restores the requested page after reauthentication. A failed logout means the server cookie may still
be valid: retry after connectivity returns. Restarting the backend still ends process-local sessions by design.

Chrome/Edge responsive automation is not physical-device, Firefox/Safari or full accessibility certification.
Owner manual acceptance is Phase 6. Dependency advisories and production hosting/auth/session work remain
deferred; nothing was pushed or deployed.

## 14. Phase 6 — Agent-operated browser QA

The owner delegated manual-style QA to browser automation; no owner manual testing is required. Local app:
**http://127.0.0.1:5173/Vehicle-Rental-Management-System/login**.
Backend readiness: **http://127.0.0.1:8000/api/health** (the backend root is not a web page).
Use the public Demo Customer/Main Admin credentials in section 9 or the Login page's fill buttons.

If services have stopped, ensure MySQL80 is running, then open two terminals at the repository root:

```powershell
# Terminal 1
cd backend
python demo.py serve
```

```powershell
# Terminal 2
cd frontend
npm run dev -- --host 127.0.0.1 --strictPort
```

Keep the terminals open. Do not reseed/reset merely to start the app. If a port is already occupied, check
the existing app first; do not kill an unfamiliar process. Services are local to this computer, not hosted.

### Automated acceptance runs

`frontend/tests/phase6.browser.cjs` uses independent browser contexts for anonymous access, Demo Customer,
full-control Main Admin and a temporary synthetic customer. Ordinary browser tabs share cookies; the suite
does not confuse those shared sessions with independently authenticated contexts.

From `frontend`, with the existing external Playwright installation on `NODE_PATH`:

```powershell
node tests/phase6.browser.cjs
```

It performs real browser form/click operations, independent SQL checks and route/control inventory capture.
Successful operations are never replaced by frontend mocks. Failures are deliberately injected separately
for loading/retry/error testing. Set `ZELVORA_BROWSER_CHANNEL=msedge` for installed Edge and
`ZELVORA_BROWSER_URL=http://127.0.0.1:4173/Vehicle-Rental-Management-System` for the existing built preview.
PowerShell environment-variable examples are in section 13. No new framework/browser installation is needed.

Default evidence: `%LOCALAPPDATA%\Temp\opencode\zelvora-phase6\<browser>` contains `results.json`,
`interaction-results.md`, `mysql-evidence.json` and screenshots. `ZELVORA_ARTIFACT_DIR` overrides it. The
source-controlled report is `PHASE6_BROWSER_QA.md`; current acceptance status is in `step.md`.

Run mutating suites sequentially. The suite restores its edited seeded profile through the UI and cleans
only its own identity-checked vehicle/user/bookings with `backend/qa_phase6.py`. After an interrupted test,
investigate exact IDs/registration/email before any cleanup; never delete broad `TEST%` rows or reseed/reset.
Phase 6 completed on 12 November 2026. Phase 7 was subsequently approved and prepared locally; QA did not
authorize pushes, deployment, dependency majors or paid hosting. Push/deployment remain separately gated.

## 15. Phase 7 — production configuration and deployment preparation

Phase 7 prepares hosting without deploying. Read **`DEPLOYMENT.md`** for the current free-tier research,
architecture comparison, environment-variable table, deployment steps and rollback.

### What changed

- **Single origin:** when `ZELVORA_STATIC_DIR` is set, the Python server serves the built React app and returns
  `index.html` for extensionless deep links. Hashed assets are cached; `/api/*` stays JSON.
- **Production binding:** `ZELVORA_API_HOST=0.0.0.0` and `PORT` (or `ZELVORA_API_PORT`) are supported. Local
  defaults remain loopback-only.
- **Cookies:** `ZELVORA_COOKIE_SECURE` and `ZELVORA_COOKIE_SAMESITE` control the session cookie. Production
  uses `Secure` + `Lax` for single origin; split origin uses `SameSite=None` + an explicit
  `ZELVORA_ALLOWED_ORIGINS` list.
- **Persistent sessions:** `ZELVORA_SESSION_STORE=db` stores only SHA-256 token digests in the `sessions`
  table, so a backend restart does not log everyone out. `memory` remains the local default.
- **Security headers:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`,
  CSP for the app shell, and HSTS when secure cookies are enabled.
- **Deploy files:** `Dockerfile`, `.dockerignore`, `render.yaml`, and optional `frontend/netlify.toml` /
  `frontend/vercel.json` for split-origin hosting.
- **Migrations:** `python migrate_db.py` now also creates the optional `sessions` table; fresh databases get it
  from `database/database.sql`.

### Local verification

From `backend`:

```powershell
python -m compileall -q .
python demo.py phase7
python demo.py regression
python demo.py test
python demo.py phase3
python -m unittest test_demo_safety -v
python demo.py phase5
```

From `frontend`:

```powershell
npm test
$env:VITE_BASE='/'; npm run build
```

Production-like local run (single origin, DB sessions, no TLS locally):

```powershell
cd backend
$env:ZELVORA_ENV='production'
$env:ZELVORA_DEMO_MODE='1'
$env:ZELVORA_DB_NAME='zelvora_demo_db'
$env:ZELVORA_STATIC_DIR='../frontend/dist'
$env:ZELVORA_SESSION_STORE='db'
$env:ZELVORA_AUTO_MIGRATE='1'
$env:ZELVORA_API_HOST='127.0.0.1'
$env:ZELVORA_API_PORT='8011'
$env:ZELVORA_COOKIE_SECURE='0'
python start.py
```

Open `http://127.0.0.1:8011/` and `http://127.0.0.1:8011/vehicles`; both should render the app. Log in, restart
the process, and confirm the session survives. Never use `ZELVORA_COOKIE_SECURE=0` on a public HTTPS site.

### Docker (optional, if Docker is installed)

```powershell
docker build -t zelvora .
docker run --rm -p 8000:8000 `
  -e ZELVORA_DB_HOST=host `
  -e ZELVORA_DB_PORT=4000 `
  -e ZELVORA_DB_USER=user `
  -e ZELVORA_DB_PASSWORD=secret `
  -e ZELVORA_DB_NAME=zelvora_demo_db `
  zelvora
```

Set `ZELVORA_PROVISION_DEMO=1` for the first deploy only, then `0`. The public demo must remain
synthetic-only (`ZELVORA_DEMO_MODE=1`); never point it at private data. No push, deployment or paid service is
performed by these steps.

## 16. Troubleshooting

| Problem | What to do |
|---|---|
| `Could not connect to MySQL` | Make sure MySQL is running (Windows Services, "MySQL80"), and check the password in `backend\.env`. |
| `Access denied for user 'root'` | The password in `.env` is wrong. |
| `Unknown database 'zelvora_db'` | Step 2 was not done. Run `database.sql` again. |
| `ModuleNotFoundError: mysql` | Run `pip install -r requirements.txt` in the `backend` folder. |
| `python` is not recognized | Reinstall Python and tick "Add python.exe to PATH". Then open a new Command Prompt. |
| Website says "Cannot reach the server" | Start `python demo.py serve` for demo mode, or `python server.py` for private mode. Retry once connectivity returns. |
| “Could not log out” warning | Server logout failed; your cookie may still be valid. Restore connectivity and retry Log out. |
| Port 8000 already in use | Close other programs using it, or set `ZELVORA_API_PORT=8001` in `.env` and change the port in `frontend/vite.config.js`. |
| Port 5173 busy | Vite will offer another port. Use the address it prints. |
| Everyone got logged out | The backend was restarted. Sessions live in memory, so log in again. |
| `/api/health` or demo APIs return 503 | Check MySQL, then run `python demo.py audit`. Investigate marker/domain violations; do not relabel or delete unfamiliar data. Never import private rows into the demo database. |
| Demo login unavailable or panel absent | Stop private-mode backend, run `python demo.py setup`, then `python demo.py serve` from `backend`. Public demo logins intentionally do not work against private data. |
| Changed Main Admin password is not displayed | Update only its public demo definition in `backend/demo_accounts.py`, restart the demo backend and reload Login; or explicitly restore defaults with `python demo.py seed`. |
| Owner admin password unknown | Run `python create_admin.py --reset`. The existing account is not changed until you complete the prompts. |
| Login API returns a database error after upgrading | Run `python migrate_db.py` to add the `users.is_demo` column. |
| Fonts look plain | The fonts load from Google Fonts. Without internet, a fallback font is used. |
| An image says “Illustration preview” | Its supplied URL failed. Check the image link/file; the category fallback is intentional and preserves the workflow. |
| Images fail only under a subfolder | Check Vite `base`, rebuild, and confirm the source uses `VehicleImage`/`assetUrl`; do not rewrite portable MySQL paths to deployment-specific URLs. |
| Preview is showing an old design | Re-run `npm run build`; preview serves `dist`, not live React source. |
| Demo setup refuses an existing database | It has no valid synthetic-only marker. Do not delete or relabel it blindly: first investigate its contents and obtain approval. |
