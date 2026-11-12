import { Link } from 'react-router-dom'
import { SITE } from '../siteInfo'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Logo />
          <p className="footer-tag">Every Ride, A New Story.</p>
          <p className="footer-description">A considered way to explore cars, bikes and scooters.<br />Built as a full-stack academic demonstration.</p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          <Link to="/vehicles">Browse vehicles</Link>
          <Link to="/about">About us</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/login">Log in</Link>
        </nav>
        <div className="footer-contact">
          <p>{SITE.email}</p>
          <p>{SITE.phone}</p>
          <p>{SITE.address}</p>
        </div>
      </div>
      <div className="container footer-base">
        <p>© {new Date().getFullYear()} ZELVORA. A college demonstration project. No real rentals or payments.</p>
        <span>Designed for the journey.</span>
      </div>
    </footer>
  )
}
