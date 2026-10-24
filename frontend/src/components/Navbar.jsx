import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import Logo from './Logo'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setOpen(false) }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const link = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" aria-label="ZELVORA home">
          <Logo />
        </Link>
        <button className="nav-toggle" aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(!open)}>
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
              <button className="btn btn-light btn-sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-light btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
