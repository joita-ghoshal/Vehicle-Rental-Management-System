import { Link } from 'react-router-dom'
import { money } from '../format'

export default function VehicleCard({ vehicle, large = false }) {
  const v = vehicle
  return (
    <article className={large ? 'vcard vcard-large' : 'vcard'}>
      <Link to={`/vehicles/${v.id}`} className="vcard-media" aria-label={`View ${v.name}`}>
        <img src={v.image_url} alt={`${v.brand} ${v.name}`} loading="lazy" />
        <span className="vcard-category">{v.category}</span>
      </Link>
      <div className="vcard-body">
        <div>
          <h3 className="vcard-title">{v.name}</h3>
          <p className="vcard-sub">{v.brand} {v.model}</p>
        </div>
        <ul className="vcard-specs">
          <li>{v.fuel_type}</li>
          {v.transmission !== 'Not applicable' && <li>{v.transmission}</li>}
          <li>{v.seats} seats</li>
        </ul>
        <p className={v.is_booked ? 'vcard-avail booked' : 'vcard-avail'}>
          {v.is_booked ? 'Booked for these dates' : 'Available to book'}
        </p>
        <div className="vcard-foot">
          <p className="vcard-price"><strong>{money(v.price_per_day)}</strong> <span>per day</span></p>
          <div className="vcard-actions">
            <Link to={`/vehicles/${v.id}`} className="btn btn-outline btn-sm">Details</Link>
            <Link to={`/book/${v.id}`} className="btn btn-primary btn-sm">Book now</Link>
          </div>
        </div>
      </div>
    </article>
  )
}
