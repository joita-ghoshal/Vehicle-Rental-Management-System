// Human-style UI QA. Existing external Playwright + installed browser only.
// Success paths use actual UI -> Python -> MySQL, not frontend success mocks.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const BASE = (process.env.ZELVORA_BROWSER_URL || 'http://127.0.0.1:5173/Vehicle-Rental-Management-System').replace(/\/$/, '')
const origin = new URL(BASE).origin, prefix = new URL(BASE).pathname
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname))
const channel = process.env.ZELVORA_BROWSER_CHANNEL || 'chrome'
const out = process.env.ZELVORA_ARTIFACT_DIR || path.join(process.env.LOCALAPPDATA, 'Temp/opencode/zelvora-phase6', channel)
const run = Date.now(), registration = `P6 ${run}`, email = `phase6.${run}@test.local`
const password = 'SyntheticOnly123', name = `TEST Phase6 ${run}`
const actions = [], inventory = new Map(), pagesVisited = new Set(), responses = [], runtimeErrors = [], consoleErrors = [], networkFailures = []
let browser, contexts, anon, customer, admin, signup, vehicleId = 0, userId = 0, originalProfile, profileChanged = false, expectedFailure = false, fatalError = null
const role = p => p._qaRole
const route = p => (new URL(p.url()).pathname.slice(prefix.length) || '/').replace(/\/\d+(?=\/|$)/g, '/:id')
const date = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const pause = async p => {
  // Await real API request completion and React effects, not a fixed 500ms
  // network-idle delay at every input/click (which inflated full inventory runs).
  // Multiple paint cycles cover auth -> protected-page nested effects.
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const pending = [...(p._qaPending?.values() || [])].map(item => item.promise)
    if (pending.length) await Promise.race([Promise.all(pending), sleep(15000)])
  }
  const stalled = [...(p._qaPending?.keys() || [])].map(request => request.url())
  if (stalled.length) throw new Error('Stalled API request(s): ' + stalled.join(', '))
  await p.waitForFunction(() => !document.querySelector('.skeleton-preview'))
}
const visible = p => p.locator('a[href],button,input,select,textarea,[tabindex="0"]').filter({ visible: true })

