import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useApi } from '../hooks'
import { money } from '../format'
import ConfirmDialog from '../components/ConfirmDialog'
import { Alert, EmptyState, ErrorState, Loader } from '../components/Feedback'

export default function ManageVehicles() {
  const location = useLocation()
  const [archived, setArchived] = useState(false)
  const { data, loading, error, reload } = useApi(`/api/admin/vehicles?archived=${archived ? 1 : 0}`)
  const [notice, setNotice] = useState(location.state?.message || '')
  const [problem, setProblem] = useState('')
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run(promise) {
    setBusy(true)
    try {
      const result = await promise
      setNotice(result.message)
      setProblem('')
      reload()
    } catch (err) {
      setProblem(err.message)
      setNotice('')
    } finally {
      setBusy(false)
      setTarget(null)
    }
  }

  const changeStatus = (v, status) =>
    run(api(`/api/admin/vehicles/${v.id}`, { method: 'PUT', body: { ...v, status } }).then(() => ({ message: `${v.name} is now ${status.toLowerCase()}.` })))
  const archive = () => run(api(`/api/admin/vehicles/${target.id}/archive`, { method: 'POST' }))
  const restore = (v) => run(api(`/api/admin/vehicles/${v.id}/restore`, { method: 'POST' }))

  const vehicles = data?.vehicles || []

  return (
    <>
      <div className="section-head">
        <h1>{archived ? 'Archived vehicles' : 'Vehicles'}</h1>
        <div className="head-actions">
          <button className="btn btn-outline btn-sm" onClick={() => setArchived(!archived)}>
            {archived ? 'Show active fleet' : 'Show archived'}
          </button>
          <Link to="/admin/vehicles/new" className="btn btn-primary btn-sm">Add vehicle</Link>
        </div>
      </div>
      <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>
      <Alert tone="error" onClose={() => setProblem('')}>{problem}</Alert>

      {loading && <Loader label="Loading vehicles" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && vehicles.length === 0 && (
        <EmptyState title={archived ? 'Nothing archived' : 'No vehicles yet'} text={archived ? 'Archived vehicles appear here.' : 'Add your first vehicle to start taking bookings.'} />
      )}
      {vehicles.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Vehicle</th><th>Category</th><th>Registration</th><th>Price per day</th><th>Status</th><th>Bookings</th><th>Actions</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="cell-vehicle">
                      <img src={v.image_url} alt="" />
                      <div><strong>{v.name}</strong><br /><span className="muted">{v.brand} {v.model}</span></div>
                    </div>
                  </td>
                  <td>{v.category}</td>
                  <td>{v.registration_number}</td>
                  <td>{money(v.price_per_day)}</td>
                  <td>
                    {archived ? v.status : (
                      <select className="select-sm" aria-label={`Status of ${v.name}`} value={v.status} disabled={busy} onChange={(e) => changeStatus(v, e.target.value)}>
                        <option>Active</option><option>Inactive</option><option>Maintenance</option>
                      </select>
                    )}
                  </td>
                  <td>{v.booking_count}</td>
                  <td>
                    <div className="row-actions">
                      {archived ? (
                        <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => restore(v)}>Restore</button>
                      ) : (
                        <>
                          <Link to={`/admin/vehicles/${v.id}/edit`} className="btn btn-outline btn-sm">Edit</Link>
                          <button className="btn btn-danger-outline btn-sm" onClick={() => setTarget(v)}>Archive</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        title="Archive this vehicle?"
        message={target ? `${target.name} will be hidden from customers. Its booking history is kept and you can restore it later.` : ''}
        confirmLabel="Archive vehicle"
        danger
        busy={busy}
        onConfirm={archive}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
