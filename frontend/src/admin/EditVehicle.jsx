import { Link, useParams } from 'react-router-dom'
import { useApi } from '../hooks'
import { ErrorState, Loader } from '../components/Feedback'
import VehicleForm from './VehicleForm'

export default function EditVehicle() {
  const { id } = useParams()
  const { data, loading, error, reload } = useApi(`/api/admin/vehicles/${id}`)
  return (
    <>
      <p className="crumbs"><Link to="/admin/vehicles">Vehicles</Link> / Edit</p>
      <h1>Edit vehicle</h1>
      {loading && <Loader label="Loading vehicle" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && <VehicleForm vehicle={data.vehicle} vehicleId={id} />}
    </>
  )
}
