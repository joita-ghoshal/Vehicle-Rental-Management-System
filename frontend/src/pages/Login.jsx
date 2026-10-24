import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Field from '../components/Field'
import { Alert } from '../components/Feedback'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    const found = {}
    if (!form.email.trim()) found.email = 'Enter your email address.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) found.email = 'Enter a valid email address.'
    if (!form.password) found.password = 'Enter your password.'
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const loggedIn = await login(form.email.trim(), form.password)
      const from = location.state?.from
      navigate(loggedIn.role === 'admin' ? '/admin' : from || '/dashboard', { replace: true })
    } catch (err) {
      setMessage(err.message)
      setErrors(err.fields || {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container auth">
      <div className="auth-form">
        <h1>Welcome back</h1>
        <p className="lead">Log in to book vehicles and manage your rentals.</p>
        {location.state?.from && <Alert tone="info">Please log in to continue.</Alert>}
        <Alert tone="error">{message}</Alert>
        <form onSubmit={submit} noValidate>
          <Field label="Email address" name="email" error={errors.email}>
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Password" name="password" error={errors.password}>
            <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="auth-switch">New to ZELVORA? <Link to="/register">Create an account</Link></p>
      </div>
      <aside className="auth-side">
        <img src="/images/scooter-electric.svg" alt="" />
        <p className="auth-quote">Every Ride, A New Story.</p>
      </aside>
    </div>
  )
}
