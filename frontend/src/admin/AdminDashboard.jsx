import { Link } from 'react-router-dom'
import { useApi } from '../hooks'
import { formatDate, money } from '../format'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, Loader } from '../components/Feedback'

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApi('/api/admin/dashboard')
  if (loading) return <Loader label="Loading dashboard" />
  if (error) return <ErrorState message={error} onRetry={reload} />
  const s = data.summary
  const cards = [
    ['Total vehicles', s.total_vehicles],
    ['Total customers', s.total_customers],
    ['Total bookings', s.total_bookings],
    ['Pending bookings', s.pending_bookings],
    ['Confirmed bookings', s.confirmed_bookings],
    ['Completed bookings', s.completed_bookings],
  ]
  return (
    <>
      <h1>Dashboard</h1>
      <div className="admin-stats">
        <div className="stat stat-feature">
          <span>Completed rental revenue</span>
          <strong>{money(s.completed_revenue)}</strong>
          <small>From completed bookings only</small>
        </div>
        {cards.map(([label, value]) => (
          <div className="stat" key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </div>

      <div className="section-head">
        <h2>Latest booking requests</h2>
        <Link to="/admin/bookings" className="text-link">Manage all bookings</Link>
      </div>
      {data.recent_bookings.length === 0 ? (
        <p className="muted">No bookings have been made yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Customer</th><th>Vehicle</th><th>Dates</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {data.recent_bookings.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>{b.customer_name}</td>
                  <td>{b.vehicle_name}</td>
                  <td>{formatDate(b.pickup_date)} to {formatDate(b.return_date)}</td>
                  <td>{money(b.total_amount)}</td>
                  <td><StatusBadge status={b.booking_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
