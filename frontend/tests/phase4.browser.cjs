// Optional browser suite using an already-installed Playwright and Chrome.
// Run with NODE_PATH set to that installation; no dependency is added here.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const BASE = (process.env.ZELVORA_BROWSER_URL || 'http://127.0.0.1:5173/Vehicle-Rental-Management-System').replace(/\/$/, '')
const origin = new URL(BASE).origin
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname), 'Local testing only')
const artifacts = process.env.ZELVORA_ARTIFACT_DIR || path.join(process.env.LOCALAPPDATA, 'Temp', 'opencode', 'zelvora-phase4')
let checks = 0
function check(name, value = true) { assert.ok(value, name); console.log(`PASS ${++checks} ${name}`) }
function date(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

;(async () => {
  await fs.mkdir(artifacts, { recursive: true })
  const browser = await chromium.launch({ channel: process.env.ZELVORA_BROWSER_CHANNEL || 'chrome', headless: true })
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ reducedMotion: 'reduce' })))
  const [anon, customer, admin] = contexts
  const runtimeErrors = [], badResponses = [], consoleErrors = []
  const pages = await Promise.all(contexts.map(c => c.newPage()))
  let stage = 'normal', vehicleId
  for (const page of pages) {
    page.on('pageerror', error => runtimeErrors.push(error.message))
    page.on('response', r => { if (stage === 'normal' && r.url().startsWith(origin) && r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`) })
    page.on('console', message => {
      if (stage === 'normal' && message.type() === 'error' && message.location().url.startsWith(origin)) consoleErrors.push(message.text())
    })
  }
  async function api(context, method, endpoint, data) {
    const r = await context.request.fetch(origin + endpoint, { method, data, headers: { 'X-Requested-With': 'ZELVORA' } })
    assert.ok(r.ok(), `${method} ${endpoint}: ${r.status()} ${await r.text()}`)
    return r.json()
  }
  async function inspect(page, route, width, label) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(BASE + route)
    await page.waitForLoadState('networkidle')
    for (const image of await page.locator('img:visible').all()) await image.scrollIntoViewIfNeeded()
    await page.waitForFunction(() => [...document.images].every(i => !i.getClientRects().length || (i.complete && i.naturalWidth > 0)))
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      h1: document.querySelectorAll('h1').length,
      missingAlt: [...document.images].some(i => !i.hasAttribute('alt')),
      badImageShape: [...document.querySelectorAll('.vehicle-image')].some(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && Math.abs(r.width / r.height - 4 / 3) > .035
      }),
      broken: [...document.images].filter(i => i.getClientRects().length && (!i.complete || !i.naturalWidth)).map(i => i.src),
    }))
    check(`${width}px ${label}: assets, 4:3 frames, headings and no page overflow`,
      !state.overflow && state.h1 === 1 && !state.missingAlt && !state.badImageShape && !state.broken.length)
    if (label === 'home') {
      check(`${width}px hero caption never covers the vehicle illustration`, await page.evaluate(() => {
        const image = document.querySelector('.hero-arch .vehicle-image').getBoundingClientRect()
        const caption = document.querySelector('.hero-tag').getBoundingClientRect()
        return caption.top >= image.bottom - 1
      }))
    }
    await page.evaluate(() => scrollTo(0, 0))
    if (['home', 'fleet', 'login', 'admin-dashboard'].includes(label)) {
      await page.screenshot({ path: path.join(artifacts, `${label}-${width}.png`), fullPage: true })
    }
  }
  try {
    const demo = await api(anon, 'GET', '/api/demo/credentials')
    assert.ok(demo.enabled && demo.accounts.length === 2, 'Synthetic demo must be enabled before fixture writes')
    for (const [role, context] of [['customer', customer], ['admin', admin]]) {
      const account = demo.accounts.find(a => a.role === role)
      await api(context, 'POST', '/api/auth/login', { email: account.email, password: account.password })
    }
    const fixture = await api(admin, 'POST', '/api/admin/vehicles', {
      name: 'TEST Phase4 Illustration', brand: 'Synthetic', model: 'P4', category: 'Car',
      registration_number: `P4 ${Date.now()}`, fuel_type: 'Petrol', transmission: 'Manual', seats: 5,
      price_per_day: 1500, image_url: '/images/car-sedan.svg', description: 'Temporary synthetic Phase 4 image verification vehicle.', status: 'Active',
    })
    vehicleId = fixture.vehicle.id
    await api(customer, 'POST', '/api/bookings', { vehicle_id: vehicleId, pickup_date: date(50), return_date: date(51) })
    const routes = [
      [pages[0], '/', 'home'], [pages[0], '/vehicles', 'fleet'], [pages[0], `/vehicles/${vehicleId}`, 'details'],
      [pages[0], '/about', 'about'], [pages[0], '/contact', 'contact'], [pages[0], '/login', 'login'],
      [pages[0], '/register', 'register'], [pages[0], '/not-a-page', 'not-found'],
      [pages[1], '/dashboard', 'customer-dashboard'], [pages[1], '/my-bookings', 'booking-history'],
      [pages[1], '/profile', 'profile'], [pages[1], `/book/${vehicleId}`, 'booking-summary'],
      [pages[2], '/admin', 'admin-dashboard'], [pages[2], '/admin/vehicles', 'admin-fleet'],
      [pages[2], '/admin/vehicles/new', 'add-vehicle'], [pages[2], `/admin/vehicles/${vehicleId}/edit`, 'edit-vehicle'],
      [pages[2], '/admin/bookings', 'admin-bookings'], [pages[2], '/admin/customers', 'customers'],
    ]
    const widths = (process.env.ZELVORA_WIDTHS || '360,768,1024,1440').split(',').map(Number)
    for (const width of widths) for (const [page, route, label] of routes) await inspect(page, route, width, label)
    check('Normal page loads have no local HTTP error responses', badResponses.length === 0)
    check('No React runtime errors', runtimeErrors.length === 0)
    check('Normal page loads have no local console errors', consoleErrors.length === 0)

    const page = pages[0]
    await page.setViewportSize({ width: 360, height: 800 })
    await page.goto(BASE + '/')
    await page.keyboard.press('Tab')
    check('Skip link is the first keyboard stop', await page.evaluate(() => document.activeElement.classList.contains('skip-link')))
    await page.keyboard.press('Enter')
    check('Skip link moves focus to main content', await page.evaluate(() => document.activeElement.id === 'content'))
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.keyboard.press('Escape')
    check('Mobile menu closes with Escape and restores toggle focus', await page.evaluate(() => document.activeElement.classList.contains('nav-toggle') && document.activeElement.getAttribute('aria-expanded') === 'false'))
    await page.goto(BASE + '/login')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    check('Login errors are associated with their inputs', await page.locator('#email').getAttribute('aria-invalid') === 'true' && await page.locator('#password').getAttribute('aria-describedby') === 'password-error')
    await page.locator('.badge-warn').first().waitFor()
    const colors = await page.evaluate(() => {
      const rgb = value => {
        const canvas = document.createElement('canvas'), c = canvas.getContext('2d')
        c.fillStyle = value; c.fillRect(0, 0, 1, 1)
        return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      return ['.auth-form .btn-primary', '.field-error', '.badge-warn'].map(selector => {
        const style = getComputedStyle(document.querySelector(selector))
        return [selector, rgb(style.color), rgb(style.backgroundColor)]
      })
    })
    const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0)
    for (const [selector, fg, bg] of colors) {
      const l1 = luminance(fg), l2 = luminance(bg)
      check(`AA text contrast on ${selector}`, (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05) >= 4.5)
    }
    await page.locator('#email').focus()
    check('Focused form fields have a visible focus indicator', await page.locator('#email').evaluate(el => getComputedStyle(el).boxShadow !== 'none'))
    check('Reduced motion disables page animation', await page.locator('.auth-form').evaluate(el => parseFloat(getComputedStyle(el).animationDuration) < .001))

    stage = 'intentional-ui-states'
    let release, delayedFailure
    const pending = new Promise(resolve => { release = resolve })
    await page.route('**/api/vehicles', async route => {
      await pending
      try { await route.continue() } catch (error) { delayedFailure = error }
    })
    try {
      await page.goto(BASE + '/vehicles', { waitUntil: 'domcontentloaded' })
      await page.locator('.skeleton-preview').waitFor()
      check('Loading state shows a labelled skeleton', await page.getByRole('status').filter({ hasText: 'Finding vehicles' }).isVisible())
    } finally {
      release()
      // Let delayed callbacks finish before removing them. Removing a handler
      // first lets Playwright auto-handle its route and races route.continue().
      await page.unrouteAll({ behavior: 'wait' })
    }
    if (delayedFailure) throw delayedFailure
    await page.locator('.vcard').first().waitFor()
    await page.route('**/api/vehicles', route => route.fulfill({ json: { vehicles: [] } }))
    await page.reload()
    await page.getByRole('heading', { name: 'No vehicles match', exact: true }).waitFor()
    check('Empty state preserves the search controls', await page.getByRole('button', { name: 'Apply filters' }).isVisible())
    await page.unroute('**/api/vehicles')
    await page.route('**/api/vehicles', route => route.fulfill({ status: 503, json: { error: 'Simulated service interruption.' } }))
    await page.reload()
    await page.getByRole('heading', { name: 'We could not load this', exact: true }).waitFor()
    check('Error state has an accessible retry action', await page.getByRole('button', { name: 'Try again' }).isVisible())
    await page.unroute('**/api/vehicles')
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.locator('.vcard').first().waitFor()
    check('Retry restores the real fleet after a simulated error')

    stage = 'intentional-fallback'
    const edit = pages[2]
    await edit.setViewportSize({ width: 1440, height: 1000 })
    await edit.goto(`${BASE}/admin/vehicles/${vehicleId}/edit`)
    await edit.locator('#image_url').fill('/images/phase4-intentionally-missing.svg')
    await edit.locator('.form-preview[data-fallback="true"] img').waitFor()
    await edit.waitForFunction(() => document.querySelector('.form-preview img')?.naturalWidth > 0)
    check('Broken admin preview uses a visible local category fallback', await edit.locator('.form-preview .image-fallback-note').isVisible())
    await edit.locator('#image_url').fill('/images/car-sedan.svg')
    await edit.waitForFunction(() => document.querySelector('.form-preview')?.dataset.fallback !== 'true' && document.querySelector('.form-preview img')?.naturalWidth > 0)
    check('Correcting an image URL resets the fallback state')
    await edit.locator('#category').selectOption('Bike')
    await edit.locator('#image_url').fill('')
    await edit.waitForFunction(() => document.querySelector('.form-preview img')?.src.includes('bike-sport.svg'))
    check('Empty image uses the selected category illustration')
    await edit.route('**/images/**', route => route.abort())
    await edit.reload()
    await edit.waitForFunction(() => document.querySelector('.form-preview img')?.src.startsWith('data:image/svg+xml') && document.querySelector('.form-preview img')?.naturalWidth > 0)
    check('Missing category asset falls back to embedded SVG without an error loop')
    await edit.unroute('**/images/**')
    // Nothing in this form is saved: fixture and booking only are cleaned below.
    check('Fallback testing never saved the edited preview URL', (await api(admin, 'GET', `/api/admin/vehicles/${vehicleId}`)).vehicle.image_url === '/images/car-sedan.svg')
    await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ base: BASE, checks, badResponses, runtimeErrors, consoleErrors }, null, 2))
    console.log(`\n${checks}/${checks} Phase 4 browser checks passed. Screenshots: ${artifacts}`)
  } finally {
    await browser.close()
    if (vehicleId) {
      const r = spawnSync('python', ['-c', 'from database import transaction; import sys; v=int(sys.argv[1]);\nwith transaction() as c:\n c.execute("DELETE FROM bookings WHERE vehicle_id=%s", (v,)); c.execute("DELETE FROM vehicles WHERE id=%s", (v,))', String(vehicleId)], {
        cwd: path.resolve(__dirname, '../../backend'), env: { ...process.env, ZELVORA_DB_NAME: 'zelvora_demo_db', ZELVORA_DEMO_MODE: '1' }, encoding: 'utf8',
      })
      assert.equal(r.status, 0, r.stderr)
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
