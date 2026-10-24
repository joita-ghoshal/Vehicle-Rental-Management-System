import { Link } from 'react-router-dom'
import VehicleForm from './VehicleForm'

export default function AddVehicle() {
  return (
    <>
      <p className="crumbs"><Link to="/admin/vehicles">Vehicles</Link> / Add</p>
      <h1>Add a vehicle</h1>
      <VehicleForm />
    </>
  )
}
