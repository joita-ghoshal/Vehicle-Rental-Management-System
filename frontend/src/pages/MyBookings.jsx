import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks'
import { formatDate, money } from '../format'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { Alert, EmptyState, ErrorState, Loader } from '../components/Feedback'

export default function MyBookings() {
  const location = useLocation()
  const { data, loading, error, reload } = useApi('/api/bookings/mine')
  const [notice, setNotice] = useState(location.state?.message || '')
  const [problem, setProblem] = useState('')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  async function cancel() {
    setBusy(true)
    try {
      const result = await api(`/api/bookings/${target.id}/cancel`, { method: 'POST' })
      setNotice(result.message)
      setProblem('')
      reload()
    } catch (err) {
      setProblem(err.message)
      setNotice('')
    } finally {
      setBusy(false)
      setTarget(null)
    }
  }

  const bookings = data?.bookings || []

  return (
    <div className="container page">
      <div className="page-head-inline">
        <h1>My bookings</h1>
        <p className="lead">Every request you have made, newest first.</p>
      </div>
      <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert tone="error" onClose={() => setProblem('')}>{problem}</Alert>

      {loading && <Loader label="Loading your bookings" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && bookings.length === 0 && (
        <EmptyState title="No bookings yet" text="When you book a vehicle it will appear here." actionTo="/vehicles" actionLabel="Browse vehicles" />
      )}

      <ul className="booking-list">
        {bookings.map((b) => (
          <li key={b.id} className="booking-card">
            <img src={b.image_url} alt="" className="booking-thumb" />
            <div className="booking-info">
              <div className="booking-top">
                <h3><Link to={`/vehicles/${b.vehicle_id}`}>{b.vehicle_name}</Link></h3>
                <StatusBadge status={b.booking_status} />
              </div>
              <p className="muted">Booking #{b.id}. {b.vehicle_brand} {b.vehicle_model}, {b.registration_number}</p>
              <dl className="booking-facts">
                <div><dt>Pickup</dt><dd>{formatDate(b.pickup_date)}</dd></div>
                <div><dt>Return</dt><dd>{formatDate(b.return_date)}</dd></div>
                <div><dt>Total price</dt><dd>{money(b.total_amount)}</dd></div>
                <div><dt>Payment</dt><dd>Pay at Pickup <StatusBadge status={b.payment_status} /></dd></div>
              </dl>
            </div>
            {b.can_cancel && (
              <button className="btn btn-danger-outline btn-sm" onClick={() => setTarget(b)}>Cancel booking</button>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!target}
        title="Cancel this booking?"
        message={target ? `Booking #${target.id} for ${target.vehicle_name} will be cancelled. This cannot be undone.` : ''}
        confirmLabel="Cancel booking"
        danger
        busy={busy}
        onConfirm={cancel}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}