// The same function identifies both inventoried controls and acted-on controls.
function describe(el) {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim()
  const region = el.classList.contains('skip-link') ? 'Skip link' : el.closest('header') ? 'Header' : el.closest('footer') ? 'Footer' : el.closest('nav[aria-label="Admin"]') ? 'Admin navigation' : el.closest('dialog') ? 'Dialog ' + clean(el.closest('dialog').querySelector('h3')?.textContent) : 'Main'
  const group = el.closest('.demo-card,.booking-card,.vcard,tbody tr,.alert')
  const context = group?.matches('.demo-card') ? clean(group.querySelector('h3')?.textContent) : group?.matches('.booking-card') ? group.innerText.match(/Booking #\d+/)?.[0] : group?.matches('.vcard') ? clean(group.querySelector('h3')?.textContent) : group?.matches('tr') ? clean(group.querySelector('td strong')?.textContent || group.querySelector('td')?.textContent) : group?.matches('.alert') ? group.className : ''
  let name = clean(el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.id || el.textContent || el.getAttribute('href'))
  if (name === 'Copied') name = 'Copy credentials'
  // A category tile shows a transient "Loading"/"Explore collection" count
  // before the fleet request settles. It is the same logical link, so key it
  // by its stable heading instead of counting each transient state separately.
  if (el.matches('.category-tile')) name = clean(el.querySelector('h3')?.textContent)
  return { tag: el.tagName.toLowerCase(), name, region, context: context || '', href: el.getAttribute('href') || '', disabled: !!el.disabled }
}
function key(p, item) {
  // Component-level inventory: shared chrome is counted once, repeated booking
  // rows share a control template. Actual row IDs/actions remain in the event log.
  const context = item.context.replace(/^#\d+$/, '#:booking').replace(/^Booking #\d+$/, 'Booking #:id')
  return JSON.stringify([item.region === 'Main' || item.region.startsWith('Dialog') ? route(p) : '*', item.region, item.tag, context, item.name, item.href])
}
async function scan(p) {
  pagesVisited.add(route(p))
  for (const item of await visible(p).evaluateAll((els, source) => els.map(el => (0, eval)('(' + source + ')')(el)), describe.toString())) {
    if (item.disabled) continue // busy/disabled states are verified separately, not clickable controls
    const k = key(p, item)
    if (!inventory.has(k)) inventory.set(k, { key: k, role: role(p), route: route(p), ...item, tested: false })
  }
}
async function step(p, element, action, expected, work, locator) {
  await scan(p)
  let item, k
  if (locator) {
    item = await locator.evaluate(describe)
    k = key(p, item)
    if (!inventory.has(k)) inventory.set(k, { key: k, role: role(p), route: route(p), ...item, tested: false })
  }
  const entry = { id: actions.length + 1, role: role(p), route: route(p), element, action, expected }
  try {
    const actual = await work()
    entry.actual = actual || expected
    entry.result = 'PASS'
    if (k) inventory.get(k).tested = true
    console.log(`PASS ${entry.id} ${entry.route} | ${element} | ${action}`)
  } catch (error) {
    entry.actual = error.message
    entry.result = 'FAIL'
    await p.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {})
    throw error
  } finally { actions.push(entry) }
}
async function click(p, locator, expected, verify = async () => {}) {
  const label = (await locator.evaluate(describe)).name
  return step(p, label, 'Click', expected, async () => { await locator.click(); await verify(); await pause(p) }, locator)
}
async function fill(p, id, value) {
  const field = p.locator('#' + id)
  await step(p, id, 'Fill (synthetic; password redacted)', 'Input accepts the supplied value', async () => { await field.fill(value); assert.equal(await field.inputValue(), value) }, field)
}
async function select(p, locator, value) {
  await step(p, (await locator.evaluate(describe)).name, `Select ${value}`, 'Selected value is retained', async () => { await locator.selectOption(value); assert.equal(await locator.inputValue(), value); await pause(p) }, locator)
}
async function go(p, url) { await p.goto(BASE + url); await pause(p); await scan(p) }
const button = (p, name) => p.getByRole('button', { name, exact: true })
async function requestClick(p, locator, endpoint, method = 'POST', status = 200, after = async () => {}) {
  let result
  await step(p, (await locator.evaluate(describe)).name, 'Click and observe actual Python response', `${method} ${endpoint} -> ${status}`, async () => {
    const waiting = p.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.request().method() === method)
    await locator.click()
    const response = await waiting
    assert.equal(response.status(), status, await response.text())
    result = await response.json()
    await after(result)
    await pause(p)
    return `Real HTTP ${response.status()}; postcondition verified`
  }, locator)
  return result
}
async function dismiss(p) {
  while (await button(p, 'Dismiss message').count()) {
    await click(p, button(p, 'Dismiss message').first(), 'Message is dismissed', async () => {})
  }
}
async function login(p, account, target) {
  await go(p, '/login')
  await fill(p, 'email', account.email)
  await fill(p, 'password', account.password)
  await requestClick(p, button(p, 'Log in'), '/api/auth/login', 'POST', 200, async () => p.waitForURL(BASE + target))
}
async function logout(p) { await requestClick(p, button(p, 'Log out'), '/api/auth/logout', 'POST', 200, async () => p.waitForURL(BASE + '/')) }
function sql(command = 'inspect') {
  const r = spawnSync('python', ['qa_phase6.py', command, '--vehicle', String(vehicleId), '--registration', registration, '--user', String(userId), '--email', email], {
    cwd: path.resolve(__dirname, '../../backend'), env: { ...process.env, ZELVORA_DEMO_MODE: '1', ZELVORA_DB_NAME: 'zelvora_demo_db' }, encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  return command === 'inspect' ? JSON.parse(r.stdout) : r.stdout
}
const bookingRow = id => admin.getByRole('row').filter({ has: admin.getByRole('cell', { name: `#${id}`, exact: true }) })
const bookingCard = id => customer.locator('.booking-card').filter({ hasText: `Booking #${id}.` })
const vehicleRow = () => admin.getByRole('row').filter({ has: admin.getByText(name, { exact: true }) })
async function waitCard(id, status) { await bookingCard(id).getByText(status, { exact: true }).waitFor() }
async function book(offset, days = 2, p = customer, expectedStatus = 201) {
  await go(p, `/book/${vehicleId}`)
  await fill(p, 'pickup', date(offset))
  await fill(p, 'ret', date(offset + days - 1))
  await requestClick(p, button(p, 'Check availability'), `/api/vehicles/${vehicleId}/availability`, 'GET', 200, async data => {
    assert.equal(data.available, true)
    assert.equal(data.rental_days, days)
    assert.equal(data.total_amount, 1111 * days)
    await p.locator('.quote').waitFor()
    assert.ok((await p.locator('.quote').innerText()).includes('Pay at Pickup'))
  })
  const data = await requestClick(p, button(p, 'Confirm booking request'), '/api/bookings', 'POST', expectedStatus, async data => {
    if (expectedStatus === 201) {
      await p.waitForURL(BASE + '/my-bookings')
      await p.locator('.booking-card').filter({ hasText: `Booking #${data.booking.id}.` }).getByText('Pending', { exact: true }).waitFor()
    }
  })
  await dismiss(p)
  return data.booking?.id
}
async function modal(p, trigger, confirm, endpoint, method = 'POST', status = 200) {
  await click(p, trigger, 'Named modal opens', async () => p.getByRole('dialog').waitFor())
  await scan(p)
  return requestClick(p, p.getByRole('dialog').getByRole('button', { name: confirm, exact: true }), endpoint, method, status, async () => p.getByRole('dialog').waitFor({ state: 'hidden' }))
}
async function cancelModal(p, trigger) {
  await click(p, trigger, 'Dialog opens', async () => p.getByRole('dialog').waitFor())
  await click(p, p.getByRole('dialog').getByRole('button', { name: 'Keep as it is' }), 'Dialog closes without changing records', async () => p.getByRole('dialog').waitFor({ state: 'hidden' }))
}
async function stats() {
  const evidence = sql()
  await go(admin, '/admin')
  await step(admin, 'All seven dashboard statistics', 'Compare rendered values with independent MySQL SELECTs', 'Vehicle/customer/booking/status/revenue values match MySQL', async () => {
    const labels = { 'Total vehicles': 'total_vehicles', 'Total customers': 'total_customers', 'Total bookings': 'total_bookings', 'Pending bookings': 'pending_bookings', 'Confirmed bookings': 'confirmed_bookings', 'Completed bookings': 'completed_bookings', 'Completed rental revenue': 'completed_revenue' }
    for (const [label, key] of Object.entries(labels)) {
      const value = await admin.locator('.stat').filter({ has: admin.getByText(label, { exact: true }) }).locator('strong').innerText()
      assert.equal(Number(value.replace(/[^\d.]/g, '')), Number(evidence.summary[key]), label)
    }
  })
  await fs.writeFile(path.join(out, 'mysql-evidence.json'), JSON.stringify(evidence, null, 2))
}

// Click all route-specific links, plus shared navigation once per role. Repeated
// fleet/detail/history links are tested as actual rendered instances, not inferred.
async function links(p, url) {
  await go(p, url)
  const targets = await p.locator('a[href]').evaluateAll(els => els.map((el, index) => ({ index, href: el.getAttribute('href'), visible: !!el.getClientRects().length, skip: el.classList.contains('skip-link') })))
  for (const target of targets.filter(t => t.visible && !t.skip)) {
    await go(p, url)
    const link = p.locator('a[href]').nth(target.index)
    const item = await link.evaluate(describe), k = key(p, item)
    if (inventory.get(k)?.tested) continue
    const destination = new URL(target.href, BASE + '/').pathname
    let expected = destination
    const suffix = destination.slice(prefix.length)
    if (role(p) !== 'anonymous' && ['/login', '/register'].includes(suffix)) expected = prefix + (role(p) === 'admin' ? '/admin' : '/dashboard')
    if (role(p) === 'anonymous' && suffix.startsWith('/book/')) expected = prefix + '/login'
    await click(p, link, `Navigates to ${expected}`, async () => { await p.waitForURL(u => u.pathname === expected); await pause(p); assert.equal(await p.locator('h1').count(), 1) })
  }
}

async function responsive(p, url, width) {
  await p.setViewportSize({ width, height: 900 })
  await go(p, url)
  await p.locator('h1').waitFor()
  // A protected route can briefly render its loading skeleton after the auth
  // check and before the page data resolves. Wait for that state to clear so
  // the geometry assertions never run against a transient loader.
  await p.waitForFunction(() => !document.querySelector('.skeleton-preview'))
  for (const image of await p.locator('img:visible').all()) await image.scrollIntoViewIfNeeded()
  await p.waitForFunction(() => [...document.images].every(i => !i.getClientRects().length || (i.complete && i.naturalWidth > 0)))
  await step(p, `${width}px images/layout`, 'Scroll all images; inspect DOM geometry', 'One heading, intact 4:3 images, no document overflow, legible controls', async () => {
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.equal(await p.locator('h1').count(), 1)
    // The existing compact table select is .85rem (13.6px). There is no WCAG
    // 14px minimum; preserve that intentional style rather than invent a defect.
    assert.ok(await p.locator('input:visible,select:visible,textarea:visible').evaluateAll(els => els.every(el => parseFloat(getComputedStyle(el).fontSize) >= 13)))
    assert.ok(await p.locator('.vehicle-image').evaluateAll(els => els.every(el => { const r = el.getBoundingClientRect(); return !r.width || Math.abs(r.width/r.height-4/3)<.035 })))
  })
  if ([360, 1440].includes(width)) {
    await p.evaluate(() => scrollTo(0, 0))
    await p.screenshot({ path: path.join(out, `${route(p).replace(/[^a-z\d]/gi, '-') || 'home'}-${width}.png`), fullPage: true })
  }
  for (const region of await p.locator('.table-wrap[tabindex="0"]').all()) {
    await step(p, (await region.getAttribute('aria-label')) || 'Scrollable table', 'Focus and press ArrowRight', 'Table is keyboard-focusable and scrolls internally when required', async () => {
      const overflows = await region.evaluate(el => { el.scrollLeft = 0; return el.scrollWidth > el.clientWidth })
      await region.focus(); await p.keyboard.press('ArrowRight')
      assert.equal(await region.evaluate(el => el === document.activeElement), true)
      if (overflows) await p.waitForFunction(label => [...document.querySelectorAll('.table-wrap')].find(el => el.getAttribute('aria-label') === label)?.scrollLeft > 0, await region.getAttribute('aria-label'))
    }, region)
  }
}

async function failures(p, url, endpoint) {
  expectedFailure = true
  const match = u => u.pathname === endpoint
  await p.route(match, r => r.abort('connectionrefused'))
  try {
    await go(p, url)
    await p.getByRole('heading', { name: 'We could not load this', exact: true }).waitFor()
    await p.unroute(match)
    await click(p, button(p, 'Try again'), 'Retry obtains real Python/MySQL data', async () => { await p.getByRole('heading', { name: 'We could not load this', exact: true }).waitFor({ state: 'hidden' }); await pause(p) })
    // Error-specific detail-page link is a real link and is covered too.
  } finally { await p.unroute(match); await pause(p); expectedFailure = false }
}

async function loading(p, url, endpoint) {
  let release, started
  const held = new Promise(resolve => { release = resolve })
  const intercepted = new Promise(resolve => { started = resolve })
  const match = u => u.pathname === endpoint
  await p.route(match, async r => { started(); await held; await r.continue() })
  try {
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded' })
    await intercepted
    await step(p, 'Page loading state', 'Delay actual backend request, then release it', 'Visible labelled skeleton while pending; real data after release', async () => {
      await p.locator('.skeleton-preview').waitFor()
      assert.ok(await p.getByRole('status').filter({ has: p.locator('.skeleton-preview') }).isVisible())
    })
  } finally {
    release()
    await p.unrouteAll({ behavior: 'wait' })
    await pause(p)
  }
}

async function save() {
  const rows = [...inventory.values()]
  const summary = { base: BASE, channel, fatalError, pages: [...pagesVisited].sort(), pagesTested: pagesVisited.size, actionsPassed: actions.filter(r => r.result === 'PASS').length, actionsFailed: actions.filter(r => r.result === 'FAIL').length, controlsInventoried: rows.length, controlsTested: rows.filter(r => r.tested).length, untested: rows.filter(r => !r.tested), runtimeErrors, consoleErrors, networkFailures }
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ summary, actions, inventory: rows, responses }, null, 2))
  const escape = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  const table = '| # | Role | Route | Element | Action | Expected | Actual | Result |\n|---|---|---|---|---|---|---|---|\n' + actions.map(a => '| ' + [a.id, a.role, a.route, a.element, a.action, a.expected, a.actual, a.result].map(escape).join(' | ') + ' |').join('\n')
  await fs.writeFile(path.join(out, 'interaction-results.md'), '# Phase 6 executed browser interaction inventory\n\n' + table + '\n')
  console.log('SUMMARY ' + JSON.stringify({ ...summary, untested: summary.untested.length, consoleErrors: summary.consoleErrors.length, networkFailures: summary.networkFailures.length }))
}

