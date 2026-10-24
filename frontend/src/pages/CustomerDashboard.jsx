import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useApi } from '../hooks'
import { formatDate, money, todayISO } from '../format'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, Loader } from '../components/Feedback'

export default function CustomerDashboard() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useApi('/api/bookings/mine')
  const bookings = data?.bookings || []
  const today = todayISO()
  const upcoming = bookings
    .filter((b) => ['Pending', 'Confirmed'].includes(b.booking_status) && b.return_date.slice(0, 10) >= today)
    .sort((a, b) => a.pickup_date.localeCompare(b.pickup_date))
  const count = (status) => bookings.filter((b) => b.booking_status === status).length
  const next = upcoming[0]

  return (
    <div className="container page">
      <div className="page-head-inline">
        <h1>Welcome, {user.name.split(' ')[0]}</h1>
        <p className="lead">Here is where your rentals stand.</p>
      </div>

      {loading && <Loader label="Loading your bookings" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <div className="dash-grid">
          <section className="panel dash-next">
            <h2>Your next trip</h2>
            {next ? (
              <div className="next-trip">
                <img src={next.image_url} alt="" />
                <div>
                  <h3>{next.vehicle_name}</h3>
                  <p className="muted">{formatDate(next.pickup_date)} to {formatDate(next.return_date)}</p>
                  <p>{money(next.total_amount)}, pay at pickup</p>
                  <StatusBadge status={next.booking_status} />
                </div>
              </div>
            ) : (
              <p>You have no upcoming trips. Find a vehicle and plan one.</p>
            )}
            <div className="dash-actions">
              <Link to="/vehicles" className="btn btn-primary btn-sm">Browse vehicles</Link>
              <Link to="/my-bookings" className="btn btn-outline btn-sm">All my bookings</Link>
            </div>
          </section>

          <section className="dash-stats" aria-label="Booking summary">
            <div className="stat"><strong>{bookings.length}</strong><span>Total bookings</span></div>
            <div className="stat"><strong>{count('Pending')}</strong><span>Waiting for approval</span></div>
            <div className="stat"><strong>{count('Confirmed')}</strong><span>Confirmed</span></div>
            <div className="stat"><strong>{count('Completed')}</strong><span>Completed</span></div>
          </section>
        </div>
      )}
    </div>
  )
}
