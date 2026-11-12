import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Logo from './Logo'
import { Alert } from './Feedback'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const toggle = useRef(null)
  const header = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    const outside = (event) => { if (!header.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('keydown', escape)
    document.addEventListener('pointerdown', outside)
    return () => {
      document.removeEventListener('keydown', escape)
      document.removeEventListener('pointerdown', outside)
    }
  }, [open])

  async function handleLogout() {
    setLogoutError('')
    setLoggingOut(true)
    try {
      await logout()
      navigate('/')
    } catch (err) {
      setLogoutError(`Could not log out. ${err.message} Please try again.`)
    } finally {
      setLoggingOut(false)
    }
  }

  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

  return (
    <header className="navbar" ref={header}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" aria-label="ZELVORA home">
          <Logo />
        </Link>
        <button ref={toggle} className="nav-toggle" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(!open)}>
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          <span className="nav-toggle-bars" aria-hidden="true" />
        </button>
        <nav id="main-menu" className={open ? 'nav-menu open' : 'nav-menu'} aria-label="Main">
          <NavLink to="/" end className={link}>Home</NavLink>
          <NavLink to="/vehicles" className={link}>Vehicles</NavLink>
          <NavLink to="/about" className={link}>About</NavLink>
          <NavLink to="/contact" className={link}>Contact</NavLink>
          {user?.role === 'customer' && (
            <>
              <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
              <NavLink to="/my-bookings" className={link}>My bookings</NavLink>
              <NavLink to="/profile" className={link}>Profile</NavLink>
            </>
          )}
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin</NavLink>}
          <span className="nav-spacer" />
          {user ? (
            <>
              <span className="nav-user">Hi, {user.name.split(' ')[0]}</span>
              <button className="btn btn-light btn-sm" disabled={loggingOut} onClick={handleLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-light btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
            </>
          )}
        </nav>
      </div>
      {logoutError && <div className="container"><Alert tone="error" onClose={() => setLogoutError('')}>{logoutError}</Alert></div>}
    </header>
  )
}
