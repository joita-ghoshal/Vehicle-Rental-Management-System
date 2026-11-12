# ZELVORA — Phase 6 Browser QA Report

**Status: Completed — final Chrome and Edge browser QA passed (12 November 2026).**

The owner's revised instruction delegates manual-style acceptance QA to the agent. No owner clicking or
manual verification is required. Phase 7, GitHub pushes and deployment are not authorized by this work.

## Method and safety

- Actual installed Chrome/Edge controlled through the existing external Playwright installation.
- Separate anonymous, Demo Customer, full-control Main Admin and synthetic registration/customer contexts.
- All successful account/profile/fleet/booking/payment actions originate in browser clicks and forms, reach
  the real Python API and persist in `zelvora_demo_db`. No frontend success response is fabricated.
- MySQL evidence is read independently with `backend/qa_phase6.py inspect`. Cleanup uses exact vehicle ID,
  `P6 <run>` registration, user ID and reserved email, with identity checks; no broad database reset.
- Intentional fault cases abort requests or delay real traffic, then release/retry against the real API.
  Their expected browser errors are kept separate from unexpected console/network errors.
- No private database rows/password, approved palette, dependency version or production config is changed.

## Complete route inventory

Dynamic IDs denote route templates, not an assertion that every conceivable record/state was tested.

| Route | Role/context | Route-specific interactive controls and states |
|---|---|---|
| `/` | Anonymous/customer/admin | Explore vehicles; Create an account; hero vehicle link; name/brand input; category select (all four choices); Find vehicles; three category tiles; See the full fleet; featured card image/Details/Book now links; Find your next ride; Try the demo; loading/error/retry |
| `/vehicles` | Anonymous/customer | All/Cars/Bikes/Scooters tabs; name/brand; sort (all three choices); min/max price; pickup/return; availability checkbox on/off; Apply filters; Clear all; every rendered card image/Details/Book now link; empty/validation/loading/error/retry |
| `/vehicles/:id` | Anonymous/customer | Vehicles breadcrumb; Book this vehicle; inactive/maintenance nonbookable state; confirmed booked ranges; missing-vehicle Back to vehicles; error/retry |
| `/about` | Anonymous | Find your next ride |
| `/contact` | Anonymous | Try the demo; contact information is intentionally text, not a real support form |
| `/login` | Anonymous | Email/password; Log in; Create an account; both Demo Customer/Main Admin Fill login form and Copy credentials; copy success/blocked fallback; Dismiss message; empty/malformed/wrong-password cases |
| `/register` | Anonymous/registration | Full name; email; phone; password; confirmation; Create account; Log in; empty/invalid/domain/duplicate/success cases |
| `/dashboard` | Customer | Browse vehicles; All my bookings; next-trip/empty states; booking counters; loading/error/retry |
| `/my-bookings` | Customer/two customers | Vehicle links; Cancel booking; cancellation dialog confirm/Keep as it is; message dismissal; Pending/Confirmed/Rejected/Cancelled/Completed/Paid/Unpaid states; loading/error/retry |
| `/profile` | Customer | Editable name/phone; Save changes; invalid/success/reload persistence; seeded profile restored through UI; email is not editable |
| `/book/:id` | Customer | Vehicles/vehicle breadcrumbs; pickup/return; Check availability; Confirm booking request; empty/past/reversed/overlong dates; inclusive one/two/three-day totals; availability conflict and duplicate submission; loading/error/retry |
| `/admin` | Main Admin | Manage all bookings; seven dashboard statistics compared with SQL; latest requests table focus/scroll; loading/error/retry |
| `/admin/vehicles` | Main Admin | Add vehicle; Show archived/Show active fleet; every rendered Edit link; every Archive button opened/cancelled; every status dropdown opened/selected; fixture status transitions and archive/restore; dialog confirm/cancel/Escape; alert dismiss; table focus/scroll; error/retry |
| `/admin/vehicles/new` | Main Admin | Name/brand/model/category/registration/fuel/transmission/seats/rate/status/image/description; every select option; Add vehicle; Cancel; empty/fractional/negative/unsafe image/duplicate validation; broken-image fallback |
| `/admin/vehicles/:id/edit` | Main Admin | All vehicle fields/dropdowns; Save changes; Cancel; Vehicles breadcrumb; persisted edit; image preview; loading/error/retry |
| `/admin/bookings` | Main Admin | All/Pending/Confirmed/Completed/Rejected/Cancelled tabs; Approve; Reject; Mark paid; Mark unpaid; Mark completed; reject/complete confirm and Keep as it is; conflict errors/dismiss; table focus/scroll; loading/error/retry |
| `/admin/customers` | Main Admin | Customer records/statistics (view-only by product design, not admin permission restriction); table focus/scroll; loading/error/retry |
| Unknown route (`/not-a-page`) | Anonymous | Back to home |

### Shared controls

- Skip to content: keyboard focus/activation.
- Header: ZELVORA home, Home, Vehicles, About, Contact, Log in/Create account, customer Dashboard/My bookings/
  Profile, Admin, Log out; mobile Open menu/Close menu, Escape dismissal and navigation collapse.
- Footer: Browse vehicles, About us, Contact, Log in.
- Admin navigation: Dashboard, Vehicles, Bookings, Customers.
- Tables: focusable internal horizontal scrolling at narrow widths; no document-level overflow.

