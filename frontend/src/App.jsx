import { useEffect } from 'react'
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import AdminLayout from './components/AdminLayout'
import Home from './pages/Home'
import Vehicles from './pages/Vehicles'
import VehicleDetails from './pages/VehicleDetails'
import About from './pages/About'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import CustomerDashboard from './pages/CustomerDashboard'
import BookVehicle from './pages/BookVehicle'
import MyBookings from './pages/MyBookings'
import MyProfile from './pages/MyProfile'
import AdminDashboard from './admin/AdminDashboard'
import ManageVehicles from './admin/ManageVehicles'
import AddVehicle from './admin/AddVehicle'
import EditVehicle from './admin/EditVehicle'
import ManageBookings from './admin/ManageBookings'
import Customers from './admin/Customers'

function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <>
      <a href="#content" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="content"><Outlet /></main>
      <Footer />
    </>
  )
}

function NotFound() {
  return (
    <div className="container page narrow center">
      <h1>This page does not exist</h1>
      <p className="lead">The link may be old or mistyped.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/vehicles/:id" element={<VehicleDetails />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<RequireAuth role="customer" />}>
          <Route path="/dashboard" element={<CustomerDashboard />} />
          <Route path="/book/:id" element={<BookVehicle />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/profile" element={<MyProfile />} />
        </Route>

        <Route element={<RequireAuth role="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/vehicles" element={<ManageVehicles />} />
            <Route path="/admin/vehicles/new" element={<AddVehicle />} />
            <Route path="/admin/vehicles/:id/edit" element={<EditVehicle />} />
            <Route path="/admin/bookings" element={<ManageBookings />} />
            <Route path="/admin/customers" element={<Customers />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