;(async () => {
  await fs.mkdir(out, { recursive: true })
  const demo = await (await fetch(origin + '/api/demo/credentials')).json()
  assert.ok(demo.enabled && demo.accounts.length === 2, 'Isolated synthetic demo required before any writes')
  const account = r => demo.accounts.find(a => a.role === r)
  browser = await chromium.launch({ channel, headless: true, args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] })
  contexts = await Promise.all(['anonymous', 'customer', 'admin', 'registration'].map(() => browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' })))
  ;[anon, customer, admin, signup] = await Promise.all(contexts.map(async (c, i) => {
    const p = await c.newPage(); p._qaRole = ['anonymous', 'customer', 'admin', 'registration'][i]
    p._qaPending = new Map()
    p.on('request', r => {
      if (!r.url().startsWith(origin + '/api/')) return
      let resolve
      const promise = new Promise(done => { resolve = done })
      p._qaPending.set(r, { promise, resolve })
    })
    const finished = r => { p._qaPending.get(r)?.resolve(); p._qaPending.delete(r) }
    p.on('requestfinished', finished)
    p.on('requestfailed', finished)
    p.on('pageerror', e => runtimeErrors.push({ role: role(p), error: e.message }))
    p.on('console', m => { if (m.type() === 'error') consoleErrors.push({ role: role(p), expected: expectedFailure, message: m.text() }) })
    p.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) networkFailures.push({ expected: expectedFailure, status: r.status(), path: new URL(r.url()).pathname }); if (r.url().startsWith(origin + '/api/') && r.request().method() !== 'GET') responses.push({ method: r.request().method(), path: new URL(r.url()).pathname, status: r.status() }) })
    p.on('requestfailed', r => { if (r.url().startsWith(origin) && !r.failure()?.errorText.includes('ERR_ABORTED')) networkFailures.push({ expected: expectedFailure, error: r.failure()?.errorText, path: new URL(r.url()).pathname }) })
    return p
  }))
  try {
    // Anonymous navigation and every login/demo control.
    await go(anon, '/login')
    await click(anon, button(anon, 'Log in'), 'Empty fields show associated validation', async () => { assert.equal(await anon.locator('#email').getAttribute('aria-invalid'), 'true'); assert.equal(await anon.locator('#password').getAttribute('aria-invalid'), 'true') })
    await fill(anon, 'email', 'not-an-email')
    await fill(anon, 'password', 'WrongPassword123')
    await click(anon, button(anon, 'Log in'), 'Malformed email is rejected before HTTP', async () => assert.equal(await anon.locator('#email').getAttribute('aria-invalid'), 'true'))
    for (const r of ['customer', 'admin']) {
      const card = anon.locator('.demo-card').filter({ has: anon.getByRole('heading', { name: r === 'customer' ? 'Demo customer' : 'Main admin', exact: true }) })
      await click(anon, card.getByRole('button', { name: 'Fill login form' }), 'Correct public credentials fill the inputs', async () => { assert.equal(await anon.locator('#email').inputValue(), account(r).email); assert.equal(await anon.locator('#password').inputValue(), account(r).password) })
      await click(anon, card.getByRole('button', { name: 'Copy credentials' }), 'Clipboard contains that demo email and password', async () => { const text = await anon.evaluate(() => navigator.clipboard.readText()); assert.ok(text.includes(account(r).email) && text.includes(account(r).password)) })
      await dismiss(anon)
    }
    expectedFailure = true
    await fill(anon, 'email', account('customer').email); await fill(anon, 'password', 'WrongPassword123')
    await requestClick(anon, button(anon, 'Log in'), '/api/auth/login', 'POST', 401, async () => anon.getByText('Incorrect email or password.', { exact: true }).waitFor())
    expectedFailure = false
    await anon.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Blocked for QA') } } }))
    await click(anon, anon.locator('.demo-card').first().getByRole('button', { name: 'Copy credentials' }), 'Blocked clipboard gives a usable fallback message', async () => anon.getByText('Your browser blocked copying. Select the email and password and copy them manually.', { exact: true }).waitFor())
    await dismiss(anon)

    // Registration: every field + empty, malformed, domain, duplicate and success.
    await go(signup, '/register')
    await click(signup, button(signup, 'Create account'), 'Empty form shows field errors', async () => assert.equal(await signup.locator('[aria-invalid="true"]').count(), 4))
    for (const [id, value] of Object.entries({ name: 'X', email: 'bad', phone: '12', password: 'abc', confirm_password: 'mismatch' })) await fill(signup, id, value)
    await click(signup, button(signup, 'Create account'), 'Invalid name/email/phone/password/confirmation rejected', async () => assert.equal(await signup.locator('[aria-invalid="true"]').count(), 5))
    for (const [id, value] of Object.entries({ name: 'TEST Phase6 Customer', email: 'synthetic@gmail.com', phone: '9000000000', password, confirm_password: password })) await fill(signup, id, value)
    expectedFailure = true
    await requestClick(signup, button(signup, 'Create account'), '/api/auth/register', 'POST', 400)
    await fill(signup, 'email', account('customer').email)
    await requestClick(signup, button(signup, 'Create account'), '/api/auth/register', 'POST', 409)
    expectedFailure = false
    await fill(signup, 'email', email)
    const created = await requestClick(signup, button(signup, 'Create account'), '/api/auth/register', 'POST', 201, async () => signup.waitForURL(BASE + '/dashboard'))
    userId = created.user.id
    await logout(signup)
    await login(signup, { email, password }, '/dashboard')
    await logout(signup)

    await login(customer, account('customer'), '/dashboard')
    await logout(customer)
    await login(customer, account('customer'), '/dashboard')
    await login(admin, account('admin'), '/admin')
    await stats()
    originalProfile = await customer.evaluate(() => fetch('/api/auth/me').then(r => r.json()).then(d => ({ name: d.user.name, phone: d.user.phone })))
    await go(customer, '/profile')
    await fill(customer, 'name', 'X'); await fill(customer, 'phone', '12')
    await click(customer, button(customer, 'Save changes'), 'Name/phone errors shown', async () => assert.equal(await customer.locator('[aria-invalid="true"]').count(), 2))
    await fill(customer, 'name', 'TEST Phase6 Profile'); await fill(customer, 'phone', '9000000099')
    await requestClick(customer, button(customer, 'Save changes'), '/api/profile', 'PUT', 200); profileChanged = true
    await customer.reload(); await pause(customer)
    assert.equal(await customer.locator('#name').inputValue(), 'TEST Phase6 Profile')
    for (const [id, value] of Object.entries(originalProfile)) await fill(customer, id, value)
    await requestClick(customer, button(customer, 'Save changes'), '/api/profile', 'PUT', 200); profileChanged = false

    // Full-control admin vehicle form (all inputs and every select option).
    await go(admin, '/admin/vehicles/new')
    await click(admin, button(admin, 'Cancel'), 'Cancel returns to fleet without adding a vehicle', async () => admin.waitForURL(BASE + '/admin/vehicles'))
    await click(admin, admin.getByRole('link', { name: 'Add vehicle', exact: true }), 'Add form opens', async () => admin.waitForURL(BASE + '/admin/vehicles/new'))
    await click(admin, button(admin, 'Add vehicle'), 'Required fields show validation', async () => assert.ok(await admin.locator('[aria-invalid="true"]').count() >= 6))
    for (const [id, value] of Object.entries({ name, brand: 'Synthetic', model: 'P6', registration_number: registration, seats: '5', price_per_day: '1111', image_url: 'javascript:bad', description: 'Temporary synthetic browser QA vehicle only.' })) await fill(admin, id, value)
    await click(admin, button(admin, 'Add vehicle'), 'Unsafe image URL is rejected', async () => assert.equal(await admin.locator('#image_url').getAttribute('aria-invalid'), 'true'))
    for (const id of ['category', 'fuel_type', 'transmission', 'status']) {
      for (const value of await admin.locator('#' + id + ' option').allTextContents()) await select(admin, admin.locator('#' + id), value)
    }
    for (const [id, value] of Object.entries({ category: 'Car', fuel_type: 'Petrol', transmission: 'Manual', status: 'Active' })) await select(admin, admin.locator('#' + id), value)
    await fill(admin, 'seats', '1.5')
    await click(admin, button(admin, 'Add vehicle'), 'Fractional seat count is rejected', async () => assert.equal(await admin.locator('#seats').getAttribute('aria-invalid'), 'true'))
    await fill(admin, 'seats', '5'); await fill(admin, 'price_per_day', '-1')
    await click(admin, button(admin, 'Add vehicle'), 'Negative price is rejected', async () => assert.equal(await admin.locator('#price_per_day').getAttribute('aria-invalid'), 'true'))
    await fill(admin, 'price_per_day', '1111')
    expectedFailure = true
    await fill(admin, 'image_url', '/images/phase6-intentionally-missing.svg')
    await admin.locator('.form-preview[data-fallback="true"] img').waitFor(); await pause(admin)
    assert.ok(await admin.locator('.image-fallback-note').isVisible())
    await fill(admin, 'image_url', '/images/car-sedan.svg'); await pause(admin)
    expectedFailure = false
    const added = await requestClick(admin, button(admin, 'Add vehicle'), '/api/admin/vehicles', 'POST', 201, async () => admin.waitForURL(BASE + '/admin/vehicles'))
    vehicleId = added.vehicle.id
    assert.equal(sql().vehicle.price_per_day, 1111)
    await dismiss(admin)
    await click(admin, vehicleRow().getByRole('link', { name: 'Edit' }), 'Edit form opens with saved values', async () => admin.waitForURL(`${BASE}/admin/vehicles/${vehicleId}/edit`))
    await pause(admin)
    for (const id of ['name', 'brand', 'model', 'registration_number', 'seats', 'price_per_day', 'image_url']) await fill(admin, id, await admin.locator('#'+id).inputValue())
    for (const id of ['category', 'fuel_type', 'transmission', 'status']) await select(admin, admin.locator('#'+id), await admin.locator('#'+id).inputValue())
    await fill(admin, 'description', 'Edited synthetic Phase 6 QA description persisted through the real backend.')
    await requestClick(admin, button(admin, 'Save changes'), `/api/admin/vehicles/${vehicleId}`, 'PUT', 200, async () => admin.waitForURL(BASE + '/admin/vehicles'))
    await dismiss(admin)
    await go(admin, `/admin/vehicles/${vehicleId}/edit`)
    await click(admin, button(admin, 'Cancel'), 'Cancel edit returns without a write', async () => admin.waitForURL(BASE + '/admin/vehicles'))
    // Regression: an in-flight inline status save used to leave Archive enabled,
    // allowing its completion handler to unexpectedly close a newly opened modal.
    let releaseStatus, statusStarted
    const pendingStatus = new Promise(resolve => { releaseStatus = resolve })
    const startedStatus = new Promise(resolve => { statusStarted = resolve })
    const statusMatch = u => u.pathname === `/api/admin/vehicles/${vehicleId}`
    await admin.route(statusMatch, async r => { statusStarted(); await pendingStatus; await r.continue() })
    try {
      await vehicleRow().getByRole('combobox').selectOption('Maintenance')
      await startedStatus
      await step(admin, 'Archive during inline status save', 'Hold a real PUT in flight', 'Archive is disabled until the status update completes', async () => {
        assert.equal(await vehicleRow().getByRole('button', { name: 'Archive', exact: true }).isDisabled(), true)
        await admin.screenshot({ path: path.join(out, 'archive-busy-guard.png'), fullPage: true })
      }, vehicleRow().getByRole('button', { name: 'Archive', exact: true }))
    } finally { releaseStatus(); await admin.unrouteAll({ behavior: 'wait' }); await pause(admin) }
    // Open every visible fleet Archive button; cancel rather than mutate seed rows.
    for (const row of await admin.locator('tbody tr').all()) {
      await cancelModal(admin, row.getByRole('button', { name: 'Archive', exact: true }))
      await select(admin, row.getByRole('combobox'), await row.getByRole('combobox').inputValue())
    }
    for (const value of ['Maintenance', 'Inactive', 'Active']) {
      await step(admin, 'Fixture status', `Change to ${value}`, 'Actual PUT succeeds and MySQL persists status', async () => {
        const waiting = admin.waitForResponse(r => r.url().endsWith(`/api/admin/vehicles/${vehicleId}`) && r.request().method() === 'PUT')
        await vehicleRow().getByRole('combobox').selectOption(value)
        assert.equal((await waiting).status(), 200); await pause(admin); assert.equal(sql().vehicle.status, value)
      }, vehicleRow().getByRole('combobox'))
      if (value !== 'Active') {
        await go(customer, `/vehicles/${vehicleId}`)
        assert.equal(await customer.getByRole('link', { name: 'Book this vehicle' }).count(), 0)
      }
    }
    // Duplicate registration is rejected by the real backend.
    await go(admin, '/admin/vehicles/new')
    for (const [id, value] of Object.entries({ name: 'TEST Duplicate Phase6', brand: 'Synthetic', model: 'P6', registration_number: registration, price_per_day: '1111', description: 'Temporary duplicate validation only.' })) await fill(admin, id, value)
    expectedFailure = true
    await requestClick(admin, button(admin, 'Add vehicle'), '/api/admin/vehicles', 'POST', 409)
    assert.equal(await admin.locator('#registration_number').getAttribute('aria-invalid'), 'true')
    expectedFailure = false
    await click(admin, button(admin, 'Cancel'), 'Duplicate attempt leaves no second vehicle', async () => admin.waitForURL(BASE + '/admin/vehicles'))

    // Home search and all catalog filters, including real empty results.
    await go(anon, '/')
    await fill(anon, 'home-q', 'Honda')
    for (const value of ['', 'Car', 'Bike', 'Scooter']) await select(anon, anon.locator('#home-cat'), value)
    await select(anon, anon.locator('#home-cat'), 'Scooter')
    await click(anon, button(anon, 'Find vehicles'), 'Search and category enter the catalog URL', async () => { await anon.waitForURL(u => u.searchParams.get('q') === 'Honda' && u.searchParams.get('category') === 'Scooter'); await pause(anon) })
    await go(customer, '/vehicles')
    for (const value of ['Cars', 'Bikes', 'Scooters', 'All']) await click(customer, button(customer, value), 'Category tab is selected and catalog reloads', async () => { await pause(customer); assert.equal(await button(customer, value).getAttribute('aria-pressed'), 'true') })
    for (const value of ['price_asc', 'price_desc', '']) {
      await select(customer, customer.locator('#sort'), value)
      await click(customer, button(customer, 'Apply filters'), 'Price order is applied to real results', async () => {
        await pause(customer)
        const prices = await customer.locator('.vcard-price strong').allTextContents()
        const nums = prices.map(v => Number(v.replace(/[^\d.]/g, '')))
        if (value) assert.deepEqual(nums, [...nums].sort((a,b) => value === 'price_asc' ? a-b : b-a))
      })
    }
    await fill(customer, 'q', name); await fill(customer, 'min_price', '1200'); await fill(customer, 'max_price', '1000')
    await click(customer, button(customer, 'Apply filters'), 'Reversed price range shows field error', async () => assert.equal(await customer.locator('#max_price').getAttribute('aria-invalid'), 'true'))
    await fill(customer, 'min_price', '1111'); await fill(customer, 'max_price', '1112')
    await click(customer, button(customer, 'Apply filters'), 'Name and price find one fixture', async () => { await pause(customer); assert.equal(await customer.locator('.vcard').count(), 1) })
    await click(customer, button(customer, 'Clear all'), 'All filter inputs reset', async () => { await pause(customer); assert.equal(await customer.locator('#q').inputValue(), ''); assert.equal(await customer.locator('#min_price').inputValue(), '') })
    await fill(customer, 'q', 'no-such-vehicle-phase6')
    await click(customer, button(customer, 'Apply filters'), 'Real database produces a usable empty state', async () => customer.getByRole('heading', { name: 'No vehicles match', exact: true }).waitFor())
    await click(customer, button(customer, 'Clear all'), 'Clear restores actual fleet', async () => { await pause(customer); assert.ok(await customer.locator('.vcard').count() >= 12) })
    await step(customer, 'Only show vehicles free on these dates', 'Check without dates', 'Date fields become required on apply', async () => customer.getByRole('checkbox').check(), customer.getByRole('checkbox'))
    await click(customer, button(customer, 'Apply filters'), 'Missing availability dates show errors', async () => assert.equal(await customer.locator('#pickup').getAttribute('aria-invalid'), 'true'))
    await fill(customer, 'pickup', date(10)); await fill(customer, 'return', date(11))
    await click(customer, button(customer, 'Apply filters'), 'Availability checkbox/dates reach the real catalog query', async () => { await pause(customer); assert.ok(customer.url().includes('available=1')) })
    await step(customer, 'Only show vehicles free on these dates', 'Uncheck', 'Checkbox can be cleared', async () => customer.getByRole('checkbox').uncheck(), customer.getByRole('checkbox'))
    await click(customer, button(customer, 'Clear all'), 'Filter reset restores catalog', async () => pause(customer))

    // All booking outcomes originate in real customer clicks, in separate sessions.
    await go(customer, `/book/${vehicleId}`)
    await click(customer, button(customer, 'Check availability'), 'Empty booking dates show field errors', async () => assert.equal(await customer.locator('[aria-invalid="true"]').count(), 2))
    await fill(customer, 'pickup', date(-1)); await fill(customer, 'ret', date(1))
    await click(customer, button(customer, 'Check availability'), 'Past pickup is rejected', async () => assert.equal(await customer.locator('#pickup').getAttribute('aria-invalid'), 'true'))
    await fill(customer, 'pickup', date(10)); await fill(customer, 'ret', date(9))
    await click(customer, button(customer, 'Check availability'), 'Return before pickup is rejected', async () => assert.equal(await customer.locator('#ret').getAttribute('aria-invalid'), 'true'))
    await fill(customer, 'ret', date(70))
    expectedFailure = true
    await requestClick(customer, button(customer, 'Check availability'), `/api/vehicles/${vehicleId}/availability`, 'GET', 400)
    expectedFailure = false
    const completeId = await book(20, 3), rejectId = await book(30), cancelId = await book(40), confirmedCancelId = await book(50, 1), overlapA = await book(60)
    expectedFailure = true
    await book(60, 2, customer, 409) // Same customer's duplicate pending request is forbidden.
    expectedFailure = false
    await login(signup, { email, password }, '/dashboard')
    const overlapB = await book(60, 2, signup)
    await go(customer, '/dashboard')
    assert.ok((await customer.locator('.next-trip').innerText()).includes(name))
    await stats()
    await go(admin, '/admin/vehicles')
    expectedFailure = true
    await modal(admin, vehicleRow().getByRole('button', { name: 'Archive', exact: true }), 'Archive vehicle', `/api/admin/vehicles/${vehicleId}/archive`, 'POST', 409)
    assert.equal(sql().vehicle.is_archived, 0)
    await dismiss(admin); expectedFailure = false
    await go(admin, '/admin/bookings')
    for (const filter of ['Pending', 'Confirmed', 'Completed', 'Rejected', 'Cancelled', 'All']) await click(admin, button(admin, filter), 'Status tab updates and shows matching records or empty state', async () => { await pause(admin); assert.equal(await button(admin, filter).getAttribute('aria-pressed'), 'true') })
    await requestClick(admin, bookingRow(completeId).getByRole('button', { name: 'Approve', exact: true }), `/api/admin/bookings/${completeId}/approve`)
    await bookingRow(completeId).getByText('Confirmed', { exact: true }).waitFor()
    await go(customer, '/my-bookings'); await waitCard(completeId, 'Confirmed')
    await go(customer, `/book/${vehicleId}`); await fill(customer, 'pickup', date(20)); await fill(customer, 'ret', date(22))
    await requestClick(customer, button(customer, 'Check availability'), `/api/vehicles/${vehicleId}/availability`, 'GET', 200, async d => { assert.equal(d.available, false); assert.equal(await customer.locator('.quote').count(), 0) })
    // Date filters exclude the same conflict and include an available range.
    await go(customer, '/vehicles'); await fill(customer, 'q', name); await fill(customer, 'pickup', date(20)); await fill(customer, 'return', date(22))
    await step(customer, 'Availability checkbox', 'Check', 'Availability filter enabled', async () => customer.getByRole('checkbox').check(), customer.getByRole('checkbox'))
    await click(customer, button(customer, 'Apply filters'), 'Confirmed conflicts excluded', async () => customer.getByRole('heading', { name: 'No vehicles match', exact: true }).waitFor())
    await fill(customer, 'pickup', date(25)); await fill(customer, 'return', date(26))
    await click(customer, button(customer, 'Apply filters'), 'Free range includes the fixture', async () => { await pause(customer); assert.equal(await customer.locator('.vcard').count(), 1) })
    await go(customer, '/my-bookings')
    await cancelModal(customer, bookingCard(cancelId).getByRole('button', { name: 'Cancel booking', exact: true }))
    await modal(customer, bookingCard(cancelId).getByRole('button', { name: 'Cancel booking', exact: true }), 'Cancel booking', `/api/bookings/${cancelId}/cancel`)
    await waitCard(cancelId, 'Cancelled'); await dismiss(customer)
    await requestClick(admin, bookingRow(confirmedCancelId).getByRole('button', { name: 'Approve', exact: true }), `/api/admin/bookings/${confirmedCancelId}/approve`)
    await go(customer, '/my-bookings'); await waitCard(confirmedCancelId, 'Confirmed')
    await modal(customer, bookingCard(confirmedCancelId).getByRole('button', { name: 'Cancel booking', exact: true }), 'Cancel booking', `/api/bookings/${confirmedCancelId}/cancel`)
    await waitCard(confirmedCancelId, 'Cancelled'); await dismiss(customer)
    await cancelModal(admin, bookingRow(rejectId).getByRole('button', { name: 'Reject', exact: true }))
    await modal(admin, bookingRow(rejectId).getByRole('button', { name: 'Reject', exact: true }), 'Reject booking', `/api/admin/bookings/${rejectId}/reject`)
    await requestClick(admin, bookingRow(overlapA).getByRole('button', { name: 'Approve', exact: true }), `/api/admin/bookings/${overlapA}/approve`)
    expectedFailure = true
    await requestClick(admin, bookingRow(overlapB).getByRole('button', { name: 'Approve', exact: true }), `/api/admin/bookings/${overlapB}/approve`, 'POST', 409)
    await dismiss(admin); expectedFailure = false
    await modal(admin, bookingRow(overlapB).getByRole('button', { name: 'Reject', exact: true }), 'Reject booking', `/api/admin/bookings/${overlapB}/reject`)
    await go(signup, '/my-bookings')
    await signup.locator('.booking-card').filter({ hasText: `Booking #${overlapB}.` }).getByText('Rejected', { exact: true }).waitFor()
    await go(customer, '/my-bookings')
    await modal(customer, bookingCard(overlapA).getByRole('button', { name: 'Cancel booking', exact: true }), 'Cancel booking', `/api/bookings/${overlapA}/cancel`)
    await waitCard(overlapA, 'Cancelled'); await dismiss(customer)
    for (const [text, status] of [['Mark paid', 'Paid'], ['Mark unpaid', 'Unpaid'], ['Mark paid', 'Paid']]) {
      await requestClick(admin, bookingRow(completeId).getByRole('button', { name: text, exact: true }), `/api/admin/bookings/${completeId}/payment`, 'PUT')
      await bookingRow(completeId).getByText(status, { exact: true }).waitFor()
    }
    await cancelModal(admin, bookingRow(completeId).getByRole('button', { name: 'Mark completed', exact: true }))
    await modal(admin, bookingRow(completeId).getByRole('button', { name: 'Mark completed', exact: true }), 'Mark completed', `/api/admin/bookings/${completeId}/complete`)
    await dismiss(admin)
    await go(customer, '/my-bookings'); await waitCard(completeId, 'Completed'); await waitCard(rejectId, 'Rejected')
    await bookingCard(completeId).getByText('Paid', { exact: true }).waitFor()
    const evidence = sql()
    assert.equal(evidence.bookings.length, 6)
    assert.deepEqual(evidence.bookings.map(b => b.booking_status), ['Completed', 'Rejected', 'Cancelled', 'Cancelled', 'Cancelled', 'Rejected'])
    assert.equal(evidence.bookings[0].total_amount, 3333)
    await stats()
    await go(admin, '/admin/customers')
    assert.ok(await admin.getByRole('cell', { name: email, exact: true }).isVisible())
    await go(admin, '/admin/vehicles')
    await modal(admin, vehicleRow().getByRole('button', { name: 'Archive', exact: true }), 'Archive vehicle', `/api/admin/vehicles/${vehicleId}/archive`)
    assert.equal(sql().vehicle.is_archived, 1)
    await dismiss(admin)
    await click(admin, button(admin, 'Show archived'), 'Archived fixture visible', async () => { await pause(admin); await vehicleRow().waitFor() })
    await requestClick(admin, vehicleRow().getByRole('button', { name: 'Restore', exact: true }), `/api/admin/vehicles/${vehicleId}/restore`)
    assert.equal(sql().vehicle.is_archived, 0)
    await dismiss(admin)
    await click(admin, button(admin, 'Show active fleet'), 'Restored fixture visible in active fleet', async () => { await pause(admin); await vehicleRow().waitFor() })

    // Every route and every rendered link; all three responsive classes.
    const routes = [[anon,'/'],[anon,'/vehicles'],[anon,`/vehicles/${vehicleId}`],[anon,'/about'],[anon,'/contact'],[anon,'/login'],[anon,'/register'],[anon,'/not-a-page'],[customer,'/dashboard'],[customer,'/my-bookings'],[customer,'/profile'],[customer,`/book/${vehicleId}`],[admin,'/admin'],[admin,'/admin/vehicles'],[admin,'/admin/vehicles/new'],[admin,`/admin/vehicles/${vehicleId}/edit`],[admin,'/admin/bookings'],[admin,'/admin/customers']]
    for (const [p, url] of routes) await links(p, url)
    for (const width of [360, 768, 1440]) for (const [p, url] of routes) await responsive(p, url, width)
    for (const p of [anon, customer, admin]) {
      await p.setViewportSize({ width: 360, height: 800 }); await go(p, '/')
      const skip = p.locator('.skip-link')
      await step(p, 'Skip to content', 'Tab then Enter', 'Main content receives keyboard focus', async () => { await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'content') }, skip)
      await click(p, button(p, 'Open menu'), 'Mobile menu expands', async () => assert.equal(await button(p, 'Close menu').getAttribute('aria-expanded'), 'true'))
      await click(p, button(p, 'Close menu'), 'Mobile menu closes', async () => assert.equal(await button(p, 'Open menu').getAttribute('aria-expanded'), 'false'))
      await click(p, button(p, 'Open menu'), 'Menu opens for keyboard dismissal')
      await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-expanded')), 'false')
      await click(p, button(p, 'Open menu'), 'Mobile navigation link is reachable')
      await click(p, p.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Vehicles', exact: true }), 'Click navigates and collapses menu', async () => { await p.waitForURL(BASE + '/vehicles'); assert.equal(await button(p, 'Open menu').getAttribute('aria-expanded'), 'false') })
      await p.setViewportSize({ width: 1440, height: 1000 })
    }
    // Mobile dialog bounding box, Escape/cancel focus, internal table scrolling.
    await admin.setViewportSize({ width: 360, height: 800 }); await go(admin, '/admin/vehicles')
    await click(admin, vehicleRow().getByRole('button', { name: 'Archive', exact: true }), 'Mobile archive dialog fits viewport', async () => {
      const r = await admin.getByRole('dialog').boundingBox(); assert.ok(r.x>=0 && r.y>=0 && r.x+r.width<=361 && r.y+r.height<=801)
      await admin.screenshot({ path: path.join(out,'mobile-dialog.png') })
    })
    await step(admin, 'Archive dialog', 'Escape', 'Dialog closes and trigger regains focus', async () => { await admin.keyboard.press('Escape'); assert.ok(await vehicleRow().getByRole('button', { name: 'Archive', exact: true }).evaluate(el => el === document.activeElement)) })
    await admin.setViewportSize({ width: 1440, height: 1000 })
    // All data-backed page retry buttons; only failures are injected.
    for (const [p, url, endpoint] of [[anon,'/','/api/vehicles'],[anon,'/vehicles','/api/vehicles'],[anon,`/vehicles/${vehicleId}`,`/api/vehicles/${vehicleId}`],[customer,'/dashboard','/api/bookings/mine'],[customer,'/my-bookings','/api/bookings/mine'],[customer,`/book/${vehicleId}`,`/api/vehicles/${vehicleId}`],[admin,'/admin','/api/admin/dashboard'],[admin,'/admin/vehicles','/api/admin/vehicles'],[admin,'/admin/bookings','/api/admin/bookings'],[admin,'/admin/customers','/api/admin/customers'],[admin,`/admin/vehicles/${vehicleId}/edit`,`/api/admin/vehicles/${vehicleId}`]]) {
      await loading(p,url,endpoint)
      await failures(p,url,endpoint)
    }
    expectedFailure = true
    await go(anon, '/vehicles/4294967295')
    await click(anon, anon.getByRole('link', { name: 'Back to vehicles', exact: true }), 'Missing vehicle offers working catalog return', async () => anon.waitForURL(BASE + '/vehicles'))
    await pause(anon)
    // Route authority: UI redirects plus actual browser-origin requests.
    expectedFailure = true
    for (const [p, url, target] of [[anon,'/admin','/login'],[anon,'/dashboard','/login'],[customer,'/admin/customers','/dashboard'],[admin,'/profile','/admin'],[admin,`/book/${vehicleId}`,'/admin']]) {
      await go(p,url); assert.equal(new URL(p.url()).pathname,prefix+target)
    }
    for (const [p,status] of [[anon,401],[customer,403]]) await step(p, 'Protected admin endpoint', 'Fetch from the real browser', `Backend rejects with ${status}`, async () => assert.equal(await p.evaluate(() => fetch('/api/admin/customers').then(async r => { await r.text(); return r.status })),status))
    await pause(anon); await pause(customer); expectedFailure = false
    await logout(customer); await login(customer, account('customer'), '/dashboard'); await logout(customer)
    await go(admin, '/admin'); await logout(admin); await login(admin, account('admin'), '/admin'); await logout(admin)
    await step(anon, 'Runtime/network audit', 'Inspect captured browser events', 'No unexpected console/network errors or runtime exceptions', async () => {
      assert.equal(runtimeErrors.length,0,JSON.stringify(runtimeErrors))
      assert.equal(consoleErrors.filter(e=>!e.expected).length,0,JSON.stringify(consoleErrors.filter(e=>!e.expected)))
      assert.equal(networkFailures.filter(e=>!e.expected).length,0,JSON.stringify(networkFailures.filter(e=>!e.expected)))
    })
    await step(anon, 'Inventory reconciliation', 'Compare discovered controls with recorded successful interactions', 'No inventoried logical control remains untested', async () => {
      const missing = [...inventory.values()].filter(item => !item.tested)
      assert.equal(missing.length, 0, JSON.stringify(missing.map(item => ({ route: item.route, name: item.name, context: item.context }))))
    })
  } catch (error) {
    fatalError = error.message
    throw error
  } finally {
    // Restore an edited seeded profile through the UI, even after an assertion fails.
    if (profileChanged && originalProfile) {
      await go(customer,'/profile')
      for (const [id,value] of Object.entries(originalProfile)) await customer.locator('#'+id).fill(value)
      await requestClick(customer,button(customer,'Save changes'),'/api/profile','PUT',200)
    }
    await save()
    await browser.close()
    if (vehicleId || userId) console.log(sql('cleanup'))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