## Evidence and counting rules

`frontend/tests/phase6.browser.cjs` writes **`results.json`** (DOM-discovered control inventory, executed
actions, actual response statuses, console/network/runtime events), **`interaction-results.md`** (one row
per executed action with role, route, element, action, expected, actual, Pass/Fail), **`mysql-evidence.json`**
and screenshots under `%LOCALAPPDATA%\Temp\opencode\zelvora-phase6\<browser>` by default.

Counts are logical controls, not unique DOM nodes across every repeated render: shared header/footer/admin
navigation and skip links are counted once; route-specific controls are counted by route, name and context;
repeated booking rows share a control template, while repeated fleet/card links retain their vehicle context.
Mutually exclusive booking branches use separate test bookings/customers. Every repeated seed-fleet Archive
button is opened and cancelled rather than altering unrelated seeded rows. Disabled busy-state controls are
not presumed clickable. Responsive observations/check-only assertions are actions, not extra control counts.
No blanket 100% application/state-space coverage is claimed.

## Confirmed issue and fix

**BUG-33 — Archive remains enabled during an inline status save (medium).**

1. Change a vehicle's inline status while the real PUT request is delayed/in flight.
2. Archive was still enabled, allowing a new dialog to open.
3. The status update's completion path clears `target`, unexpectedly closing that dialog.
4. `ManageVehicles.jsx` now disables Archive while `busy`, matching the existing status/restore guards.
5. The new browser regression holds a real PUT and asserts Archive stays disabled until completion.

The pre-fix assertion failed (`false !== true`); its log is retained as
`%LOCALAPPDATA%\Temp\opencode\zelvora-phase6-bug33-before.log`. Final retest passed in both Chrome and Edge:
action 114 holds a real PUT in flight and asserts Archive stays disabled until completion.

Test-harness corrections are not counted as application bugs: wait for React effect-triggered requests before
asserting result counts; distinguish labelled informational regions from focusable table scroll regions;
honor the intentional 13.6px compact-select font rather than inventing a WCAG 14px minimum; use two customers
for competing pending requests because one customer's duplicate request is correctly rejected. Three further
harness-only corrections were made during finalization: wait out a transient protected-page loader before
responsive geometry assertions; bound the pending-request wait so an OS-suspended request cannot hang the
runner (it now fails with the stalled URL); and key the Home category tiles by their stable heading so their
brief `Loading`/`Explore collection` states are not counted as extra logical controls.

The earlier interrupted run captured Chromium `ERR_NETWORK_IO_SUSPENDED` events (the machine's network stack
was suspended); that was environmental, not an application defect. Its exact synthetic vehicle/user/bookings
were identity-checked and removed before the final runs.

## Remaining limits

- Desktop/mobile/tablet viewport automation is not a physical-device or full accessibility certification.
- Chrome and Edge share Chromium; Firefox/Safari/WebKit are not claimed tested.
- Sessions remain process-local; backend restart requires login again.
- Existing dependency advisories, production hosting/auth/session hardening and real owner-password
  verification are outside local Phase 6. No push/deployment or Phase 7 work occurs here.
- No blanket 100% state-space coverage is claimed: the inventory covers the documented logical controls and
  the executed real workflows, not every conceivable record combination.

## Final results

Both final runs completed with the full 18-route inventory, real customer/admin/MySQL workflows, responsive
360/768/1440 checks, keyboard/menu/dialog checks, injected loading/error/retry paths, asset checks and route
authority checks.

| Evidence | Chrome 5.4.21 dev (5173) | Edge production preview (4173) |
|---|---|---|
| Executed actions | **531/531 pass** | **531/531 pass** |
| Logical controls | **247/247 tested** (0 untested) | **247/247 tested** (0 untested) |
| Routes | **18** | **18** |
| Runtime exceptions | **0** | **0** |
| Unexpected console errors | **0** (34 expected fault-injection events) | **0** (22 expected) |
| Unexpected network failures | **0** (34 expected) | **0** (22 expected) |

BUG-33's browser regression passed in both runs (action 114). MySQL evidence was read independently; all
fixture rows were cleaned by exact identity and the demo audit returned to **2 synthetic users / 12 vehicles /
0 bookings**. The private database ordered-row fingerprint was **identical before and after** Phase 6
(**5 users / 12 vehicles / 1 booking**, including the unchanged owner hash).

Supporting checks: `python demo.py regression` **86/86**, `python demo.py test` **125/125**,
`python demo.py phase3` **47/47**, `python -m unittest test_demo_safety -v` **9/9**,
`python demo.py phase5` **5/5**, `npm test` **15/15**, `npm run build` **71 modules**
(233.70 kB JS / 40.60 kB CSS), Python compilation, browser-script syntax and `git diff --check` pass
(Git's LF/CRLF warnings are not whitespace failures).

Artifacts: `%LOCALAPPDATA%\Temp\opencode\zelvora-phase6\chrome` and `...\msedge-preview` contain
`results.json`, `interaction-results.md`, `mysql-evidence.json` and screenshots;
`zelvora-phase6-integrity.txt` records the private fingerprint comparison. Phase 6 is complete; Phase 7
requires separate explicit owner approval.
