import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Field from '../components/Field'
import { Alert } from '../components/Feedback'
import { DEMO_ACCOUNT_LABELS, demoCredentialsText } from '../demoAccounts'
import { api } from '../api'
import VehicleImage from '../components/VehicleImage'
import { ASSETS } from '../assets'

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(area)
  if (!copied) throw new Error('Copy failed')
}

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const [demo, setDemo] = useState({ enabled: false, accounts: [] })

  useEffect(() => {
    let active = true
    api('/api/demo/credentials').then((data) => {
      if (active) setDemo(data)
    }).catch(() => { /* Never advertise credentials for an unavailable API. */ })
    return () => { active = false }
  }, [])
  const demoAccounts = demo.accounts.map((a) => ({ ...DEMO_ACCOUNT_LABELS[a.role], ...a, id: a.role }))

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  function fillDemo(account) {
    setForm({ email: account.email, password: account.password })
    setErrors({})
    setMessage('')
    setNotice(`${account.title} details filled in. Press "Log in" to continue.`)
  }

  async function copyDemo(account) {
    try {
      await copyText(demoCredentialsText(account))
      setCopied(account.id)
      setNotice(`${account.title} credentials copied.`)
      window.setTimeout(() => setCopied(''), 2500)
    } catch {
      setNotice('Your browser blocked copying. Select the email and password and copy them manually.')
    }
  }

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
    <>
      <div className="container auth">
        <div className="auth-form">
          <p className="eyebrow">Your ZELVORA account</p>
          <h1>Welcome back</h1>
          <p className="lead">Log in to book vehicles and manage your rentals.</p>
          {location.state?.from && <Alert tone="info">Please log in to continue.</Alert>}
          <Alert tone="error">{message}</Alert>
          {notice && <Alert tone="info" onClose={() => setNotice('')}>{notice}</Alert>}
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
          <VehicleImage src={ASSETS.electric} category="Scooter" priority />
          <p className="auth-quote">Every Ride, A New Story.</p>
        </aside>
      </div>

      {demo.enabled && <section className="container demo-access" aria-labelledby="demo-heading">
        <div className="demo-head">
          <div>
            <p className="demo-eyebrow">Try it before registering</p>
            <h2 id="demo-heading">Demo Login Credentials</h2>
            <p className="muted">Use a public demo account to explore ZELVORA. Fill the form in one click, or copy the details.</p>
          </div>
          <span className="badge badge-muted">Local demo only</span>
        </div>

        <div className="demo-grid">
          {demoAccounts.map((account) => (
            <article className="demo-card" key={account.id}>
              <div className="demo-card-head">
                <h3>{account.title}</h3>
                <span className={`badge ${account.role === 'admin' ? 'badge-warn' : 'badge-ok'}`}>
                  {account.badge}
                </span>
              </div>
              <p className="muted">{account.description}</p>
              <dl className="demo-credentials">
                <div>
                  <dt>Email</dt>
                  <dd><code>{account.email}</code></dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd><code>{account.password}</code></dd>
                </div>
              </dl>
              <div className="demo-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => fillDemo(account)}>
                  Fill login form
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => copyDemo(account)}>
                  {copied === account.id ? 'Copied' : 'Copy credentials'}
                </button>
              </div>
            </article>
          ))}
        </div>
        {demoAccounts.length < 2 && <Alert tone="info">Some demo credentials have changed. Ask the local administrator to update the public demo configuration.</Alert>}

        <p className="demo-note">
          These are dedicated demo accounts, not real customer or administrator logins. The customer account is
          limited to customer features. The <strong>Main Admin</strong> account has full control of the local demo
          database: vehicles, customers, every booking, approvals, rejections, completion, payments and revenue.
          This environment uses a separate synthetic-only MySQL database. Use fictitious names, phone numbers
          and reserved example email addresses only. Never enter private information or reuse these passwords elsewhere.
        </p>
      </section>}
    </>
  )
}
