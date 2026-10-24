import { Link } from 'react-router-dom'
import { AboutSection } from '../components/Sections'

export default function About() {
  return (
    <>
      <div className="container page-head">
        <h1>About ZELVORA</h1>
        <p className="lead">Every Ride, A New Story.</p>
      </div>
      <AboutSection />
      <section className="section">
        <div className="container narrow">
          <h2>How rentals work here</h2>
          <p>
            You choose a vehicle and your dates. Your request goes to our admin desk, which confirms it once the
            vehicle is free. Pickup and return days both count, so a rental from the 5th to the 5th is one day.
            There is no online payment: you pay at pickup.
          </p>
          <Link to="/vehicles" className="btn btn-primary">Browse vehicles</Link>
        </div>
      </section>
    </>
  )
}
