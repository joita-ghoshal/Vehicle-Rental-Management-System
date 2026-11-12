import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { ASSETS, CATEGORY_IMAGES, assetUrl, EMERGENCY_IMAGE } from '../src/assets.js'

const base = '/Vehicle-Rental-Management-System/'
test('database, relative and already-prefixed paths resolve identically', () => {
  for (const source of ['/images/car-sedan.svg', 'images/car-sedan.svg', './images/car-sedan.svg', `${base}images/car-sedan.svg`]) {
    assert.equal(assetUrl(source, base), `${base}images/car-sedan.svg`)
  }
})
test('site-root builds resolve correctly without double slashes', () => {
  assert.equal(assetUrl('/images/car-sedan.svg', '/'), '/images/car-sedan.svg')
  assert.equal(assetUrl('images/car-sedan.svg', '/'), '/images/car-sedan.svg')
})
test('base is normalized and query/hash are retained', () => {
  assert.equal(assetUrl('images/car-sedan.svg?v=2#preview', 'nested/demo'), '/nested/demo/images/car-sedan.svg?v=2#preview')
})
test('valid external HTTP(S) image URLs remain external', () => {
  assert.equal(assetUrl('https://images.example/fleet/car.webp?v=1', base), 'https://images.example/fleet/car.webp?v=1')
  assert.equal(assetUrl('http://localhost:8000/car.svg', base), 'http://localhost:8000/car.svg')
})
test('unsafe schemes, credentials, traversal and protocol-relative URLs are refused', () => {
  for (const source of ['javascript:alert(1)', 'data:image/svg+xml,unsafe', '//remote.example/car.svg',
    'https://user:password@images.example/car.svg', 'https://', '/images/../private.txt',
    '/images/%2e%2e/private.txt', 'images/..%2fprivate.txt', 'images\\car.svg', '/api/auth/me']) {
    assert.equal(assetUrl(source, base), '', source)
  }
})
test('empty and non-string values never create broken img URLs', () => {
  for (const value of ['', '  ', null, undefined, [], {}, 12]) assert.equal(assetUrl(value, base), '')
})
test('all seven original SVGs are small, self-contained, 4:3 assets', async () => {
  assert.equal(Object.keys(ASSETS).length, 7)
  for (const file of Object.values(ASSETS)) {
    const url = new URL(`../public/${file}`, import.meta.url)
    const text = await readFile(url, 'utf8')
    assert.match(text, /viewBox="0 0 800 600"/)
    assert.doesNotMatch(text, /<script|<image|<foreignObject|https?:\/\/(?!www\.w3\.org)/i)
    assert.ok((await stat(url)).size < 12000)
  }
})
test('category and emergency fallbacks exist without a remote dependency', () => {
  assert.deepEqual(Object.keys(CATEGORY_IMAGES), ['Car', 'Bike', 'Scooter'])
  assert.ok(EMERGENCY_IMAGE.startsWith('data:image/svg+xml;'))
  assert.match(decodeURIComponent(EMERGENCY_IMAGE), /Vehicle image unavailable/)
})
test('approved palette tokens remain unchanged', async () => {
  const css = await readFile(new URL('../src/App.css', import.meta.url), 'utf8')
  const colors = { ivory: '#F5EFE7', plum: '#38283F', sand: '#E8D8CC', orchid: '#66546C', rose: '#B65D79', white: '#FFFFFF', green: '#287A52', red: '#C43D48', amber: '#A56617' }
  for (const [name, color] of Object.entries(colors)) assert.match(css, new RegExp(`--${name}: ${color};`))
})
