// One place for every call to the Python backend.
export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const options = { method, credentials: 'same-origin', headers: {} }
  if (method !== 'GET') options.headers['X-Requested-With'] = 'ZELVORA'
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(path, options)
  } catch {
    throw new ApiError('Cannot reach the server. Check that the Python backend is running.')
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
