// Optional browser verification with an already-installed Playwright.
// No package is added to the React/Python application.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const BASE = process.env.ZELVORA_BROWSER_URL || 'http://127.0.0.1:5173/Vehicle-Rental-Management-System'
let checks = 0
function check(name, condition = true) {
  assert.ok(condition, name)
  console.log(`PASS ${++checks} ${name}`)
}
function date(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  let vehicleId
  try {
    await page.goto(`${BASE}/login`)
    await page.getByRole('heading', { name: 'Demo Login Credentials' }).waitFor()
    check('Demo credentials panel loads from Python API')
    const cards = page.locator('.demo-card')
    const adminCard = cards.filter({ has: page.getByRole('heading', { name: 'Main admin', exact: true }) })
    const customerCard = cards.filter({ has: page.getByRole('heading', { name: 'Demo customer', exact: true }) })
    await adminCard.getByRole('button', { name: 'Copy credentials' }).click()
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    check('Copy includes Main Admin email and public password', clipboard.includes('demo.admin@zelvora.example') && clipboard.includes('ZelvoraAdmin#2026'))
    await page.setViewportSize({ width: 390, height: 844 })
    check('Login/demo panel has no mobile horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.setViewportSize({ width: 1440, height: 1000 })
    if (process.env.ZELVORA_SCREENSHOT) await page.screenshot({ path: process.env.ZELVORA_SCREENSHOT, fullPage: true })

    async function login(role) {
      await page.goto(`${BASE}/login`)
      await page.locator('.demo-card').filter({ has: page.getByRole('heading', { name: role === 'admin' ? 'Main admin' : 'Demo customer', exact: true }) })
        .getByRole('button', { name: 'Fill login form' }).click()
      check(`${role} fill button populates the form`, await page.locator('#email').inputValue() === `demo.${role}@zelvora.example`)
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
      await page.waitForURL(`${BASE}/${role === 'admin' ? 'admin' : 'dashboard'}`)
      check(`${role} login redirects to the correct dashboard`)
    }
    async function logout() {
      await page.getByRole('button', { name: 'Log out', exact: true }).click()
      await page.waitForURL(`${BASE}/`)
    }
    async function responseAfter(action, suffix, method = 'POST') {
      const waiting = page.waitForResponse(r => r.url().endsWith(suffix) && r.request().method() === method)
      await action()
      const response = await waiting
      assert.ok(response.ok(), `${method} ${suffix}: ${response.status()}`)
      return response.json()
    }
    await login('admin')
    await page.reload()
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor()
    check('Main Admin session survives browser reload')
    await page.getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Customers' }).click()
    await page.getByRole('cell', { name: 'demo.customer@zelvora.example', exact: true }).waitFor()
    check('Customer management is visible and unmasked (synthetic data)')
    await page.goto(`${BASE}/admin/vehicles/new`)
    const run = Date.now()
    for (const [id, value] of Object.entries({ name: `TEST Browser ${run}`, brand: 'Fictional', model: 'P2', registration_number: `DEMO B ${run}`, price_per_day: '1700', description: 'Synthetic browser verification vehicle only.' })) {
      await page.locator(`#${id}`).fill(value)
    }
    const added = await responseAfter(() => page.getByRole('button', { name: 'Add vehicle', exact: true }).click(), '/api/admin/vehicles')
    vehicleId = added.vehicle.id
    await page.waitForURL(`${BASE}/admin/vehicles`)
    check('Main Admin adds a vehicle through React and Python')
    let row = page.getByRole('row').filter({ hasText: `TEST Browser ${run}` })
    await row.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.locator('#name').fill(`TEST Browser Edited ${run}`)
    await responseAfter(() => page.getByRole('button', { name: 'Save changes' }).click(), `/api/admin/vehicles/${vehicleId}`, 'PUT')
    await page.waitForURL(`${BASE}/admin/vehicles`)
    row = page.getByRole('row').filter({ hasText: `TEST Browser Edited ${run}` })
    await row.waitFor()
    check('Main Admin edits a vehicle through the UI')
    await responseAfter(() => row.getByRole('combobox').selectOption('Maintenance'), `/api/admin/vehicles/${vehicleId}`, 'PUT')
    check('Vehicle status change works through the UI')
    await responseAfter(() => row.getByRole('combobox').selectOption('Active'), `/api/admin/vehicles/${vehicleId}`, 'PUT')
    await logout()
    await login('customer')
    await page.reload()
    await page.getByRole('heading', { name: 'Welcome, Demo', exact: true }).waitFor()
    check('Customer session survives browser reload')
    await page.goto(`${BASE}/admin/customers`)
    await page.waitForURL(`${BASE}/dashboard`)
    check('Customer cannot open admin pages')
    const bookingIds = []
    for (const offset of [12, 22]) {
      await page.goto(`${BASE}/book/${vehicleId}`)
      await page.locator('#pickup').fill(date(offset))
      await page.locator('#ret').fill(date(offset + 1))
      await page.getByRole('button', { name: 'Check availability' }).click()
      const booked = await responseAfter(() => page.getByRole('button', { name: 'Confirm booking request' }).click(), '/api/bookings')
      bookingIds.push(booked.booking.id)
      await page.waitForURL(`${BASE}/my-bookings`)
    }
    check('Demo Customer creates two bookings through the UI')
    await logout()
    await login('admin')
    const before = await page.evaluate(() => fetch('/api/admin/dashboard').then(r => r.json()))
    await page.goto(`${BASE}/admin/bookings`)
    const bookingRow = id => page.getByRole('row').filter({ has: page.getByRole('cell', { name: `#${id}`, exact: true }) })
    await responseAfter(() => bookingRow(bookingIds[0]).getByRole('button', { name: 'Approve', exact: true }).click(), `/api/admin/bookings/${bookingIds[0]}/approve`)
    await bookingRow(bookingIds[0]).getByText('Confirmed', { exact: true }).waitFor()
    check('Booking approval works through the UI')
    await responseAfter(() => bookingRow(bookingIds[0]).getByRole('button', { name: 'Mark paid' }).click(), `/api/admin/bookings/${bookingIds[0]}/payment`, 'PUT')
    await bookingRow(bookingIds[0]).getByText('Paid', { exact: true }).waitFor()
    check('Payment recording works through the UI')
    await bookingRow(bookingIds[0]).getByRole('button', { name: 'Mark completed' }).click()
    await responseAfter(() => page.getByRole('dialog').getByRole('button', { name: 'Mark completed' }).click(), `/api/admin/bookings/${bookingIds[0]}/complete`)
    await bookingRow(bookingIds[0]).getByText('Completed', { exact: true }).waitFor()
    check('Booking completion works through the UI')
    await bookingRow(bookingIds[1]).getByRole('button', { name: 'Reject', exact: true }).click()
    await responseAfter(() => page.getByRole('dialog').getByRole('button', { name: 'Reject booking' }).click(), `/api/admin/bookings/${bookingIds[1]}/reject`)
    await bookingRow(bookingIds[1]).getByText('Rejected', { exact: true }).waitFor()
    check('Booking rejection works through the UI')
    await page.getByRole('button', { name: 'Completed', exact: true }).click()
    await bookingRow(bookingIds[1]).waitFor({ state: 'hidden' })
    check('Booking status filters work')
    const after = await page.evaluate(() => fetch('/api/admin/dashboard').then(r => r.json()))
    check('Revenue and completed statistics reflect the UI operation', after.summary.completed_revenue === before.summary.completed_revenue + 3400 && after.summary.completed_bookings === before.summary.completed_bookings + 1)
    await page.goto(`${BASE}/admin/vehicles`)
    row = page.getByRole('row').filter({ hasText: `TEST Browser Edited ${run}` })
    await row.getByRole('button', { name: 'Archive', exact: true }).click()
    await responseAfter(() => page.getByRole('dialog').getByRole('button', { name: 'Archive vehicle' }).click(), `/api/admin/vehicles/${vehicleId}/archive`)
    await row.waitFor({ state: 'hidden' })
    check('Vehicle archive works through the UI')
    await page.getByRole('button', { name: 'Show archived', exact: true }).click()
    await responseAfter(() => row.getByRole('button', { name: 'Restore', exact: true }).click(), `/api/admin/vehicles/${vehicleId}/restore`)
    await row.waitFor({ state: 'hidden' })
    check('Vehicle restore works through the UI')
    await logout()
    await page.goto(`${BASE}/admin`)
    await page.waitForURL(`${BASE}/login`)
    check('Logout removes access and anonymous admin URLs redirect to login')
    check('No React runtime errors', errors.length === 0)
    console.log(`\n${checks}/${checks} browser checks passed`)
  } finally {
    await browser.close()
    if (vehicleId) {
      const result = spawnSync('python', ['-c', 'from database import transaction; import sys; v=int(sys.argv[1]);\nwith transaction() as c:\n c.execute("DELETE FROM bookings WHERE vehicle_id=%s", (v,)); c.execute("DELETE FROM vehicles WHERE id=%s", (v,))', String(vehicleId)], {
        cwd: __dirname, env: { ...process.env, ZELVORA_DB_NAME: 'zelvora_demo_db', ZELVORA_DEMO_MODE: '1' }, encoding: 'utf8',
      })
      assert.equal(result.status, 0, result.stderr)
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
