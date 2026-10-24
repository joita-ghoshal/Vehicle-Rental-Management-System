import { SITE } from '../siteInfo'

export function AboutSection() {
  return (
    <section className="section about">
      <div className="container about-grid">
        <div className="about-image">
          <img src="/images/car-hatchback.svg" alt="" loading="lazy" />
        </div>
        <div>
          <h2>A rental desk that remembers it is run by people</h2>
          <p>
            ZELVORA started as a simple idea: renting a car, a bike or a scooter should feel as calm as picking up a
            book from a friend. We keep a small, well-kept fleet, show every price up front, and let you pay when you
            collect the keys.
          </p>
          <p>
            This website is a college project that shows how a complete rental service works, from browsing and
            booking to the admin desk that approves each request.
          </p>
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
          <h2>Talk to us before you book</h2>
          <p>Questions about a vehicle, a long rental or pickup times? Send us an email and we will reply within a day.</p>
          <a className="btn btn-dark" href={`mailto:${SITE.email}?subject=ZELVORA%20rental%20question`}>Email ZELVORA</a>
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
