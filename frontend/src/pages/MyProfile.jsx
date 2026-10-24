import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { formatDate } from '../format'
import Field from '../components/Field'
import { Alert } from '../components/Feedback'

export default function MyProfile() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({ name: user.name, phone: user.phone })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => { setForm({ ...form, [key]: e.target.value }); setNotice('') }

  async function submit(e) {
    e.preventDefault()
    const found = {}
    if (form.name.trim().length < 2) found.name = 'Enter your full name.'
    if (!/^\+?\d{10,14}$/.test(form.phone.replace(/[\s\-()]/g, ''))) found.phone = 'Enter a phone number with 10 to 14 digits.'
    setErrors(found)
    setProblem('')
    setNotice('')
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const result = await api('/api/profile', { method: 'PUT', body: { name: form.name.trim(), phone: form.phone } })
      setUser(result.user)
      setForm({ name: result.user.name, phone: result.user.phone })
      setNotice(result.message)
    } catch (err) {
      setProblem(err.message)
      setErrors(err.fields || {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page narrow">
      <h1>My profile</h1>
      <div className="panel">
        <dl className="spec-list">
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(user.created_at)}</dd></div>
        </dl>
        <Alert tone="success">{notice}</Alert>
        <Alert tone="error">{problem}</Alert>
        <form onSubmit={submit} noValidate>
          <Field label="Full name" name="name" error={errors.name}>
            <input id="name" value={form.name} onChange={set('name')} maxLength={100} />
          </Field>
          <Field label="Phone number" name="phone" error={errors.phone}>
            <input id="phone" type="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  )
}
