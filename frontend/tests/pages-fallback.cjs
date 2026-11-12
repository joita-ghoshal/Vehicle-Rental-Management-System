// Emulate Pages' real 404 response locally; does not deploy or mutate data.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const root = path.resolve(__dirname, '../dist')
const base = '/Vehicle-Rental-Management-System/'
let checks = 0
function check(name, value = true) { assert.ok(value, name); console.log(`PASS ${++checks} ${name}`) }

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const proxy = http.request({ hostname: '127.0.0.1', port: 8000, path: req.url, method: req.method, headers: req.headers }, upstream => {
      res.writeHead(upstream.statusCode, upstream.headers)
      upstream.pipe(res)
    })
    proxy.on('error', () => { res.writeHead(503); res.end('{}') })
    req.pipe(proxy)
    return
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const target = path.resolve(root, '.' + pathname.slice(base.length - 1))
    if (!pathname.startsWith(base) || !target.startsWith(root + path.sep)) throw new Error('Not an asset')
    const file = await fs.readFile(target)
    const type = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(target)] || 'text/html'
    res.writeHead(200, { 'Content-Type': type }); res.end(file)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end(await fs.readFile(path.join(root, '404.html')))
  }
})

;(async () => {
  check('404 shell is an exact copy of the correctly based build',
    (await fs.readFile(path.join(root, 'index.html'), 'utf8')) === (await fs.readFile(path.join(root, '404.html'), 'utf8')))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const errors = [], failedAssets = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('response', r => { if (r.request().resourceType() !== 'document' && r.url().includes('127.0.0.1') && r.status() >= 400) failedAssets.push(r.url()) })
  const url = `http://127.0.0.1:${server.address().port}${base}`
  try {
    for (const [route, heading] of [['vehicles', 'Our vehicles'], ['login', 'Welcome back'], ['admin', 'Welcome back'], ['not-a-real-page', 'This page does not exist']]) {
      const response = await page.goto(url + route)
      await page.getByRole('heading', { name: heading, exact: true }).waitFor()
      await page.waitForLoadState('networkidle')
      check(`Direct /${route} renders correctly from the host's HTTP 404 shell`, response.status() === 404)
    }
    check('Deep-link shell has no missing JS/CSS/image/API assets', failedAssets.length === 0)
    check('Deep-link shell has no React runtime errors', errors.length === 0)
    const offline = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: 'reduce' })
    const blocked = []
    await offline.route('**/*', route => {
      if (['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(route.request().url()).hostname)) {
        blocked.push(route.request().url())
        return route.abort()
      }
      return route.continue()
    })
    await offline.goto(url + 'login')
    await offline.getByRole('heading', { name: 'Welcome back', exact: true }).waitFor()
    await offline.waitForLoadState('networkidle')
    check('Font-CDN failures use system fonts without hiding the login form', blocked.length > 0 && await offline.locator('#email').isVisible())
    check('Font-CDN failure does not break mobile images or page width', await offline.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth && [...document.images].every(i => !i.getClientRects().length || (i.complete && i.naturalWidth > 0))))
    await offline.close()
    console.log(`\n${checks}/${checks} Pages-fallback checks passed (HTTP 404 retained, not a 200 SPA rewrite).`)
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1 })
