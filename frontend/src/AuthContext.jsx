import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, AUTH_EXPIRED_EVENT } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const expired = () => setUser(null)
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)
    api('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } })
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (form) => {
    const data = await api('/api/auth/register', { method: 'POST', body: form })
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    // Only claim logout once the server has revoked the HttpOnly cookie/token.
    await api('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout }), [user, loading, login, register, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
