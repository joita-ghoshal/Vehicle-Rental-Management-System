import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks'
import { CATEGORIES, money } from '../format'
import VehicleCard from '../components/VehicleCard'
import { ErrorState, Loader, EmptyState } from '../components/Feedback'
import { AboutSection, ContactSection } from '../components/Sections'
import VehicleImage from '../components/VehicleImage'
import { CATEGORY_IMAGES } from '../assets'

const CATEGORY_COPY = {
  Car: 'For families, long roads and monsoon weekends.',
  Bike: 'For open highways and an easy sense of freedom.',
  Scooter: 'For short hops, shopping and city lanes.',
}

export default function Home() {
  const { data, loading, error, reload } = useApi('/api/vehicles')
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')

  const vehicles = data?.vehicles || []
  const featured = CATEGORIES.map((c) => vehicles.find((v) => v.category === c)).filter(Boolean)
  const heroVehicle = featured[0]
  const count = (c) => vehicles.filter((v) => v.category === c).length

  function search(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (category) params.set('category', category)
    navigate(`/vehicles?${params.toString()}`)
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> A little freedom, thoughtfully planned</p>
            <h1>Every Ride,<br /><em>A New Story.</em></h1>
            <p className="lead">
              A weekend away. A different route home. Find the right car, bike or scooter for whatever comes next.
              Clear daily rates. Payment at pickup.
            </p>
            <div className="hero-actions">
              <Link to="/vehicles" className="btn btn-primary btn-lg">Explore vehicles <span aria-hidden="true">↗</span></Link>
              <Link to="/register" className="btn btn-outline btn-lg">Create an account</Link>
            </div>
            <p className="hero-footnote">Choose your dates. Send a request. Ride once confirmed.</p>
          </div>
          <div className="hero-arch">
            <VehicleImage src={heroVehicle?.image_url} category="Car" alt={heroVehicle ? `Representative illustration for ${heroVehicle.brand} ${heroVehicle.name}` : 'ZELVORA car illustration'} priority />
            {heroVehicle && (
              <Link to={`/vehicles/${heroVehicle.id}`} className="hero-tag">
                <span><small>From the collection</small>{heroVehicle.brand} {heroVehicle.name}</span>
                <strong>{money(heroVehicle.price_per_day)} <small>/ day ↗</small></strong>
              </Link>
            )}
          </div>
        </div>
        <div className="container">
          <form className="quick-search" onSubmit={search} role="search">
            <div className="field">
              <label htmlFor="home-q">Vehicle name or brand</label>
              <input id="home-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Creta, Honda or Classic" maxLength={100} />
            </div>
            <div className="field">
              <label htmlFor="home-cat">Type</label>
              <select id="home-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All vehicles</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn btn-dark" type="submit">Find vehicles</button>
          </form>
          <p className="artwork-note">Original category illustrations. Specifications and availability are shown on each vehicle page.</p>
        </div>
      </section>

      <div className="journey-strip">
        <div className="container journey-facts">
          <p><strong>Three ways to travel</strong><span>Cars, bikes &amp; scooters</span></p>
          <p><strong>Know the total first</strong><span>Daily rates. Inclusive rental days.</span></p>
          <p><strong>Pay at pickup</strong><span>No online card details required</span></p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          <p className="eyebrow">The collection</p>
          <h2 className="section-title">A different ride for every kind of day.</h2>
          <div className="category-grid">
            {CATEGORIES.map((c) => (
              <Link key={c} to={`/vehicles?category=${c}`} className={`category-tile category-${c.toLowerCase()}`}>
                <VehicleImage src={CATEGORY_IMAGES[c]} category={c} />
                <div className="category-text">
                  <h3>{c === 'Bike' ? 'Bikes' : c === 'Car' ? 'Cars' : 'Scooters'}</h3>
                  <p>{CATEGORY_COPY[c]}</p>
                  <span className="category-count">{loading ? 'Loading…' : error ? 'Explore collection' : `${count(c)} in the fleet`} <span aria-hidden="true">↗</span></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-plum">
        <div className="container">
          <div className="section-head">
            <div><p className="eyebrow">A starting point for your next story</p><h2 className="section-title">Featured vehicles</h2></div>
            <Link to="/vehicles" className="text-link">See the full fleet</Link>
          </div>
          {loading && <Loader label="Loading vehicles" />}
          {error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && featured.length === 0 && (
            <EmptyState title="No vehicles yet" text="The fleet is empty. An admin can add vehicles from the admin area." />
          )}
          {featured.length > 0 && (
            <div className="featured-grid">
              {featured.map((v, i) => <VehicleCard key={v.id} vehicle={v} large={i === 0} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">Less planning. More possibilities.</p>
          <h2 className="section-title">Three steps from browsing to the road</h2>
          <ol className="steps">
            <li><h3>Choose</h3><p>Browse cars, bikes and scooters. Search by name or brand and filter by price.</p></li>
            <li><h3>Request</h3><p>Pick your pickup and return dates, check availability and send your booking request.</p></li>
            <li><h3>Ride</h3><p>Once the admin confirms, collect your vehicle and pay at pickup.</p></li>
          </ol>
        </div>
      </section>

      <section className="section why">
        <div className="container why-grid">
          <div><p className="eyebrow">Considered, from the start</p><h2>Small details.<br />A simpler journey.</h2><p className="muted">A clear process, without the guesswork.</p></div>
          <ul className="why-list">
            <li><strong>Clear prices.</strong> You see the daily rate and the full total before you send a request.</li>
            <li><strong>No double bookings.</strong> A vehicle is never confirmed twice for the same day.</li>
            <li><strong>Pay at pickup.</strong> No card details online. You pay when you collect the keys.</li>
            <li><strong>Flexible plans.</strong> Cancel any pending or confirmed booking before the pickup date.</li>
          </ul>
        </div>
      </section>

      <AboutSection />
      <ContactSection />
    </>
  )
}
