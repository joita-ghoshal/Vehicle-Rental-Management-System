import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { Loader } from './Feedback'

// Keeps pages for one role away from everyone else.
// (The Python backend checks permissions again on every request.)
export default function RequireAuth({ role }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="container page"><Loader label="Checking your session" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  return <Outlet />
}
