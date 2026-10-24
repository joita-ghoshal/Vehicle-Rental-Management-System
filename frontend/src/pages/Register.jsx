import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Field from '../components/Field'
import { Alert } from '../components/Feedback'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm_password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  function validate() {
    const e = {}
    if (form.name.trim().length < 2) e.name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email address.'
    if (!/^\+?\d{10,14}$/.test(form.phone.replace(/[\s\-()]/g, ''))) e.phone = 'Enter a phone number with 10 to 14 digits.'
    if (form.password.length < 8) e.password = 'Use at least 8 characters.'
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) e.password = 'Include at least one letter and one number.'
    if (form.confirm_password !== form.password) e.confirm_password = 'Passwords do not match.'
    return e
  }

  async function submit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim() })
      navigate('/dashboard', { replace: true })
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
        <h1>Create your account</h1>
        <p className="lead">It takes a minute. You can book as soon as you are in.</p>
        <Alert tone="error">{message}</Alert>
        <form onSubmit={submit} noValidate>
          <Field label="Full name" name="name" error={errors.name}>
            <input id="name" autoComplete="name" value={form.name} onChange={set('name')} maxLength={100} />
          </Field>
          <Field label="Email address" name="email" error={errors.email}>
            <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </Field>
          <Field label="Phone number" name="phone" error={errors.phone}>
            <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <div className="field-row">
            <Field label="Password" name="password" error={errors.password} hint="8+ characters, with a letter and a number.">
              <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
            </Field>
            <Field label="Confirm password" name="confirm_password" error={errors.confirm_password}>
              <input id="confirm_password" type="password" autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} />
            </Field>
          </div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Log in</Link></p>
      </div>
      <aside className="auth-side">
        <img src="/images/bike-cruiser.svg" alt="" />
        <p className="auth-quote">Every Ride, A New Story.</p>
      </aside>
    </div>
  )
}
