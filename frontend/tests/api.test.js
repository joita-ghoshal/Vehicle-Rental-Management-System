import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { api, ApiError, AUTH_EXPIRED_EVENT } from '../src/api.js'

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
let expired
beforeEach(() => {
  expired = 0
  globalThis.window = new EventTarget()
  window.addEventListener(AUTH_EXPIRED_EVENT, () => expired++)
})
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})
const reply = (status, data) => { globalThis.fetch = async () => new Response(JSON.stringify(data), { status }) }

test('API sends credentialed cookies, JSON and the mutation security header', async () => {
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/profile')
    assert.equal(options.credentials, 'include')
    assert.equal(options.method, 'PUT')
    assert.equal(options.headers['X-Requested-With'], 'ZELVORA')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), { name: 'Synthetic' })
    return new Response('{"ok":true}')
  }
  assert.deepEqual(await api('/api/profile', { method: 'PUT', body: { name: 'Synthetic' } }), { ok: true })
})

test('protected API 401 signals stale identity and preserves the API error', async () => {
  reply(401, { error: 'Please log in.' })
  await assert.rejects(api('/api/bookings/mine'), e => e instanceof ApiError && e.status === 401)
  assert.equal(expired, 1)
})

test('incorrect login does not signal session expiry', async () => {
  reply(401, { error: 'Incorrect email or password.' })
  await assert.rejects(api('/api/auth/login', { method: 'POST', body: {} }), { status: 401 })
  assert.equal(expired, 0)
})

test('403/503 responses preserve identity and field-level error information', async () => {
  for (const status of [400, 403, 503]) {
    reply(status, { error: 'Controlled failure', fields: { email: 'Use a reserved domain.' } })
    await assert.rejects(api('/api/profile'), e => e.status === status && e.fields.email === 'Use a reserved domain.')
  }
  assert.equal(expired, 0)
})

test('transport failure gives a recovery message without claiming logout', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(api('/api/auth/logout', { method: 'POST' }), e => e instanceof ApiError && e.status === 0 && e.message.includes('Cannot reach the server'))
  assert.equal(expired, 0)
})

test('non-JSON proxy errors have a controlled message and recover on retry', async () => {
  globalThis.fetch = async () => new Response('Proxy unavailable', { status: 500 })
  await assert.rejects(api('/api/vehicles'), e => e instanceof ApiError && e.message.includes('unexpected reply') && e.status === 500)
  reply(200, { vehicles: [] })
  assert.deepEqual(await api('/api/vehicles'), { vehicles: [] })
})
