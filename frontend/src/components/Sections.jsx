import { SITE } from '../siteInfo'
import { Link } from 'react-router-dom'
import VehicleImage from './VehicleImage'
import { ASSETS } from '../assets'

export function AboutSection() {
  return (
    <section className="section about">
      <div className="container about-grid">
        <div className="about-image">
          <VehicleImage src={ASSETS.hatchback} />
        </div>
        <div>
          <p className="eyebrow">Meet ZELVORA</p>
          <h2>Thoughtful journeys start with a little clarity.</h2>
          <p>
            One place to compare the fleet, see your rental total and follow a booking from request to confirmation.
            ZELVORA brings the customer experience and the rental desk together, without unnecessary steps.
          </p>
          <p>
            This is a full-stack academic demonstration, not an operating rental service. The demo uses fictional
            profiles and representative vehicle illustrations. No real rental or payment is processed here.
          </p>
          <Link to="/vehicles" className="text-link">Find your next ride <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </section>
  )
}

export function ContactSection() {
  return (
    <section className="section contact" id="contact">
      <div className="container contact-grid">
        <div>
          <p className="eyebrow">Take a closer look</p>
          <h2>Your next story starts with a look around.</h2>
          <p>Explore the customer experience or the full-control rental desk with the demo logins. This is a self-guided demonstration; the contact details are illustrative, not a staffed support service.</p>
          <Link className="btn btn-dark" to="/login">Try the demo <span aria-hidden="true">↗</span></Link>
        </div>
        <dl className="contact-list">
          <div><dt>Email</dt><dd>{SITE.email}</dd></div>
          <div><dt>Phone</dt><dd>{SITE.phone}</dd></div>
          <div><dt>Pickup desk</dt><dd>{SITE.address}</dd></div>
          <div><dt>Hours</dt><dd>{SITE.hours}</dd></div>
        </dl>
      </div>
    </section>
  )
}
