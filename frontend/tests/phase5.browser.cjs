// Reuses the existing external Playwright installation; never installs packages.
// All writes require the isolated demo API and use individually tracked fixtures.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BASE = (process.env.ZELVORA_BROWSER_URL || 'http://127.0.0.1:5173/Vehicle-Rental-Management-System').replace(/\/$/, '')
const origin = new URL(BASE).origin
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname), 'Local tests only')
const channel = process.env.ZELVORA_BROWSER_CHANNEL || 'chrome'
const artifacts = process.env.ZELVORA_ARTIFACT_DIR || path.join(process.env.LOCALAPPDATA, 'Temp/opencode/zelvora-phase5', channel)
let checks = 0
const results = []
function check(name, condition = true) {
  assert.ok(condition, name)
  results.push(name)
  console.log(`PASS ${++checks} ${name}`)
}
function date(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

;(async () => {
  await fs.mkdir(artifacts, { recursive: true })
  const browser = await chromium.launch({ channel, headless: true })
  const contexts = await Promise.all([0, 1].map(() => browser.newContext({ viewport: { width: 1440, height: 1000 } })))
  const [customer, admin] = contexts
  const [page, desk] = await Promise.all(contexts.map(c => c.newPage()))
  const runtimeErrors = [], consoleErrors = [], badResponses = [], failedRequests = []
  let faults = false, vehicleId, userId, release
  const run = Date.now()
  const email = `phase5.${run}@test.local`, password = 'SyntheticOnly123'
  const vehicleName = `TEST Phase5 ${run}`
  for (const p of [page, desk]) {
    p.on('pageerror', e => runtimeErrors.push(e.message))
    p.on('console', m => { if (!faults && m.type() === 'error') consoleErrors.push(m.text()) })
    p.on('response', r => { if (!faults && r.url().startsWith(origin) && r.status() >= 400) badResponses.push(`${r.status()} ${new URL(r.url()).pathname}`) })
    p.on('requestfailed', r => { if (!faults && r.url().startsWith(origin) && !r.failure()?.errorText.includes('ERR_ABORTED')) failedRequests.push(r.url()) })
  }
  async function api(context, method, endpoint, data) {
    const r = await context.request.fetch(origin + endpoint, { method, data, headers: { 'X-Requested-With': 'ZELVORA' } })
    assert.ok(r.ok(), `${method} ${endpoint}: ${r.status()} ${await r.text()}`)
    return r.json()
  }
  async function responseAfter(p, action, suffix, method = 'POST', status = 200) {
    const waiting = p.waitForResponse(r => new URL(r.url()).pathname === suffix && r.request().method() === method)
    await action()
    const r = await waiting
    assert.equal(r.status(), status, `${method} ${suffix}: ${await r.text()}`)
    return r.json()
  }
  async function login(p, address, secret) {
    await p.goto(BASE + '/login')
    await p.locator('#email').fill(address)
    await p.locator('#password').fill(secret)
    await p.getByRole('button', { name: 'Log in', exact: true }).click()
  }
  const row = id => desk.getByRole('row').filter({ has: desk.getByRole('cell', { name: `#${id}`, exact: true }) })
  const card = id => page.locator('.booking-card').filter({ hasText: `Booking #${id}.` })
  async function book(offset) {
    await page.goto(`${BASE}/book/${vehicleId}`)
    await page.locator('#pickup').fill(date(offset))
    await page.locator('#ret').fill(date(offset + 1))
    await page.getByRole('button', { name: 'Check availability' }).click()
    await page.locator('.quote').waitFor()
    check('Authoritative two-inclusive-day quote and Pay at Pickup', (await page.locator('.quote').innerText()).includes('2,469.12') && (await page.locator('.quote').innerText()).includes('Pay at Pickup'))
    const data = await responseAfter(page, () => page.getByRole('button', { name: 'Confirm booking request' }).click(), '/api/bookings', 'POST', 201)
    await page.waitForURL(BASE + '/my-bookings')
    await card(data.booking.id).getByText('Pending', { exact: true }).waitFor()
    return data.booking.id
  }
  try {
    const demo = await api(customer, 'GET', '/api/demo/credentials')
    assert.ok(demo.enabled && demo.accounts.length === 2, 'Require synthetic demo before writes')
    const main = demo.accounts.find(a => a.role === 'admin')
    await login(desk, main.email, main.password)
    await desk.waitForURL(BASE + '/admin')
    const before = await api(admin, 'GET', '/api/admin/dashboard')
    const fixture = await api(admin, 'POST', '/api/admin/vehicles', {
      name: vehicleName, brand: 'Synthetic', model: 'P5', category: 'Car', registration_number: `P5 ${run}`,
      fuel_type: 'Petrol', transmission: 'Manual', seats: 5, price_per_day: '1234.56',
      image_url: '/images/car-sedan.svg', description: 'Synthetic temporary Phase 5 fixture.', status: 'Active',
    })
    vehicleId = fixture.vehicle.id
    await page.goto(BASE + '/register')
    for (const [id, value] of Object.entries({ name: 'TEST Phase5 Customer', email, phone: '9000000000', password, confirm_password: password })) await page.locator(`#${id}`).fill(value)
    const registered = await responseAfter(page, () => page.getByRole('button', { name: 'Create account', exact: true }).click(), '/api/auth/register', 'POST', 201)
    userId = registered.user.id
    await page.waitForURL(BASE + '/dashboard')
    check('Registration creates a synthetic customer with a real MySQL session', registered.user.role === 'customer')
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.waitForURL(BASE + '/')

    faults = true
    await page.goto(BASE + '/register')
    for (const [id, value] of Object.entries({ name: 'TEST Duplicate', email, phone: '9000000000', password, confirm_password: password })) await page.locator(`#${id}`).fill(value)
    await responseAfter(page, () => page.getByRole('button', { name: 'Create account', exact: true }).click(), '/api/auth/register', 'POST', 409)
    check('Duplicate email is shown as a field error', await page.locator('#email').getAttribute('aria-invalid') === 'true')
    await login(page, email, 'WrongPassword123')
    await page.getByText('Incorrect email or password.', { exact: true }).waitFor()
    check('Invalid credentials leave a usable login form', await page.getByRole('button', { name: 'Log in', exact: true }).isEnabled())
    await page.waitForLoadState('networkidle')
    faults = false
    await login(page, email, password)
    await page.waitForURL(BASE + '/dashboard')
    await page.reload()
    await page.getByRole('heading', { name: 'Welcome, TEST', exact: true }).waitFor()
    check('Registered customer logs in and survives reload')
    await page.goto(BASE + '/profile')
    await page.locator('#name').fill('TEST Phase5 Updated')
    await page.locator('#phone').fill('9000000099')
    await responseAfter(page, () => page.getByRole('button', { name: 'Save changes' }).click(), '/api/profile', 'PUT')
    await page.reload()
    check('Profile edits persist in MySQL across reload', await page.locator('#name').inputValue() === 'TEST Phase5 Updated' && await page.locator('#phone').inputValue() === '9000000099')
    await page.goto(BASE + '/admin/customers')
    await page.waitForURL(BASE + '/dashboard')
    check('Customer cannot navigate to admin records')
    await page.goto(BASE + '/vehicles')
    await page.locator('#q').fill(vehicleName)
    await page.locator('#min_price').fill('1234')
    await page.locator('#max_price').fill('1235')
    await page.locator('#sort').selectOption('price_asc')
    await page.getByRole('button', { name: 'Cars', exact: true }).click()
    // Category changes intentionally reset unapplied filter edits; apply after it.
    await page.locator('#q').fill(vehicleName)
    await page.locator('#min_price').fill('1234')
    await page.locator('#max_price').fill('1235')
    await page.locator('#sort').selectOption('price_asc')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await page.getByText('1 vehicle found', { exact: true }).waitFor()
    check('Search/category/price/sort integrate with the real catalog', await page.locator('.vcard').count() === 1 && page.url().includes('price_asc'))
    await page.locator('.vcard').getByRole('link').first().click()
    await page.waitForURL(`${BASE}/vehicles/${vehicleId}`)
    check('Catalog opens details with a working image', await page.locator('.detail-image img').evaluate(i => i.complete && i.naturalWidth > 0))

    await page.goto(`${BASE}/book/${vehicleId}`)
    await page.locator('#pickup').fill(date(10))
    await page.locator('#ret').fill(date(9))
    await page.getByRole('button', { name: 'Check availability' }).click()
    check('Return-before-pickup is associated with the date field', await page.locator('#ret').getAttribute('aria-invalid') === 'true')
    await page.locator('#ret').fill(date(11))
    let intercepted
    const started = new Promise(resolve => { intercepted = resolve })
    const pending = new Promise(resolve => { release = resolve })
    await page.route('**/availability?**', async route => {
      const response = await route.fetch()
      intercepted()
      await pending
      await route.fulfill({ response })
    })
    await page.getByRole('button', { name: 'Check availability' }).click()
    await started
    await page.locator('#ret').fill(date(12))
    release()
    release = null
    await page.unrouteAll({ behavior: 'wait' })
    await page.getByRole('button', { name: 'Check availability' }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('.book-form form button')?.disabled)
    check('A delayed availability response cannot quote newly edited dates', await page.locator('.quote').count() === 0)

    const completed = await book(20)
    const cancelled = await book(30)
    const rejected = await book(40)
    await desk.goto(BASE + '/admin/bookings')
    await responseAfter(desk, () => row(completed).getByRole('button', { name: 'Approve', exact: true }).click(), `/api/admin/bookings/${completed}/approve`)
    await row(completed).getByText('Confirmed', { exact: true }).waitFor()
    await page.reload()
    await card(completed).getByText('Confirmed', { exact: true }).waitFor()
    check('Admin approval is visible in the customer history')
    await page.goto(`${BASE}/book/${vehicleId}`)
    await page.locator('#pickup').fill(date(20))
    await page.locator('#ret').fill(date(21))
    await page.getByRole('button', { name: 'Check availability' }).click()
    await page.getByText('This vehicle is already booked for some of these dates.', { exact: true }).waitFor()
    check('Confirmed overlap hides booking confirmation', await page.locator('.quote').count() === 0)
    await page.goto(BASE + '/vehicles')
    await page.locator('#q').fill(vehicleName)
    await page.locator('#pickup').fill(date(20))
    await page.locator('#return').fill(date(21))
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await page.getByRole('heading', { name: 'No vehicles match', exact: true }).waitFor()
    check('Date-availability filter excludes a confirmed conflict')
    await page.locator('#pickup').fill(date(25))
    await page.locator('#return').fill(date(26))
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await page.getByText('1 vehicle found', { exact: true }).waitFor()
    check('Changing to free dates restores the matching vehicle')
    await page.goto(BASE + '/my-bookings')
    await card(cancelled).getByRole('button', { name: 'Cancel booking' }).click()
    await responseAfter(page, () => page.getByRole('dialog').getByRole('button', { name: 'Cancel booking', exact: true }).click(), `/api/bookings/${cancelled}/cancel`)
    await card(cancelled).getByText('Cancelled', { exact: true }).waitFor()
    check('Customer cancellation persists and removes the cancel action', await card(cancelled).getByRole('button').count() === 0)
    await row(rejected).getByRole('button', { name: 'Reject', exact: true }).click()
    await responseAfter(desk, () => desk.getByRole('dialog').getByRole('button', { name: 'Reject booking' }).click(), `/api/admin/bookings/${rejected}/reject`)
    await row(rejected).getByText('Rejected', { exact: true }).waitFor()
    await responseAfter(desk, () => row(completed).getByRole('button', { name: 'Mark paid' }).click(), `/api/admin/bookings/${completed}/payment`, 'PUT')
    await row(completed).getByText('Paid', { exact: true }).waitFor()
    await row(completed).getByRole('button', { name: 'Mark completed' }).click()
    await responseAfter(desk, () => desk.getByRole('dialog').getByRole('button', { name: 'Mark completed' }).click(), `/api/admin/bookings/${completed}/complete`)
    await row(completed).getByText('Completed', { exact: true }).waitFor()
    await page.reload()
    await card(completed).getByText('Completed', { exact: true }).waitFor()
    await card(completed).getByText('Paid', { exact: true }).waitFor()
    await card(rejected).getByText('Rejected', { exact: true }).waitFor()
    const after = await api(admin, 'GET', '/api/admin/dashboard')
    check('Rejection/completion/payment reach the customer and completed-only revenue', after.summary.completed_revenue === before.summary.completed_revenue + 2469.12)
    await page.screenshot({ path: path.join(artifacts, 'customer-history.png'), fullPage: true })

    faults = true
    await page.route('**/api/vehicles', route => route.abort('connectionrefused'))
    await page.goto(BASE + '/vehicles')
    await page.getByText('Cannot reach the server. Check that the Python backend is running.', { exact: true }).waitFor()
    check('Transport failure shows retry instead of crashing', await page.getByRole('button', { name: 'Try again' }).isVisible())
    await page.unrouteAll({ behavior: 'wait' })
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.locator('.vcard').first().waitFor()
    check('Transport recovery reloads real MySQL vehicles')
    await page.route('**/api/vehicles', route => route.fulfill({ status: 503, json: { error: 'The database is temporarily unavailable. Please try again later.' } }))
    await page.reload()
    await page.getByText('The database is temporarily unavailable. Please try again later.', { exact: true }).waitFor()
    await page.unrouteAll({ behavior: 'wait' })
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.locator('.vcard').first().waitFor()
    check('Database-503 UI recovers without losing the customer session', (await api(customer, 'GET', '/api/auth/me')).user.id === userId)

    await page.route('**/api/auth/logout', route => route.abort('connectionrefused'))
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Could not log out.' }).waitFor()
    check('Failed logout remains visibly signed in rather than pretending to revoke the cookie', await page.getByRole('button', { name: 'Log out', exact: true }).isVisible())
    await page.screenshot({ path: path.join(artifacts, 'logout-retry.png'), fullPage: true })
    await page.reload()
    await page.getByRole('button', { name: 'Log out', exact: true }).waitFor()
    check('Failed logout accurately reflects the still-valid server session on reload')
    await page.unrouteAll({ behavior: 'wait' })
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.waitForURL(BASE + '/')
    check('Retry logout revokes the real backend session', (await api(customer, 'GET', '/api/auth/me')).user === null)
    await login(page, email, password)
    await page.waitForURL(BASE + '/dashboard')
    // Revoke the real server token out of band, as happens on session expiry.
    // Unit/HTTP tests separately verify exact eight-hour expiry.
    await api(customer, 'POST', '/api/auth/logout')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My bookings' }).click()
    await page.waitForURL(BASE + '/login')
    check('A protected API 401 clears stale React identity and returns to login', await page.getByRole('heading', { name: 'Welcome back' }).isVisible())
    await login(page, email, password)
    await page.waitForURL(BASE + '/my-bookings')
    check('Reauthentication restores the originally requested protected page')
    await page.waitForLoadState('networkidle')
    faults = false
    check('No React runtime errors, including failure scenarios', runtimeErrors.length === 0)
    if (consoleErrors.length || badResponses.length || failedRequests.length) console.error({ consoleErrors, badResponses, failedRequests })
    check('Normal workflow has no console errors or failed local HTTP requests', consoleErrors.length === 0 && badResponses.length === 0 && failedRequests.length === 0)
    await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ base: BASE, channel, checks, results, runtimeErrors, consoleErrors, badResponses, failedRequests }, null, 2))
    console.log(`\n${checks}/${checks} Phase 5 browser checks passed (${channel})`)
  } finally {
    if (release) release()
    await Promise.all([page, desk].map(p => p.unrouteAll({ behavior: 'wait' })))
    await browser.close()
    if (vehicleId || userId) {
      const cleanup = spawnSync('python', ['-c', `from database import transaction
from demo_safety import require_demo_database
import sys
require_demo_database()
v,u=int(sys.argv[1]),int(sys.argv[2])
with transaction() as c:
 if v:
  c.execute("SELECT name FROM vehicles WHERE id=%s",(v,)); r=c.fetchone(); assert r and r['name']==sys.argv[3]
  c.execute("DELETE FROM bookings WHERE vehicle_id=%s",(v,))
  c.execute("DELETE FROM vehicles WHERE id=%s",(v,))
 if u:
  c.execute("SELECT email FROM users WHERE id=%s",(u,)); r=c.fetchone(); assert r and r['email']==sys.argv[4]
  c.execute("DELETE FROM bookings WHERE user_id=%s",(u,))
  c.execute("DELETE FROM users WHERE id=%s",(u,))
`, String(vehicleId || 0), String(userId || 0), vehicleName, email], {
        cwd: path.resolve(__dirname, '../../backend'), env: { ...process.env, ZELVORA_DB_NAME: 'zelvora_demo_db', ZELVORA_DEMO_MODE: '1' }, encoding: 'utf8',
      })
      assert.equal(cleanup.status, 0, cleanup.stderr)
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
