// Real backend stop/restart against a local production build and real demo MySQL.
// Owns its child backend only; never stops the user's server or MySQL service.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const { spawn } = require('node:child_process')
const root = path.resolve(__dirname, '../dist')
const base = '/Vehicle-Rental-Management-System/'
let checks = 0, backend, backendPort, browser
let backendLogs = ''
function check(name, value = true) { assert.ok(value, name); console.log(`PASS ${++checks} ${name}`) }

async function startBackend() {
  backend = spawn('python', ['-u', 'demo.py', 'serve'], {
    cwd: path.resolve(__dirname, '../../backend'),
    env: { ...process.env, ZELVORA_API_PORT: String(backendPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Child backend did not start')), 15000)
    const onExit = () => { clearTimeout(timeout); reject(new Error('Child backend exited before readiness')) }
    backend.once('exit', onExit)
    backend.once('error', error => { clearTimeout(timeout); reject(error) })
    let output = ''
    backend.stdout.on('data', data => {
      output += data
      backendLogs += data
      if (output.includes('ZELVORA API running')) {
        clearTimeout(timeout)
        backend.removeListener('exit', onExit)
        resolve()
      }
    })
    backend.stderr.on('data', data => { backendLogs += data })
  })
}
async function stopBackend() {
  if (!backend || backend.exitCode !== null || backend.signalCode !== null) return
  const child = backend
  await new Promise(resolve => { child.once('exit', resolve); child.kill() })
}

const host = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const proxy = http.request({ hostname: '127.0.0.1', port: backendPort, path: req.url, method: req.method, headers: req.headers }, upstream => {
      res.writeHead(upstream.statusCode, upstream.headers)
      upstream.pipe(res)
    })
    proxy.on('error', () => { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Backend unavailable') })
    req.pipe(proxy)
    return
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = path.resolve(root, pathname.slice(base.length))
    if (!pathname.startsWith(base) || !file.startsWith(root + path.sep)) throw new Error('SPA route')
    const body = await fs.readFile(file)
    res.writeHead(200, { 'Content-Type': { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'text/html' })
    res.end(body)
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(await fs.readFile(path.join(root, 'index.html')))
  }
})

;(async () => {
  const reservation = http.createServer()
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
  backendPort = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  try {
    await startBackend()
    await new Promise(resolve => host.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${host.address().port}`
    const response = await fetch(origin + '/api/demo/credentials')
    const demo = await response.json()
    assert.ok(demo.enabled, 'Isolated synthetic demo only')
    const account = demo.accounts.find(a => a.role === 'customer')
    browser = await chromium.launch({ channel: process.env.ZELVORA_BROWSER_CHANNEL || 'chrome', headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    async function login(target = 'dashboard') {
      await page.locator('#email').fill(account.email)
      await page.locator('#password').fill(account.password)
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
      await page.waitForURL(origin + base + target)
      await page.waitForLoadState('networkidle')
    }
    await page.goto(origin + base + 'login')
    await login()
    check('Production build signs in through an independently owned real Python backend')
    const token = (await page.context().cookies()).find(c => c.name === 'zelvora_session').value
    await stopBackend()
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Vehicles', exact: true }).click()
    await page.getByText('The server sent an unexpected reply. Check that the Python backend is running.', { exact: true }).waitFor()
    check('Actually stopped backend produces a controlled non-JSON proxy error and retry', await page.getByRole('button', { name: 'Try again' }).isVisible())
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'Could not log out.' }).waitFor()
    check('Logout during a real outage reports failure without pretending to revoke the session')
    await startBackend()
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.locator('.vcard').first().waitFor()
    check('Restarted backend recovers the catalog using the same persistent MySQL data', await page.locator('.vcard').count() >= 12)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My bookings' }).click()
    await page.waitForURL(origin + base + 'login')
    check('Backend restart invalidates process-local sessions and prompts reauthentication')
    await login('my-bookings')
    check('Login after a real backend restart restores the requested page without clearing browser storage', errors.length === 0)
    for (const secret of [account.password, token, 'scrypt$', 'Traceback']) assert.ok(!backendLogs.includes(secret), 'Backend log privacy')
    check('Owned backend logs contain no password/session token/hash or traceback')
    console.log(`\n${checks}/${checks} real stop/restart browser checks passed`)
  } finally {
    if (browser) await browser.close()
    await stopBackend()
    if (host.listening) await new Promise(resolve => host.close(resolve))
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
