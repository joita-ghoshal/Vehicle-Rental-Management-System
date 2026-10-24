import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks'
import { formatDate, money, todayISO } from '../format'
import Field from '../components/Field'
import { Alert, ErrorState, Loader } from '../components/Feedback'

export default function BookVehicle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useApi(`/api/vehicles/${id}`)
  const [dates, setDates] = useState({ pickup: '', ret: '' })
  const [errors, setErrors] = useState({})
  const [check, setCheck] = useState(null) // result of the availability check
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <div className="container page"><Loader label="Loading vehicle" /></div>
  if (error) return <div className="container page narrow"><ErrorState message={error} onRetry={reload} /></div>

  const v = data.vehicle
  const today = todayISO()

  function change(key, value) {
    setDates({ ...dates, [key]: value })
    setCheck(null)
    setMessage('')
  }

  function validate() {
    const e = {}
    if (!dates.pickup) e.pickup = 'Choose a pickup date.'
    else if (dates.pickup < today) e.pickup = 'Pickup date cannot be in the past.'
    if (!dates.ret) e.ret = 'Choose a return date.'
    else if (dates.pickup && dates.ret < dates.pickup) e.ret = 'Return date cannot be before pickup.'
    return e
  }

  async function checkAvailability(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    setMessage('')
    setCheck(null)
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      setCheck(await api(`/api/vehicles/${v.id}/availability?pickup=${dates.pickup}&return=${dates.ret}`))
    } catch (err) {
      setMessage(err.message)
      setErrors({ pickup: err.fields.pickup_date, ret: err.fields.return_date })
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    setBusy(true)
    setMessage('')
    try {
      const result = await api('/api/bookings', {
        method: 'POST',
        body: { vehicle_id: v.id, pickup_date: dates.pickup, return_date: dates.ret },
      })
      navigate('/my-bookings', { state: { message: result.message } })
    } catch (err) {
      setMessage(err.message)
      setCheck(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page">
      <p className="crumbs"><Link to="/vehicles">Vehicles</Link> / <Link to={`/vehicles/${v.id}`}>{v.name}</Link> / Book</p>
      <div className="book">
        <div className="book-summary">
          <div className="detail-image"><img src={v.image_url} alt={`${v.brand} ${v.name}`} /></div>
          <h1>{v.name}</h1>
          <p className="detail-sub">{v.brand} {v.model} · {v.category}</p>
          <p className="detail-price"><strong>{money(v.price_per_day)}</strong> <span>per day</span></p>
        </div>

        <div className="book-form panel">
          <h2>Choose your dates</h2>
          <p className="field-hint">Pickup and return days both count. A rental from the 5th to the 5th is one day.</p>
          {v.status !== 'Active' ? (
            <Alert tone="warning">This vehicle is {v.status.toLowerCase()} and cannot be booked right now.</Alert>
          ) : (
            <form onSubmit={checkAvailability} noValidate>
              <Alert tone="error">{message}</Alert>
              <div className="field-row">
                <Field label="Pickup date" name="pickup" error={errors.pickup}>
                  <input id="pickup" type="date" min={today} value={dates.pickup} onChange={(e) => change('pickup', e.target.value)} />
                </Field>
                <Field label="Return date" name="ret" error={errors.ret}>
                  <input id="ret" type="date" min={dates.pickup || today} value={dates.ret} onChange={(e) => change('ret', e.target.value)} />
                </Field>
              </div>
              <button className="btn btn-dark btn-block" disabled={busy}>{busy && !check ? 'Checking…' : 'Check availability'}</button>
            </form>
          )}

          {check && !check.available && <Alert tone="error">{check.reason}</Alert>}
          {check && check.available && (
            <div className="quote">
              <Alert tone="success">Good news, this vehicle is free for your dates.</Alert>
              <dl className="spec-list">
                <div><dt>Pickup</dt><dd>{formatDate(dates.pickup)}</dd></div>
                <div><dt>Return</dt><dd>{formatDate(dates.ret)}</dd></div>
                <div><dt>Rental days</dt><dd>{check.rental_days}</dd></div>
                <div><dt>Rate</dt><dd>{money(v.price_per_day)} per day</dd></div>
                <div className="spec-total"><dt>Total price</dt><dd>{money(check.total_amount)}</dd></div>
                <div><dt>Payment method</dt><dd>Pay at Pickup</dd></div>
              </dl>
              <button className="btn btn-primary btn-block" onClick={confirm} disabled={busy}>
                {busy ? 'Sending request…' : 'Confirm booking request'}
              </button>
              <p className="field-hint">Your request is sent to the admin desk. It is confirmed once approved.</p>
            </div>
          )}

          {v.booked_ranges.length > 0 && (
            <div className="booked-ranges">
              <h3>Already booked</h3>
              <ul>{v.booked_ranges.map((r) => <li key={r.pickup_date + r.return_date}>{formatDate(r.pickup_date)} to {formatDate(r.return_date)}</li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
