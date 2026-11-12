// One place for every call to the Python backend.
export const AUTH_EXPIRED_EVENT = 'zelvora:auth-expired'

// Empty for single-origin (recommended). Set VITE_API_URL to the API origin
// only when the frontend is hosted separately (for example https://api.example.com).
const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '')

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path
}

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const options = { method, credentials: 'include', headers: {} }
  if (method !== 'GET') options.headers['X-Requested-With'] = 'ZELVORA'
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(apiUrl(path), options)
  } catch {
    throw new ApiError('Cannot reach the server. Check that the Python backend is running.')
  }

  // A protected-resource 401 means the cached React identity is stale.
  // Incorrect login credentials must not trigger a global session transition.
  if (response.status === 401 && path !== '/api/auth/login' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
  let data = null
  try {
    data = await response.json()
  } catch {
    throw new ApiError('The server sent an unexpected reply. Check that the Python backend is running.', response.status)
  }
  if (!response.ok) throw new ApiError(data.error || 'Something went wrong.', response.status, data.fields || {})
  return data
}
