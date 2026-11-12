# ZELVORA — Presentation Runbook (Free, No Pingers)

**Purpose:** Keep the college presentation smooth for 30–60 minutes using only free services and a local backup.
No paid plans, no payment method, no uptime-pinging service.

## 1. What Render Free actually does

1. **The whole service sleeps, not just the API.** The React build is served by the same Python container, so
   the entire website is unavailable while asleep. Render's edge still answers and shows a loading page.
2. **The URL still works.** Opening it wakes the service automatically; DNS and HTTPS stay valid.
3. **Wake time:** about 1 minute per Render's documentation; allow up to ~2 minutes if TiDB is also waking.
4. **Presentation risk:** only if there is a gap of **more than 15 minutes with no request**. Continuous use
   (clicks, navigation, logins) keeps it awake. The risky moments are the start and long talking segments.
5. **Legitimate free options:** natural interaction every <15 minutes, a 5–10 minute warm-up before presenting,
   and the local backup below. Third-party pingers and 24/7 keep-awake are excluded: they violate the stated
   constraint, and always-on use would consume most of the 750 free instance hours and risk suspension.
6. **Reliable plan:** warmed live site as primary, local full stack as instant fallback, screenshots as last resort.

## 2. Options compared

| Option | Cost | Limitations | Reliability |
|---|---|---|---|
| **Live Render + TiDB** | $0 | Sleeps after 15 idle min; ~1–2 min wake; 512 MB; free quotas | High if warmed and used regularly |
| **Local full stack** (Python + MySQL + built React) | $0 | Runs on the presentation laptop; separate demo data | Very high; no network or sleep dependency |
| **Live primary + local fallback** | $0 | Requires 2 tabs and a pre-start check | **Highest** — recommended |
| Third-party keep-awake ping | $0 | Excluded by owner; risks account/quota | Not used |
| Render paid plan | Paid | Excluded by owner | Not used |
| Screenshots / recording | $0 | Not interactive | Last-resort proof only |

## 3. Before the presentation (10 minutes early)

1. Start the local backup: run `powershell -ExecutionPolicy Bypass -File scripts\present-local.ps1`.
   It installs dependencies and builds on first run, checks MySQL, provisions the isolated demo DB and serves
   everything at **http://127.0.0.1:8000/** (it automatically uses 8010/8020 if 8000 is busy). The browser opens
   only after the server answers.
2. Open the live site **https://zelvora-sg9w.onrender.com** and log in once as the customer, then as the admin.
   This warms the service. If it shows Render's loading page, wait up to 2 minutes — that is the normal cold start.
3. Keep both tabs open: live site first, local site second.
4. Do a 30-second dry run: open a vehicle, check availability, and return.

## 4. During the presentation

- Use the live site normally. Any click at least every ~10 minutes keeps it awake.
- If a page stalls on Render's loading screen, wait ~60 seconds; do not spam refresh.
- If it does not recover within ~2 minutes, switch to the local tab and continue the same flow.
- Do the whole demo in one environment. Live and local use separate demo databases, so a booking created
  live will not appear locally.

## 5. Demo credentials (public, synthetic)

- Customer: `demo.customer@zelvora.example` / `ZelvoraDemo#2026`
- Admin: `demo.admin@zelvora.example` / `ZelvoraAdmin#2026`

## 6. Local backup details

- Script: `scripts/present-local.ps1`
- URL: `http://127.0.0.1:8000/` (falls back to `8010`, `8020` or `8030` if a port is busy)
- Database: isolated `zelvora_demo_db`; the owner's private database is never touched.
- Each start clears previous **local** demo bookings (and restarts booking numbers at #1) so a rehearsal cannot
  block the real demo with overlapping dates. The live database and its bookings are never touched.
- Stop it with `Ctrl+C` in its terminal. Closing a browser tab can print a harmless `ConnectionAbortedError`
  traceback in that terminal; it does not affect the running server.
- If MySQL is not running, start the MySQL service and run the script again.
- Verified on this laptop: all 9 browser checks pass against the local server, including booking and approval.
