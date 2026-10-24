import { useState } from 'react'
import { api } from '../api'
import { useApi } from '../hooks'
import { formatDate, money } from '../format'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
import { Alert, EmptyState, ErrorState, Loader } from '../components/Feedback'

const FILTERS = ['All', 'Pending', 'Confirmed', 'Completed', 'Rejected', 'Cancelled']

export default function ManageBookings() {
  const [filter, setFilter] = useState('All')
  const { data, loading, error, reload } = useApi(`/api/admin/bookings${filter === 'All' ? '' : `?status=${filter}`}`)
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState('')
  const [confirm, setConfirm] = useState(null) // { booking, action }
  const [busy, setBusy] = useState(false)

  async function act(booking, action, body) {
    setBusy(true)
    try {
      const result = await api(`/api/admin/bookings/${booking.id}/${action}`, { method: action === 'payment' ? 'PUT' : 'POST', body })
      setNotice(`Booking #${booking.id}: ${result.message}`)
      setProblem('')
    } catch (err) {
      setProblem(`Booking #${booking.id}: ${err.message}`)
      setNotice('')
    } finally {
      setBusy(false)
      setConfirm(null)
      reload()
    }
  }

  const CONFIRM_TEXT = {
    reject: ['Reject this booking?', 'The customer will see it as rejected. The record is kept.', 'Reject booking', true],
    complete: ['Mark as completed?', 'Use this once the vehicle has been returned. It will count towards revenue.', 'Mark completed', false],
  }
  const bookings = data?.bookings || []

  return (
    <>
      <h1>Bookings</h1>
      <div className="tabs" role="group" aria-label="Filter bookings by status">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'tab active' : 'tab'} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert tone="error" onClose={() => setProblem('')}>{problem}</Alert>

      {loading && !data && <Loader label="Loading bookings" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && bookings.length === 0 && <EmptyState title="No bookings here" text={filter === 'All' ? 'Bookings will appear when customers send requests.' : `There are no ${filter.toLowerCase()} bookings.`} />}
      {bookings.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>Dates</th><th>Total</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td><strong>{b.customer_name}</strong><br /><span className="muted">{b.customer_email}<br />{b.customer_phone}</span></td>
                  <td><strong>{b.vehicle_name}</strong><br /><span className="muted">{b.vehicle_category}, {b.registration_number}</span></td>
                  <td>{formatDate(b.pickup_date)}<br />to {formatDate(b.return_date)}</td>
                  <td>{money(b.total_amount)}</td>
                  <td><StatusBadge status={b.booking_status} /></td>
                  <td>
                    <span className="muted">Pay at Pickup</span><br />
                    <StatusBadge status={b.payment_status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {b.booking_status === 'Pending' && (
                        <>
                          <button className="btn btn-success btn-sm" disabled={busy} onClick={() => act(b, 'approve')}>Approve</button>
                          <button className="btn btn-danger-outline btn-sm" disabled={busy} onClick={() => setConfirm({ booking: b, action: 'reject' })}>Reject</button>
                        </>
                      )}
                      {b.booking_status === 'Confirmed' && (
                        <button className="btn btn-dark btn-sm" disabled={busy} onClick={() => setConfirm({ booking: b, action: 'complete' })}>Mark completed</button>
                      )}
                      {['Confirmed', 'Completed'].includes(b.booking_status) && (
                        <button className="btn btn-outline btn-sm" disabled={busy}
                          onClick={() => act(b, 'payment', { payment_status: b.payment_status === 'Paid' ? 'Unpaid' : 'Paid' })}>
                          {b.payment_status === 'Paid' ? 'Mark unpaid' : 'Mark paid'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm ? CONFIRM_TEXT[confirm.action][0] : ''}
        message={confirm ? `Booking #${confirm.booking.id}. ${CONFIRM_TEXT[confirm.action][1]}` : ''}
        confirmLabel={confirm ? CONFIRM_TEXT[confirm.action][2] : ''}
        danger={confirm ? CONFIRM_TEXT[confirm.action][3] : false}
        busy={busy}
        onConfirm={() => act(confirm.booking, confirm.action)}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
