import { NavLink, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  const link = ({ isActive }) => (isActive ? 'side-link active' : 'side-link')
  return (
    <div className="container admin-shell">
      <aside className="admin-side">
        <p className="admin-side-title">Admin</p>
        <nav aria-label="Admin">
          <NavLink to="/admin" end className={link}>Dashboard</NavLink>
          <NavLink to="/admin/vehicles" className={link}>Vehicles</NavLink>
          <NavLink to="/admin/bookings" className={link}>Bookings</NavLink>
          <NavLink to="/admin/customers" className={link}>Customers</NavLink>
        </nav>
      </aside>
      <section className="admin-main"><Outlet /></section>
    </div>
  )
}
