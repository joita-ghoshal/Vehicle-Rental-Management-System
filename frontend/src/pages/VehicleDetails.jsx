import { Link, useParams } from 'react-router-dom'
import { useApi } from '../hooks'
import { formatDate, money } from '../format'
import StatusBadge from '../components/StatusBadge'
import { ErrorState, Loader } from '../components/Feedback'

export default function VehicleDetails() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(`/api/vehicles/${id}`)

  if (loading) return <div className="container page"><Loader label="Loading vehicle" /></div>
  if (error) return (
    <div className="container page narrow">
      <ErrorState message={error} onRetry={reload} />
      <p className="center"><Link to="/vehicles" className="btn btn-outline">Back to vehicles</Link></p>
    </div>
  )

  const v = data.vehicle
  const bookable = v.status === 'Active'

  return (
    <div className="container page">
      <p className="crumbs"><Link to="/vehicles">Vehicles</Link> / {v.category} / {v.name}</p>
      <div className="detail">
        <div className="detail-main">
          <div className="detail-image"><img src={v.image_url} alt={`${v.brand} ${v.name}`} /></div>
          <h2>About this vehicle</h2>
          <p className="detail-desc">{v.description}</p>
        </div>

        <aside className="detail-panel panel">
          <div className="detail-title-row">
            <h1>{v.name}</h1>
            <StatusBadge status={v.status} />
          </div>
          <p className="detail-sub">{v.brand} {v.model}</p>
          <p className="detail-price"><strong>{money(v.price_per_day)}</strong> <span>per day</span></p>

          <dl className="spec-list">
            <div><dt>Category</dt><dd>{v.category}</dd></div>
            <div><dt>Registration</dt><dd>{v.registration_number}</dd></div>
            <div><dt>Fuel</dt><dd>{v.fuel_type}</dd></div>
            <div><dt>Transmission</dt><dd>{v.transmission === 'Not applicable' ? 'Not applicable' : v.transmission}</dd></div>
            <div><dt>Seats</dt><dd>{v.seats}</dd></div>
            <div><dt>Payment</dt><dd>Pay at Pickup</dd></div>
          </dl>

          {bookable ? (
            <Link to={`/book/${v.id}`} className="btn btn-primary btn-block">Book this vehicle</Link>
          ) : (
            <p className="note note-warn">This vehicle is {v.status.toLowerCase()} right now, so it cannot be booked.</p>
          )}

          {v.booked_ranges.length > 0 && (
            <div className="booked-ranges">
              <h3>Already booked</h3>
              <ul>
                {v.booked_ranges.map((r) => (
                  <li key={r.pickup_date + r.return_date}>{formatDate(r.pickup_date)} to {formatDate(r.return_date)}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
